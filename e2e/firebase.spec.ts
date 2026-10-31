// US 36 : Firebase dans l'app, sur les émulateurs (serveur de développement = « environnement de test »).
// Les émulateurs Auth, Firestore et Storage sont démarrés par playwright.config.ts.
//
// Contrat observable que l'app doit offrir, seulement quand elle tourne sur les émulateurs :
//   window.leurioFirebase = {
//     app, auth, db, storage, appCheck,            // les instances Firebase de l'app
//     sdk: {                                        // les fonctions du SDK utilisées par l'app
//       auth: { signInAnonymously },                // firebase/auth
//       firestore: { doc, getDoc, setDoc, waitForPendingWrites },  // firebase/firestore
//       storage: { ref, uploadString },             // firebase/storage
//       appCheck: { getToken },                     // firebase/app-check
//     },
//   };
//   window.FIREBASE_APPCHECK_DEBUG_TOKEN est défini (mode débogage d'App Check).
import { test, expect } from '@playwright/test';
import { EMULATEURS, PROJET, attendreFirebase, enregistrerRequetes, exigerAucuneRequeteExterne, lireSurEmulateur, profil, requetesVers } from './firebase-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test('critère 1 : given l\'environnement de test, when l\'app démarre, then Auth, Firestore et Storage pointent vers les émulateurs locaux et aucune requête ne part vers le vrai projet', async ({ page }) => {
  const urls = enregistrerRequetes(page);
  await page.goto('/');
  await attendreFirebase(page);

  const etat = await page.evaluate(async (profilDoc) => {
    const f = (window as any).leurioFirebase;
    const cred = await f.sdk.auth.signInAnonymously(f.auth);
    const uid = cred.user.uid;
    await f.sdk.firestore.setDoc(f.sdk.firestore.doc(f.db, 'users', uid), profilDoc);
    // Storage : l'émulateur peut refuser selon les règles ; seule la destination de la requête compte ici.
    await f.sdk.storage.uploadString(f.sdk.storage.ref(f.storage, `users/${uid}/sonde.txt`), 'sonde').catch(() => undefined);
    return { uid, projectId: f.app.options.projectId, authEmulateur: f.auth.emulatorConfig?.port ?? null };
  }, profil);

  expect(etat.projectId).toBe(PROJET);
  expect(etat.authEmulateur).toBe(EMULATEURS.auth);
  expect(requetesVers(urls, EMULATEURS.auth).length, 'requêtes vers l\'émulateur Auth').toBeGreaterThan(0);
  expect(requetesVers(urls, EMULATEURS.firestore).length, 'requêtes vers l\'émulateur Firestore').toBeGreaterThan(0);
  expect(requetesVers(urls, EMULATEURS.storage).length, 'requêtes vers l\'émulateur Storage').toBeGreaterThan(0);
  await exigerAucuneRequeteExterne(urls);

  // Le document est bien arrivé sur l'émulateur, pas sur un vrai projet.
  const sur = await lireSurEmulateur(etat.uid);
  expect(sur.status).toBe(200);
});

test('critère 2 : given un utilisateur de test connecté sur l\'émulateur qui a écrit son document users/{uid}, when le réseau est coupé et qu\'on relit ce document, then il est rendu depuis le cache local', async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await attendreFirebase(page);
  const uid = await page.evaluate(async (profilDoc) => {
    const f = (window as any).leurioFirebase;
    const { user } = await f.sdk.auth.signInAnonymously(f.auth);
    const ref = f.sdk.firestore.doc(f.db, 'users', user.uid);
    await f.sdk.firestore.setDoc(ref, profilDoc);
    const enLigne = await f.sdk.firestore.getDoc(ref);
    if (enLigne.metadata.fromCache) throw new Error('la lecture en ligne ne devrait pas venir du cache');
    return user.uid as string;
  }, profil);

  // Le rechargement vide la mémoire : seul un cache persistant (IndexedDB) peut encore avoir le document.
  await page.reload();
  await attendreFirebase(page);
  // Playwright coupe tout le réseau du contexte, y compris localhost : les émulateurs deviennent injoignables.
  await context.setOffline(true);

  const lu = await page.evaluate(async (id) => {
    const f = (window as any).leurioFirebase;
    const snap = await f.sdk.firestore.getDoc(f.sdk.firestore.doc(f.db, 'users', id));
    return { existe: snap.exists(), donnees: snap.data(), depuisCache: snap.metadata.fromCache };
  }, uid);

  expect(lu.depuisCache).toBe(true);
  expect(lu.existe).toBe(true);
  expect(lu.donnees).toEqual(profil);
});

test('critère 3 : given un utilisateur de test connecté sur l\'émulateur, when il écrit son document users/{uid} réseau coupé puis que le réseau revient, then le document est présent sur l\'émulateur', async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await attendreFirebase(page);
  const uid = await page.evaluate(async () => {
    const f = (window as any).leurioFirebase;
    const { user } = await f.sdk.auth.signInAnonymously(f.auth);
    return user.uid as string;
  });

  await context.setOffline(true);
  // setDoc ne se résout qu'avec l'accusé du serveur : on ne l'attend pas tant qu'on est hors ligne.
  await page.evaluate(
    ({ id, doc }) => {
      const f = (window as any).leurioFirebase;
      (window as any).__ecriture = f.sdk.firestore.setDoc(f.sdk.firestore.doc(f.db, 'users', id), doc);
    },
    { id: uid, doc: profil },
  );

  // Hors ligne, le document n'est pas encore sur l'émulateur.
  expect((await lireSurEmulateur(uid)).status).toBe(404);

  await context.setOffline(false);
  await page.evaluate(async () => {
    const f = (window as any).leurioFirebase;
    await (window as any).__ecriture;
    await f.sdk.firestore.waitForPendingWrites(f.db);
  });

  const sur = await lireSurEmulateur(uid);
  expect(sur.status).toBe(200);
  expect(sur.body.fields).toMatchObject({ niveau: { stringValue: 'debutant' }, plan: { stringValue: 'free' } });
});

test('critère 4 : given l\'environnement de test, when l\'app démarre, then App Check est activé en mode débogage et l\'app fonctionne avec les émulateurs', async ({ page }) => {
  const urls = enregistrerRequetes(page);
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.goto('/');
  await attendreFirebase(page);

  const appCheck = await page.evaluate(async () => {
    const f = (window as any).leurioFirebase;
    const debug = (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN;
    const resultat = f.appCheck ? await f.sdk.appCheck.getToken(f.appCheck) : null;
    return { debug: !!debug, actif: !!f.appCheck, token: resultat?.token ?? '', erreur: resultat?.error ? String(resultat.error) : null };
  });
  expect(appCheck.debug, 'FIREBASE_APPCHECK_DEBUG_TOKEN doit être défini (mode débogage)').toBe(true);
  expect(appCheck.actif, 'App Check doit être initialisé').toBe(true);
  expect(appCheck.erreur).toBeNull();
  expect(appCheck.token.length).toBeGreaterThan(0);

  // L'app fonctionne avec les émulateurs, sans appel au service App Check réel.
  const uid = await page.evaluate(async (profilDoc) => {
    const f = (window as any).leurioFirebase;
    const { user } = await f.sdk.auth.signInAnonymously(f.auth);
    await f.sdk.firestore.setDoc(f.sdk.firestore.doc(f.db, 'users', user.uid), profilDoc);
    return user.uid as string;
  }, profil);
  expect((await lireSurEmulateur(uid)).status).toBe(200);
  await exigerAucuneRequeteExterne(urls);
  expect(erreurs).toEqual([]);
});
