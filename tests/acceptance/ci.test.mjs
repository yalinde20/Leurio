import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';
import { readWorkflowText, parseSteps, parseTriggers, simulate } from '../helpers/workflow.mjs';

const uid = `${process.pid}-${Date.now()}`;

/** Commandes de la section « ## Commands » de CLAUDE.md : { libellé: commande }. */
function commandesClaude() {
  const md = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const section = md.split(/^## /m).find((s) => s.startsWith('Commands')) ?? '';
  const out = {};
  for (const m of section.matchAll(/^- ([^:\n]+?)\s*:\s*`([^`]+)`/gm)) out[m[1]] = m[2];
  return out;
}

const cmd = () => {
  const c = commandesClaude();
  return { install: c['Installation'], lint: c['Lint'], typecheck: c['Type check'], tests: c['Tests unitaires et de composants (Vitest)'], build: c['Build'] };
};

/** Étapes du workflow qui exécutent `commande` (comparaison exacte). */
const indexDe = (steps, commande) => steps.findIndex((s) => s.run?.trim() === commande);

function exigeCinqEtapes(steps) {
  const c = cmd();
  const idx = {};
  for (const [k, v] of Object.entries(c)) {
    assert.ok(v, `CLAUDE.md ne donne pas la commande « ${k} »`);
    idx[k] = indexDe(steps, v);
    assert.notEqual(idx[k], -1, `aucune étape du workflow ne lance « ${v} » (${k})`);
  }
  return idx;
}

/** Écrit des fichiers (chemins relatifs), exécute fn, restaure l'état initial. */
function avecFaute(fichiers, fn) {
  const avant = new Map();
  try {
    for (const [rel, contenu] of Object.entries(fichiers)) {
      const p = join(ROOT, rel);
      let ancien = null;
      try { ancien = readFileSync(p, 'utf8'); } catch { /* nouveau fichier */ }
      avant.set(p, ancien);
      writeFileSync(p, contenu);
    }
    return fn();
  } finally {
    for (const [p, ancien] of avant) {
      if (ancien === null) rmSync(p, { force: true });
      else writeFileSync(p, ancien);
    }
  }
}

function simulerCI() {
  const steps = parseSteps(readWorkflowText());
  exigeCinqEtapes(steps);
  return simulate(steps, { skip: [cmd().install] });
}

test('critère 1 : given une PR sans erreur, when le workflow CI tourne, then les étapes installation, lint, type check, tests et build s\'exécutent dans cet ordre', () => {
  const steps = parseSteps(readWorkflowText());
  const i = exigeCinqEtapes(steps);
  assert.ok(i.install < i.lint && i.lint < i.typecheck && i.typecheck < i.tests && i.tests < i.build,
    `ordre attendu installation, lint, type check, tests, build ; obtenu ${JSON.stringify(i)}`);
  for (const k of ['install', 'lint', 'typecheck', 'tests', 'build']) {
    const s = steps[i[k]];
    assert.equal(s['continue-on-error'], undefined, `l'étape ${k} ne doit pas avoir continue-on-error`);
    assert.equal(s.if, undefined, `l'étape ${k} ne doit pas être conditionnelle`);
  }
});

test('critère 1 : given une PR sans erreur, when le workflow CI tourne, then le workflow est vert', () => {
  const r = simulerCI();
  assert.equal(r.ok, true, `étape en échec : ${r.failed?.command}\n${r.failed?.output}`);
  assert.deepEqual(r.executed.map((e) => e.command.trim()), Object.values(cmd()));
});

test('critère 1 : given le workflow CI, when on le lit, then Node vient de .nvmrc et le dépôt est récupéré avant l\'installation', () => {
  const steps = parseSteps(readWorkflowText());
  const nvmrc = readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim();
  const node = steps.find((s) => s.uses?.startsWith('actions/setup-node'));
  assert.ok(node, 'actions/setup-node est absent');
  const v = node.with?.['node-version-file'] ?? node.with?.['node-version'];
  assert.ok(v === '.nvmrc' || v === nvmrc, `Node doit venir de .nvmrc (${nvmrc}), obtenu ${v}`);
  const iCheckout = steps.findIndex((s) => s.uses?.startsWith('actions/checkout'));
  const iNode = steps.indexOf(node);
  const iInstall = indexDe(steps, cmd().install);
  assert.ok(iCheckout !== -1 && iCheckout < iNode && iNode < iInstall, 'ordre attendu : checkout, setup-node, installation');
});

