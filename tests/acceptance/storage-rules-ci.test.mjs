// US 35, critère 5 : les tests des règles Storage tournent en CI sur l'émulateur,
// sans appel au vrai projet, et un test en échec fait échouer le CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run, readPackageJson } from '../helpers/run.mjs';
import { parseSteps, parseTriggers } from '../helpers/workflow.mjs';

const WORKFLOW = '.github/workflows/firestore-rules.yml';

const texteWorkflow = () => {
  const f = join(ROOT, WORKFLOW);
  if (!existsSync(f)) throw new Error(`${WORKFLOW} est absent`);
  return readFileSync(f, 'utf8');
};

const scriptRegles = () => {
  const s = readPackageJson().scripts?.['test:rules'];
  assert.ok(s, 'le script npm "test:rules" n\'existe pas');
  return s;
};

test('critère 5 : given une pull request, when le CI tourne, then le workflow qui lance npm run test:rules se déclenche sur pull_request, sans condition', () => {
  const t = texteWorkflow();
  assert.ok(parseTriggers(t).pull_request, 'le workflow ne se déclenche pas sur pull_request');
  const s = parseSteps(t).find((st) => st.run?.trim() === 'npm run test:rules');
  assert.ok(s, 'aucune étape ne lance npm run test:rules');
  assert.equal(s['continue-on-error'], undefined);
  assert.equal(s.if, undefined);
});

test('critère 5 : given le script test:rules, when on le lit, then il démarre l\'émulateur Storage avec un projet demo- et aucun vrai projet', () => {
  const s = scriptRegles();
  assert.match(s, /emulators:exec/);
  assert.match(s, /--only\s+[\w,]*\bstorage\b/, 'l\'émulateur storage n\'est pas dans --only');
  assert.match(s, /--only\s+[\w,]*\bfirestore\b/, 'l\'émulateur firestore doit rester dans --only');
  assert.match(s, /--project\s+demo-[\w-]+/);
  assert.doesNotMatch(s, /--token|GOOGLE_APPLICATION_CREDENTIALS/);
});

test('critère 5 : given firebase.json, when on le lit, then il déclare storage.rules et l\'émulateur Storage', () => {
  const f = join(ROOT, 'firebase.json');
  assert.ok(existsSync(f), 'firebase.json est absent');
  const cfg = JSON.parse(readFileSync(f, 'utf8'));
  const st = Array.isArray(cfg.storage) ? cfg.storage[0] : cfg.storage;
  assert.equal(st?.rules, 'storage.rules');
  assert.ok(cfg.emulators?.storage, 'l\'émulateur storage n\'est pas configuré dans emulators');
  assert.ok(cfg.emulators?.firestore, 'l\'émulateur firestore doit rester configuré');
  assert.ok(existsSync(join(ROOT, 'storage.rules')), 'storage.rules est absent');
});

test('critère 5 : given les vraies règles, when on lance npm run test:rules, then les tests Storage passent sur l\'émulateur', () => {
  scriptRegles();
  assert.ok(existsSync(join(ROOT, 'tests/rules/storage.test.mjs')), 'tests/rules/storage.test.mjs est absent');
  const r = run('npm', ['run', 'test:rules'], 600_000);
  assert.equal(r.status, 0, `npm run test:rules a échoué\n${r.output.slice(-3000)}`);
  assert.match(r.output, /critère 4 : given un utilisateur connecté \(même le propriétaire A\)/, 'les tests Storage n\'ont pas tourné');
});

test('critère 5 : given une règle Storage trop permissive, when on lance npm run test:rules, then la commande échoue', () => {
  scriptRegles();
  const p = join(ROOT, 'storage.rules');
  assert.ok(existsSync(p), 'storage.rules est absent');
  const ancien = readFileSync(p, 'utf8');
  try {
    writeFileSync(p, "rules_version = '2';\nservice firebase.storage {\n  match /b/{bucket}/o {\n    match /{allPaths=**} {\n      allow read, write: if true;\n    }\n  }\n}\n");
    const r = run('npm', ['run', 'test:rules'], 600_000);
    assert.notEqual(r.status, 0, 'des règles permissives auraient dû faire échouer les tests');
    assert.match(r.output, /not ok .*critère 2 : given un utilisateur connecté d'uid B/, 'l\'échec ne vient pas des tests Storage');
  } finally {
    writeFileSync(p, ancien);
  }
});
