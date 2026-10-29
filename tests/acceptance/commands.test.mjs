import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run, readPackageJson } from '../helpers/run.mjs';

function commandsSection() {
  const md = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const m = md.match(/^## Commands\s*\n([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m);
  assert.ok(m, 'section "## Commands" introuvable');
  return m[1];
}

const EXIGENCES = [
  ['installation', /install/i],
  ['lint', /lint/i],
  ['type check', /type\s*check|typecheck|types?/i],
  ['tests', /test/i],
  ['build', /build/i],
];

test('critère 8 : given CLAUDE.md, when on lit "## Commands", then les commandes réelles d\'installation, lint, type check, tests et build sont données et réussissent sur le projet neuf', () => {
  const section = commandsSection();
  const pkg = readPackageJson();
  const commandes = {};
  for (const [nom, re] of EXIGENCES) {
    // première ligne de la section qui parle du sujet et contient une commande
    const ligne = section.split('\n').find((l) => re.test(l) && /`[^`]+`/.test(l));
    assert.ok(ligne, `la section Commands ne donne pas de commande pour : ${nom}`);
    commandes[nom] = ligne.match(/`([^`]+)`/)[1].trim();
  }
  assert.equal(commandes.installation, 'npm ci');
  assert.ok(existsSync(join(ROOT, 'package-lock.json')), 'package-lock.json absent');
  for (const nom of ['lint', 'type check', 'tests', 'build']) {
    const m = commandes[nom].match(/^npm (?:run )?([\w:-]+)$/);
    assert.ok(m, `commande npm attendue pour ${nom} : ${commandes[nom]}`);
    assert.ok(pkg.scripts?.[m[1]], `le script npm "${m[1]}" n'existe pas`);
  }
  for (const nom of ['lint', 'type check', 'tests', 'build']) {
    const [cmd, ...args] = commandes[nom].split(/\s+/);
    const r = run(cmd, args, 900_000);
    assert.equal(r.status, 0, `${commandes[nom]} a échoué : ${r.output}`);
  }
});
