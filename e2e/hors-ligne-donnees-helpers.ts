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

async function documents(uid: string, collection: 'spots' | 'tackleBox'): Promise<Record<string, any>[]> {
  const r = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}/${collection}`, {
    headers: { Authorization: `Bearer owner` },
  });
  const corps = (await r.json()) as { documents?: { fields: Record<string, any> }[] };
  return (corps.documents ?? []).map((d) => d.fields);
}
export const spotsSurEmulateur = (uid: string) => documents(uid, 'spots');
export const leurresSurEmulateur = (uid: string) => documents(uid, 'tackleBox');

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

/** Un second appareil : nouveau contexte (stockage vide), connecté au même compte par e-mail via le SDK de l'app (hook émulateurs). */
export async function ouvrirSecondAppareil(browser: Browser, id: Identifiants): Promise<{ page: Page; context: BrowserContext; uid: string }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await bloquerLeReseauExterne(context);
  const page = await context.newPage();
  await onboardingTermine(page);
  await page.goto('/');
  // L'app crée d'abord son compte anonyme en silence (US 90) : on s'y connecte après, sinon il remplacerait la session.
  await attendreCompte(page);
  const uid = await page.evaluate(async ({ email, motDePasse }) => {
    const f = (window as any).leurioFirebase;
    const r = await f.sdk.auth.signInWithEmailAndPassword(f.auth, email, motDePasse);
    return r.user.uid as string;
  }, id);
  return { page, context, uid };
}

export function identifiantsUniques(): Identifiants {
  return { email: `pecheur-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.fr`, motDePasse: 'carpe-123456' };
}

/**
 * L'utilisateur ouvre l'app une première fois avec du réseau, sur l'écran « Conseil » (sans visiter les écrans testés) :
 * le service worker s'active, contrôle la page (après un rechargement) et remplit son cache.
 */
export async function ouvrirUneFoisEnLigne(page: Page, base = ''): Promise<void> {
  await page.goto(`${base}/`);
  await expect(titreVisible(page)).toHaveText('Conseil');
  await page.evaluate(async () => {
    const prete = await navigator.serviceWorker.ready;
    const fin = Date.now() + 25_000;
    while (prete.active && prete.active.state !== 'activated' && Date.now() < fin) await new Promise((r) => setTimeout(r, 100));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller), { timeout: 30_000 }).toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          for (const nom of await caches.keys()) {
            const requetes = await (await caches.open(nom)).keys();
            if (requetes.some((r) => new URL(r.url).pathname === '/index.html')) return true;
          }
          return false;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

