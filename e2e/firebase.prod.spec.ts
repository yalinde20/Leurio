// US 36 : le build de production en configuration émulateurs (npm run build:emulateurs)
// se connecte, lui aussi, aux émulateurs et à eux seuls.
import { test, expect } from '@playwright/test';
import { EMULATEURS, PROJET, attendreFirebase, enregistrerRequetes, exigerAucuneRequeteExterne, lireSurEmulateur, profil, requetesVers } from './firebase-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test('critère 1 : given le build de production en configuration émulateurs, when l\'app démarre, then Auth, Firestore et Storage pointent vers les émulateurs locaux et aucune requête ne part vers le vrai projet', async ({ page }) => {
  const urls = enregistrerRequetes(page);
  await page.goto('/');
  await attendreFirebase(page);
  const etat = await page.evaluate(async (profilDoc) => {
    const f = (window as any).leurioFirebase;
    const { user } = await f.sdk.auth.signInAnonymously(f.auth);
    await f.sdk.firestore.setDoc(f.sdk.firestore.doc(f.db, 'users', user.uid), profilDoc);
    await f.sdk.storage.uploadString(f.sdk.storage.ref(f.storage, `users/${user.uid}/sonde.txt`), 'sonde').catch(() => undefined);
    return { uid: user.uid as string, projectId: f.app.options.projectId, authEmulateur: f.auth.emulatorConfig?.port ?? null };
  }, profil);
  expect(etat.projectId).toBe(PROJET);
  expect(etat.authEmulateur).toBe(EMULATEURS.auth);
  for (const port of Object.values(EMULATEURS)) expect(requetesVers(urls, port).length, `requêtes vers le port ${port}`).toBeGreaterThan(0);
  await exigerAucuneRequeteExterne(urls);
  expect((await lireSurEmulateur(etat.uid)).status).toBe(200);
});

test('critère 4 : given le build de production en configuration émulateurs, when l\'app démarre, then App Check est activé en mode débogage', async ({ page }) => {
  const urls = enregistrerRequetes(page);
  await page.goto('/');
  await attendreFirebase(page);
  const r = await page.evaluate(async () => {
    const f = (window as any).leurioFirebase;
    const res = f.appCheck ? await f.sdk.appCheck.getToken(f.appCheck) : null;
    return { debug: !!(self as any).FIREBASE_APPCHECK_DEBUG_TOKEN, actif: !!f.appCheck, token: res?.token ?? '', erreur: res?.error ? String(res.error) : null };
  });
  expect(r.debug).toBe(true);
  expect(r.actif).toBe(true);
  expect(r.erreur).toBeNull();
  expect(r.token.length).toBeGreaterThan(0);
  await exigerAucuneRequeteExterne(urls);
});
