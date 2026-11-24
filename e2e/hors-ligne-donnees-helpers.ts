// US 16 : aides communes aux tests e2e « boîte et spots hors ligne » (dev et prod).
// Le mode avion est `context.setOffline(true)` : il coupe aussi les émulateurs locaux (Firestore, Auth).
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { EMULATEURS, PROJET, attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const lireUid = (page: Page) => page.evaluate(() => ((window as any).leurioFirebase?.auth.currentUser?.uid ?? null) as string | null);
export const formulaire = (page: Page) => page.locator('[role="dialog"]');
export const titreVisible = (page: Page) => page.locator('ion-toolbar ion-title:visible');

/** Aucun service réel : seules les adresses locales passent. */
export async function bloquerLeReseauExterne(context: BrowserContext): Promise<void> {
  await context.route((url) => !estLocal(url.toString()), (route) => route.abort());
}

export async function modeAvion(page: Page, actif: boolean): Promise<void> {
  await page.context().setOffline(actif);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(!actif);
}

export async function attendreCompte(page: Page): Promise<string> {
  await attendreFirebase(page);
  await expect.poll(() => lireUid(page), { timeout: 20_000 }).not.toBeNull();
  return (await lireUid(page))!;
}

export const onglet = (page: Page, nom: 'Conseil' | 'Boîte' | 'Spots' | 'Compte') => page.getByRole('tab', { name: nom, exact: true }).click();

export async function ouvrirOnglet(page: Page, nom: 'Boîte' | 'Spots'): Promise<void> {
  await onglet(page, nom);
  await expect(titreVisible(page)).toHaveText(nom);
}

async function documents(uid: string, collection: 'spots' | 'tackleBox', jeton = 'owner'): Promise<Record<string, any>[]> {
  const r = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}/${collection}`, {
    headers: { Authorization: `Bearer ${jeton}` },
  });
  const corps = (await r.json()) as { documents?: { fields: Record<string, any> }[] };
  return (corps.documents ?? []).map((d) => d.fields);
}
export const spotsSurEmulateur = (uid: string, jeton?: string) => documents(uid, 'spots', jeton);
export const leurresSurEmulateur = (uid: string, jeton?: string) => documents(uid, 'tackleBox', jeton);

export async function ajouterSpot(page: Page, nom: string): Promise<void> {
  await page.getByRole('button', { name: 'Ajouter un spot', exact: true }).click();
  await formulaire(page).getByLabel('Nom').fill(nom);
  await formulaire(page).getByRole('radio', { name: '2e catégorie' }).click();
  await formulaire(page).getByRole('radio', { name: 'Rivière' }).click();
  await formulaire(page).getByRole('region', { name: 'Position' }).click({ position: { x: 100, y: 100 } });
  await expect(formulaire(page).getByRole('status')).toContainText('Département :');
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire(page)).toHaveCount(0);
}

export async function ajouterLeurre(page: Page, couleur: string): Promise<void> {
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await formulaire(page).getByLabel('Type').selectOption({ label: 'Shad' });
  await formulaire(page).getByLabel('Taille (cm)').fill('10');
  await formulaire(page).getByLabel('Poids (g)').fill('12');
  await formulaire(page).getByLabel('Couleur').fill(couleur);
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire(page)).toHaveCount(0);
}

export const ligneSpot = (page: Page, nom: string) => page.locator('ul li').filter({ hasText: nom });
export const ligneLeurre = (page: Page, couleur: string) => page.locator('ul li').filter({ hasText: couleur });

export interface Identifiants {
  email: string;
  motDePasse: string;
}

/** L'utilisateur lie son compte anonyme à une adresse e-mail depuis « Compte » (US 96) : même uid. */
export async function lierAUnEmail(page: Page, id: Identifiants): Promise<void> {
  await onglet(page, 'Compte');
  await page.getByRole('button', { name: /Continuer avec l['’]e-mail/ }).click();
  await page.locator('input[type="email"]').fill(id.email);
  await page.locator('input[type="password"]').fill(id.motDePasse);
  await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click();
  await expect(page.getByText(/Connecté avec l['’]e-mail/)).toBeVisible({ timeout: 20_000 });
}

/**
 * Un second appareil connecté au même compte : nouveau contexte (stockage vide) où la session de l'émulateur Auth
 * (connexion e-mail + mot de passe) est posée dans le stockage d'Auth avant l'ouverture de l'app.
 */
export async function ouvrirSecondAppareil(browser: Browser, id: Identifiants, uid: string): Promise<{ page: Page; context: BrowserContext; jeton: string }> {
  const r = await fetch(`http://127.0.0.1:${EMULATEURS.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: id.email, password: id.motDePasse, returnSecureToken: true }),
  });
  const s = (await r.json()) as { localId: string; idToken: string; refreshToken: string; expiresIn: string };
  expect(s.localId, 'même compte que le premier appareil').toBe(uid);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await bloquerLeReseauExterne(context);
  const page = await context.newPage();
  await onboardingTermine(page);
  await page.route('**/__session', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>session</title>' }));
  await page.goto('/__session');
  await page.evaluate(
    ({ s, email }) =>
      new Promise<void>((ok, ko) => {
        const ouverture = indexedDB.open('firebaseLocalStorageDb', 1);
        ouverture.onupgradeneeded = () => ouverture.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
        ouverture.onerror = () => ko(ouverture.error);
        ouverture.onsuccess = () => {
          const tx = ouverture.result.transaction('firebaseLocalStorage', 'readwrite');
          tx.objectStore('firebaseLocalStorage').put({
            fbase_key: 'firebase:authUser:demo-api-key:[DEFAULT]',
            value: {
              uid: s.localId,
              email,
              emailVerified: false,
              isAnonymous: false,
              providerData: [{ providerId: 'password', uid: email, displayName: null, email, phoneNumber: null, photoURL: null }],
              stsTokenManager: { refreshToken: s.refreshToken, accessToken: s.idToken, expirationTime: Date.now() + Number(s.expiresIn) * 1000 },
              createdAt: String(Date.now()),
              lastLoginAt: String(Date.now()),
              apiKey: 'demo-api-key',
              appName: '[DEFAULT]',
            },
          });
          tx.oncomplete = () => ok();
          tx.onerror = () => ko(tx.error);
        };
      }),
    { s, email: id.email },
  );
  return { page, context, jeton: s.idToken };
}

export function identifiantsUniques(): Identifiants {
  return { email: `pecheur-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.fr`, motDePasse: 'carpe-123456' };
}