test('critère 2 : given une PR contenant une erreur de lint, when le workflow CI tourne, then le workflow échoue à l\'étape lint', () => {
  const r = avecFaute(
    { [`src/app/shared/tmp-ci-lint-${uid}.ts`]: 'export const erreurDeLint: any = 1;\n' },
    simulerCI,
  );
  assert.equal(r.ok, false, 'le workflow aurait dû échouer');
  assert.equal(r.failed.command.trim(), cmd().lint, `échec à « ${r.failed.command} » au lieu du lint\n${r.failed.output}`);
});

test('critère 3 : given une PR contenant une erreur de type, when le workflow CI tourne, then le workflow échoue à l\'étape type check', () => {
  const r = avecFaute(
    { [`src/app/shared/tmp-ci-type-${uid}.ts`]: "export const erreurDeType: number = 'texte';\n" },
    simulerCI,
  );
  assert.equal(r.ok, false, 'le workflow aurait dû échouer');
  assert.equal(r.failed.command.trim(), cmd().typecheck, `échec à « ${r.failed.command} » au lieu du type check\n${r.failed.output}`);
});

test('critère 4 : given une PR contenant un test en échec, when le workflow CI tourne, then le workflow échoue à l\'étape tests', () => {
  const spec = `describe('tmp ci ${uid}', () => {\n  it('échoue', () => {\n    expect(1).toBe(2);\n  });\n});\n`;
  const r = avecFaute({ [`src/app/shared/tmp-ci-${uid}.spec.ts`]: spec }, simulerCI);
  assert.equal(r.ok, false, 'le workflow aurait dû échouer');
  assert.equal(r.failed.command.trim(), cmd().tests, `échec à « ${r.failed.command} » au lieu des tests\n${r.failed.output}`);
});

test('critère 5 : given une PR dont le build échoue, when le workflow CI tourne, then le workflow échoue à l\'étape build', () => {
  // Seul le build applique les budgets : un budget dépassé échoue au build et nulle part ailleurs.
  const angular = readFileSync(join(ROOT, 'angular.json'), 'utf8');
  assert.ok(angular.includes('"maximumError": "1MB"'), 'budget "initial" de angular.json introuvable');
  const r = avecFaute({ 'angular.json': angular.replace('"maximumError": "1MB"', '"maximumError": "1kB"') }, simulerCI);
  assert.equal(r.ok, false, 'le workflow aurait dû échouer');
  assert.equal(r.failed.command.trim(), cmd().build, `échec à « ${r.failed.command} » au lieu du build\n${r.failed.output}`);
});

test('critère 6 : given un push sur main, when il arrive sur GitHub, then le même workflow CI tourne (et aussi sur les pull requests)', () => {
  const t = parseTriggers(readWorkflowText());
  assert.ok(t.push, 'le workflow ne se déclenche pas sur push');
  assert.ok(t.push.branches.includes('main'), `push doit cibler main, obtenu ${JSON.stringify(t.push.branches)}`);
  assert.ok(t.pull_request, 'le workflow ne se déclenche pas sur pull_request');
  assert.ok(parseSteps(readWorkflowText()).some((s) => s.run?.trim() === cmd().lint), 'le workflow de push/PR ne contient pas les vérifications');
});

test('critère 7 : given le fichier .github/workflows/ci.yml, when on le lit, then il ne contient plus l\'étape provisoire « No check is configured yet »', () => {
  const text = readWorkflowText();
  assert.doesNotMatch(text, /No check is configured yet/i);
  assert.doesNotMatch(text, /echo\s+["']?No check/i);
});

test('critère 7 : given le fichier .github/workflows/ci.yml, when on le lit, then il lance les commandes de la section « Commands » de CLAUDE.md', () => {
  const steps = parseSteps(readWorkflowText());
  exigeCinqEtapes(steps);
  for (const s of steps.filter((x) => x.run)) {
    assert.equal(s['continue-on-error'], undefined, `« ${s.run} » : continue-on-error ferait passer un échec`);
    assert.equal(s.if, undefined, `« ${s.run} » : une condition pourrait sauter l'étape`);
    assert.doesNotMatch(s.run, /\|\|\s*true|;\s*true\b|^\s*echo\b/m, `« ${s.run} » masque un échec ou ne vérifie rien`);
  }
});
