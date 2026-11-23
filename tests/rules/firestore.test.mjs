// US 34 : règles d'accès Firestore (PLAN §7), testées sur l'émulateur.
// Lancer avec : npm run test:rules (l'émulateur est démarré par firebase emulators:exec).
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ROOT } from '../helpers/run.mjs';

const PROJECT_ID = 'demo-leurio';
const RULES = join(ROOT, 'firestore.rules');

let env;

before(async () => {
  assert.ok(existsSync(RULES), 'firestore.rules est absent');
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'FIRESTORE_EMULATOR_HOST absent : lancer via npm run test:rules');
  env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules: readFileSync(RULES, 'utf8') } });
});

beforeEach(async () => { await env?.clearFirestore(); });
after(async () => { await env?.cleanup(); });

const A = 'alice';
const B = 'bob';
const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());

const profil = { niveau: 'debutant', especesFavorites: ['SAN', 'BRO'], consentements: { analytics: false, video: false }, createdAt: 1700000000000 };
const leurre = { typeId: 'shad', tailleCm: 9, poidsG: 14, couleur: 'naturel', createdAt: 1700000000000 };
const spot = { nom: 'Pont', lat: 47.2, lng: -1.5, categorie: 1, milieu: 'riviere', departement: '44', prive: true };
const conditions = { tempEau: 14, pression: 1015, vent: 'faible' };
const feedback = { conseilId: 'c1', typeId: 'shad', techniqueId: 'lent', utile: true, conditions, date: '2026-10-30' };

const chemins = {
  'users/A': (uid) => ['users', uid],
  'users/A/tackleBox/x': (uid) => ['users', uid, 'tackleBox', 'x'],
  'users/A/spots/y': (uid) => ['users', uid, 'spots', 'y'],
};
const donnees = { 'users/A': profil, 'users/A/tackleBox/x': leurre, 'users/A/spots/y': spot };

test('critère 1 : given un utilisateur connecté d\'uid A, when il lit puis écrit users/A, then les deux opérations sont acceptées', async () => {
  const ref = doc(db(A), 'users', A);
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(setDoc(ref, profil));
});

test('critère 2 : given un utilisateur connecté d\'uid A, when il lit puis écrit users/A/tackleBox/x et users/A/spots/y, then toutes les opérations sont acceptées', async () => {
  const d = db(A);
  const box = doc(d, 'users', A, 'tackleBox', 'x');
  const sp = doc(d, 'users', A, 'spots', 'y');
  await assertSucceeds(getDoc(box));
  await assertSucceeds(setDoc(box, leurre));
  await assertSucceeds(getDoc(sp));
  await assertSucceeds(setDoc(sp, spot));
});

for (const [nom, chemin] of Object.entries(chemins)) {
  test(`critère 3 : given un utilisateur connecté d'uid B, when il lit ou écrit ${nom}, then chaque opération est refusée`, async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), ...chemin(A)), donnees[nom]); });
    const ref = doc(db(B), ...chemin(A));
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, donnees[nom]));
    await assertFails(updateDoc(ref, { modifie: true }));
    await assertFails(deleteDoc(ref));
  });

  test(`critère 4 : given un visiteur non connecté, when il lit ou écrit ${nom}, then chaque opération est refusée`, async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), ...chemin(A)), donnees[nom]); });
    const ref = doc(db(null), ...chemin(A));
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, donnees[nom]));
    await assertFails(updateDoc(ref, { modifie: true }));
    await assertFails(deleteDoc(ref));
  });
}

test('critère 5 : given un utilisateur d\'uid A, when il écrit users/A avec niveau, especesFavorites, consentements, createdAt et plan, then l\'écriture est acceptée', async () => {
  await assertSucceeds(setDoc(doc(db(A), 'users', A), { ...profil, plan: 'gratuit' }));
});

test('critère 6 : given un utilisateur connecté, when il crée feedback/f avec conseilId, typeId, techniqueId, utile, conditions arrondies et date, then la création est acceptée', async () => {
  await assertSucceeds(setDoc(doc(db(A), 'feedback', 'f'), feedback));
});

test('critère 7 : given un utilisateur connecté, when il crée un feedback qui contient un champ uid, then la création est refusée', async () => {
  await assertFails(setDoc(doc(db(A), 'feedback', 'f'), { ...feedback, uid: A }));
});

for (const champ of ['lat', 'lng', 'latitude', 'longitude']) {
  test(`critère 8 : given un utilisateur connecté, when il crée un feedback avec le champ ${champ} à la racine, then la création est refusée`, async () => {
    await assertFails(setDoc(doc(db(A), 'feedback', 'f'), { ...feedback, [champ]: 47.2181 }));
  });

  test(`critère 8 : given un utilisateur connecté, when il crée un feedback avec le champ ${champ} dans conditions, then la création est refusée`, async () => {
    await assertFails(setDoc(doc(db(A), 'feedback', 'f'), { ...feedback, conditions: { ...conditions, [champ]: 47.2181 } }));
  });
}

