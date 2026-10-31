// US 36 : où vit la commande de build « émulateurs » (hypothèse de conception A, à ajuster
// ici seulement si le propriétaire tranche autrement).
//
// Pourquoi `Build` pointe vers build:emulateurs : `npm run build` exige maintenant les variables
// FIREBASE_* (critère 5). Les tests existants (commands.test.mjs, ci.test.mjs) exécutent, sans variable,
// la commande que CLAUDE.md appelle « Build » et exigent que ci.yml la lance telle quelle.
// La commande « Build » de CLAUDE.md doit donc être celle qui n'a besoin d'aucune variable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readPackageJson } from '../helpers/run.mjs';
import { readWorkflowText, parseSteps } from '../helpers/workflow.mjs';

function sectionCommands() {
  const md = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  return md.split(/^## /m).find((s) => s.startsWith('Commands')) ?? '';
}

function commandes() {
  const out = {};
  for (const m of sectionCommands().matchAll(/^- ([^:\n]+?)\s*:\s*`([^`]+)`/gm)) out[m[1]] = m[2];
  return out;
}

test('critère 4 : given CLAUDE.md, when on lit « ## Commands », then la commande npm run build:emulateurs est documentée et le script existe', () => {
  const lignes = sectionCommands().split('\n').filter((l) => l.includes('`npm run build:emulateurs`'));
  assert.equal(lignes.length, 1, 'CLAUDE.md « ## Commands » doit documenter `npm run build:emulateurs` (une ligne)');
  assert.ok(readPackageJson().scripts?.['build:emulateurs'], 'le script npm "build:emulateurs" n\'existe pas');
});

test('critère 5 : given CLAUDE.md, when on lit « ## Commands », then le build de production réel (`npm run build`) est documenté avec les variables FIREBASE_* qu\'il exige', () => {
  const ligne = sectionCommands().split('\n').find((l) => /`npm run build`/.test(l));
  assert.ok(ligne, 'CLAUDE.md doit documenter `npm run build` (production réelle)');
  assert.match(ligne, /FIREBASE_/, 'la ligne de `npm run build` doit dire qu\'il exige les variables FIREBASE_*');
});

test('critère 4 : given CLAUDE.md, when on lit la commande « Build », then c\'est npm run build:emulateurs (la seule qui ne demande aucune variable)', () => {
  assert.equal(commandes()['Build'], 'npm run build:emulateurs');
});

test('critère 4 : given le workflow ci.yml, when on le lit, then son étape Build lance npm run build:emulateurs et aucune étape ne lance npm run build sans variables', () => {
  const steps = parseSteps(readWorkflowText());
  assert.ok(steps.some((s) => s.run?.trim() === 'npm run build:emulateurs'), 'ci.yml ne lance pas npm run build:emulateurs');
  assert.ok(!steps.some((s) => s.run?.trim() === 'npm run build'), 'ci.yml ne doit pas lancer `npm run build` : les variables FIREBASE_* n\'y sont pas (aucun secret dans le dépôt)');
});

test('critère 4 : given la configuration Playwright, when on la lit, then le serveur du build de production utilise npm run build:emulateurs et les émulateurs Firebase sont démarrés', () => {
  const conf = readFileSync(join(ROOT, 'playwright.config.ts'), 'utf8');
  assert.match(conf, /npm run build:emulateurs/);
  assert.doesNotMatch(conf, /npm run build(?!:)/, 'playwright.config.ts ne doit pas lancer `npm run build`');
  assert.match(conf, /firebase emulators:start[^'"`]*auth[^'"`]*firestore[^'"`]*storage/);
});

test('critère 1 : given firebase.json, when on le lit, then les émulateurs Auth (9099), Firestore (8080) et Storage (9199) sont configurés sur 127.0.0.1', () => {
  const conf = JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8'));
  const e = conf.emulators ?? {};
  assert.deepEqual([e.auth?.port, e.firestore?.port, e.storage?.port], [9099, 8080, 9199]);
  for (const s of ['auth', 'firestore', 'storage']) assert.equal(e[s]?.host, '127.0.0.1', `l'émulateur ${s} doit écouter sur 127.0.0.1`);
  assert.ok(conf.storage?.rules, 'firebase.json doit déclarer les règles Storage (storage.rules, PLAN §5)');
});
