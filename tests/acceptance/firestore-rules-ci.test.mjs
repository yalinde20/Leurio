// US 34, critère 12 : les tests des règles Firestore tournent en CI sur l'émulateur,
// sans appel au vrai projet, et un test en échec fait échouer le CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run, readPackageJson } from '../helpers/run.mjs';
import { parseSteps, parseTriggers } from '../helpers/workflow.mjs';

const WORKFLOW = '.github/workflows/firestore-rules.yml';

const texteWorkflow = () => {
  const f = join(ROOT, WORKFLOW);
  if (!existsSync(f)) throw new Error(`${WORKFLOW} est absent`);
  return readFileSync(f, 'utf8');
};

function commandeRegles() {
  const md = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const section = md.split(/^## /m).find((s) => s.startsWith('Commands')) ?? '';
  const m = section.match(/^- Tests des règles Firestore[^:\n]*:\s*`([^`]+)`/m);
  assert.ok(m, 'CLAUDE.md « ## Commands » ne documente pas la commande des tests des règles Firestore');
  return m[1];
}

const scriptRegles = () => {
  const s = readPackageJson().scripts?.['test:rules'];
  assert.ok(s, 'le script npm "test:rules" n\'existe pas');
  return s;
};

test('critère 12 : given CLAUDE.md, when on lit « Commands », then la commande des tests des règles est npm run test:rules', () => {
  assert.equal(commandeRegles(), 'npm run test:rules');
});

test('critère 12 : given une pull request, when le CI tourne, then le workflow des règles se déclenche sur pull_request', () => {
  assert.ok(parseTriggers(texteWorkflow()).pull_request, 'le workflow ne se déclenche pas sur pull_request');
});

test('critère 12 : given le workflow des règles, when on le lit, then Java est installé avant les tests et la commande de CLAUDE.md est lancée sans condition', () => {
  const steps = parseSteps(texteWorkflow());
  const iJava = steps.findIndex((s) => s.uses?.startsWith('actions/setup-java'));
  assert.notEqual(iJava, -1, 'actions/setup-java est absent (l\'émulateur demande Java)');
  const iTest = steps.findIndex((s) => s.run?.trim() === commandeRegles());
  assert.notEqual(iTest, -1, `aucune étape ne lance « ${commandeRegles()} »`);
  assert.ok(iJava < iTest, 'Java doit être installé avant les tests');
  const iInstall = steps.findIndex((s) => s.run?.trim() === 'npm ci');
  assert.ok(iInstall !== -1 && iInstall < iTest, 'npm ci doit précéder les tests');
  const s = steps[iTest];
  assert.equal(s['continue-on-error'], undefined, 'continue-on-error ferait passer un échec');
  assert.equal(s.if, undefined, 'l\'étape ne doit pas être conditionnelle');
  assert.doesNotMatch(s.run, /\|\||;\s*true/, 'l\'étape masque un échec');
});

test('critère 12 : given le script test:rules, when on le lit, then il utilise l\'émulateur Firestore avec un projet demo- et aucun vrai projet', () => {
  const s = scriptRegles();
  assert.match(s, /emulators:exec/);
  assert.match(s, /--only\s+firestore\b/);
  assert.match(s, /--project\s+demo-[\w-]+/);
  assert.doesNotMatch(s, /--token|GOOGLE_APPLICATION_CREDENTIALS/);
  const rc = join(ROOT, '.firebaserc');
  if (existsSync(rc)) {
    const defaut = JSON.parse(readFileSync(rc, 'utf8')).projects?.default;
    assert.ok(!defaut || defaut.startsWith('demo-'), `.firebaserc pointe vers un vrai projet : ${defaut}`);
  }
});

test('critère 12 : given firebase.json, when on le lit, then il déclare l\'émulateur Firestore et le fichier firestore.rules', () => {
  const f = join(ROOT, 'firebase.json');
  assert.ok(existsSync(f), 'firebase.json est absent');
  const cfg = JSON.parse(readFileSync(f, 'utf8'));
  const fs = Array.isArray(cfg.firestore) ? cfg.firestore[0] : cfg.firestore;
  assert.equal(fs?.rules, 'firestore.rules');
  assert.ok(cfg.emulators?.firestore, 'l\'émulateur firestore n\'est pas configuré dans emulators');
  assert.ok(existsSync(join(ROOT, 'firestore.rules')), 'firestore.rules est absent');
});

test('critère 12 : given les vraies règles, when on lance npm run test:rules, then les tests passent sur l\'émulateur', () => {
  scriptRegles();
  const r = run('npm', ['run', 'test:rules'], 600_000);
  assert.equal(r.status, 0, `npm run test:rules a échoué\n${r.output.slice(-3000)}`);
});

test('critère 12 : given une règle trop permissive, when on lance npm run test:rules, then la commande échoue (et fait donc échouer le CI)', () => {
  scriptRegles();
  const p = join(ROOT, 'firestore.rules');
  assert.ok(existsSync(p), 'firestore.rules est absent');
  const ancien = readFileSync(p, 'utf8');
  try {
    writeFileSync(p, "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}\n");
    const r = run('npm', ['run', 'test:rules'], 600_000);
    assert.notEqual(r.status, 0, 'des règles permissives auraient dû faire échouer les tests');
  } finally {
    writeFileSync(p, ancien);
  }
});