test('critère 9 : given un feedback existant, when un utilisateur connecté le lit, le modifie ou le supprime, then chaque opération est refusée', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'feedback', 'f'), feedback); });
  for (const uid of [A, B]) {
    const ref = doc(db(uid), 'feedback', 'f');
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { ...feedback, utile: false }));
    await assertFails(updateDoc(ref, { utile: false }));
    await assertFails(deleteDoc(ref));
  }
});

test('critère 10 : given un visiteur non connecté, when il crée un feedback, then la création est refusée', async () => {
  await assertFails(setDoc(doc(db(null), 'feedback', 'f'), feedback));
});

for (const [col, id] of [['autre', 'doc'], ['admin', 'config']]) {
  test(`critère 11 : given la collection ${col} hors du modèle, when un utilisateur connecté la lit ou y écrit, then chaque opération est refusée`, async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), col, id), { a: 1 }); });
    const ref = doc(db(A), col, id);
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { a: 2 }));
    await assertFails(deleteDoc(ref));
  });
}

// US 90 : le profil écrit en silence à la fin de l'onboarding (forme de UserDoc) n'est accessible qu'à son propriétaire.
const profilAnonyme = { ...profil, plan: 'free' };

test('US 90 critère 6 : given les règles Firestore déployées et un profil users/A créé à l\'onboarding, when un autre utilisateur B tente de le lire ou de l\'écrire, then l\'opération est refusée', async () => {
  await assertSucceeds(setDoc(doc(db(A), 'users', A), profilAnonyme));
  const ref = doc(db(B), 'users', A);
  await assertFails(getDoc(ref));
  await assertFails(setDoc(ref, profilAnonyme));
  await assertFails(setDoc(ref, { ...profilAnonyme, niveau: 'intermediaire' }));
  await assertFails(updateDoc(ref, { plan: 'pro' }));
  await assertFails(deleteDoc(ref));
});

// US 88 : l'avis 👍 / 👎 d'un conseil (PLAN §7) : création seule, sans uid ni coordonnées, aucun champ inconnu.
const avis88 = { conseilId: 'shad:tiree', typeId: 'shad', techniqueId: 'tiree', utile: false, conditions: { tempEau: 12, vent: 14, debitTendance: 'normal', pressionTendance48h: -8, departement: '49' }, date: '2026-11-09T12:00:00.000Z' };

test('US 88 critère 6 : given les règles Firestore déployées, when un client connecté crée un feedback conforme à US 88, then la création est acceptée', async () => {
  await assertSucceeds(setDoc(doc(db(A), 'feedback', 'f88'), avis88));
});

for (const champ of ['uid', 'lat', 'lng', 'latitude', 'longitude', 'inconnu']) {
  test(`US 88 critère 6 : given les règles Firestore déployées, when un client crée un feedback contenant le champ ${champ}, then la création est refusée`, async () => {
    await assertFails(setDoc(doc(db(A), 'feedback', 'f88'), { ...avis88, [champ]: champ === 'uid' ? A : 47.2181 }));
  });
}

for (const champ of ['lat', 'lng', 'latitude', 'longitude', 'uid']) {
  test(`US 88 critère 6 : given les règles Firestore déployées, when un client crée un feedback dont conditions contient ${champ}, then la création est refusée`, async () => {
    await assertFails(setDoc(doc(db(A), 'feedback', 'f88'), { ...avis88, conditions: { ...avis88.conditions, [champ]: champ === 'uid' ? A : 47.2181 } }));
  });
}

test('US 88 critère 6 : given les règles Firestore déployées, when un client crée un feedback sans le champ utile, then la création est refusée', async () => {
  const { utile: _utile, ...sansUtile } = avis88;
  await assertFails(setDoc(doc(db(A), 'feedback', 'f88'), sansUtile));
});

test('US 88 critère 6 : given les règles Firestore déployées, when un client crée un feedback dont utile n\'est pas un booléen, then la création est refusée', async () => {
  await assertFails(setDoc(doc(db(A), 'feedback', 'f88'), { ...avis88, utile: 'oui' }));
});

test('US 88 critère 7 : given les règles Firestore déployées et un feedback existant, when un client tente de le lire, de le lister, de le modifier ou de le supprimer, then chaque opération est refusée', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'feedback', 'f88'), avis88); });
  for (const uid of [A, B, null]) {
    const ref = doc(db(uid), 'feedback', 'f88');
    await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(db(uid), 'feedback')));
    await assertFails(setDoc(ref, { ...avis88, utile: true }));
    await assertFails(updateDoc(ref, { utile: true }));
    await assertFails(deleteDoc(ref));
  }
});
