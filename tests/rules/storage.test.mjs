// US 35 : règles d'accès Storage pour les photos de leurres (PLAN §4, §5, §7), testées sur l'émulateur.
// Lancer avec : npm run test:rules (les émulateurs sont démarrés par firebase emulators:exec).
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ROOT } from '../helpers/run.mjs';

const PROJECT_ID = 'demo-leurio';
const RULES = join(ROOT, 'storage.rules');

let env;

before(async () => {
  assert.ok(existsSync(RULES), 'storage.rules est absent');
  assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 'FIREBASE_STORAGE_EMULATOR_HOST absent : lancer via npm run test:rules (--only firestore,storage)');
  env = await initializeTestEnvironment({ projectId: PROJECT_ID, storage: { rules: readFileSync(RULES, 'utf8') } });
});

beforeEach(async () => { await env?.clearStorage(); });
after(async () => { await env?.cleanup(); });

const A = 'alice';
const B = 'bob';
const store = (uid) => (uid ? env.authenticatedContext(uid).storage() : env.unauthenticatedContext().storage());
const octets = () => new Uint8Array([1, 2, 3, 4]);
const seed = (chemin) => env.withSecurityRulesDisabled(async (ctx) => { await uploadBytes(ref(ctx.storage(), chemin), octets()); });

const photoDeA = `users/${A}/lures/shad.jpg`;
const horsDossier = {
  'users/A/autre.jpg': `users/${A}/autre.jpg`,
  'users/A/spots/x.jpg': `users/${A}/spots/x.jpg`,
  'users/A/lures (sans sous-dossier de fichier) : users/A/luresx/x.jpg': `users/${A}/luresx/x.jpg`,
  'fichier à la racine': 'racine.jpg',
  'autre dossier de premier niveau': 'public/x.jpg',
  'users/x.jpg': 'users/x.jpg',
};

test('critère 1 : given un utilisateur connecté d\'uid A, when il envoie puis lit une photo dans users/A/lures, then les deux opérations sont acceptées', async () => {
  const r = ref(store(A), photoDeA);
  await assertSucceeds(uploadBytes(r, octets()));
  await assertSucceeds(getBytes(r));
});

test('critère 2 : given un utilisateur connecté d\'uid B, when il lit ou envoie une photo dans users/A/lures, then chaque opération est refusée', async () => {
  await seed(photoDeA);
  const r = ref(store(B), photoDeA);
  await assertFails(getBytes(r));
  await assertFails(uploadBytes(r, octets()));
  await assertFails(deleteObject(r));
  await assertFails(uploadBytes(ref(store(B), `users/${A}/lures/nouvelle.jpg`), octets()));
});

test('critère 3 : given un visiteur non connecté, when il lit ou envoie une photo de leurre, then l\'opération est refusée', async () => {
  await seed(photoDeA);
  const r = ref(store(null), photoDeA);
  await assertFails(getBytes(r));
  await assertFails(uploadBytes(r, octets()));
  await assertFails(deleteObject(r));
  await assertFails(uploadBytes(ref(store(null), `users/${A}/lures/nouvelle.jpg`), octets()));
});

for (const [nom, chemin] of Object.entries(horsDossier)) {
  test(`critère 4 : given un utilisateur connecté (même le propriétaire A), when il lit ou écrit ${nom}, then chaque opération est refusée`, async () => {
    await seed(chemin);
    for (const uid of [A, B]) {
      const r = ref(store(uid), chemin);
      await assertFails(getBytes(r));
      await assertFails(uploadBytes(r, octets()));
    }
  });
}
