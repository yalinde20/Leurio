// US 4 : ajouter un spot privé, sur les émulateurs (PLAN §3, §4, §7 : users/{uid}/spots, §11 : un spot ajouté se synchronise au retour du réseau).
// Contrat du DOM : voir src/app/features/spots/spots.page.ajout.spec.ts (formulaire = [role="dialog"]).
import { test, expect, type Page } from '@playwright/test';
import { EMULATEURS, PROJET, attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await onboardingTermine(page);
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
});

const lireUid = (page: Page) => page.evaluate(() => ((window as any).leurioFirebase?.auth.currentUser?.uid ?? null) as string | null);
const formulaire = (page: Page) => page.locator('[role="dialog"]');
const ajouter = (page: Page) => page.getByRole('button', { name: 'Ajouter un spot', exact: true });

/** Ouvre l'app, attend le compte anonyme créé en silence (US 90) et ouvre l'onglet « Spots ». */
async function ouvrirSpots(page: Page): Promise<string> {
  await page.goto('/');
  await attendreFirebase(page);
  await expect.poll(() => lireUid(page), { timeout: 20_000 }).not.toBeNull();
  const uid = (await lireUid(page))!;
  await page.getByRole('tab', { name: 'Spots', exact: true }).click();
  await expect(ajouter(page)).toBeVisible();
  return uid;
}

/** Documents de users/{uid}/spots lus sur l'émulateur (REST, jeton « owner »). */
async function spotsSurEmulateur(uid: string): Promise<Record<string, any>[]> {
  const reponse = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}/spots`, {
    headers: { Authorization: 'Bearer owner' },
  });
  const contenu = (await reponse.json()) as { documents?: { fields: Record<string, any> }[] };
  return (contenu.documents ?? []).map((d) => d.fields);
}

async function remplir(page: Page, nom: string): Promise<void> {
  await formulaire(page).getByLabel('Nom').fill(nom);
  await formulaire(page).getByRole('radio', { name: '2e catégorie' }).click();
  await formulaire(page).getByRole('radio', { name: 'Rivière' }).click();
  // Le zoom France entière : le toucher au centre de la carte tombe en France.
  await formulaire(page).getByRole('region', { name: 'Position' }).click({ position: { x: 100, y: 100 } });
  await expect(formulaire(page).getByRole('status')).toContainText('Département :');
}

test('critère 5 : given un compte connecté, when j\'enregistre un spot, then il est dans la liste et écrit privé dans users/{uid}/spots', async ({ page }) => {
  const uid = await ouvrirSpots(page);
  await ajouter(page).click();
  await remplir(page, 'Pont de Cé');
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();

  await expect(formulaire(page)).toHaveCount(0);
  await expect(page.locator('ul li').filter({ hasText: 'Pont de Cé' })).toHaveCount(1);
  await expect.poll(async () => (await spotsSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(1);
  const champs = (await spotsSurEmulateur(uid))[0];
  expect(Object.keys(champs).sort()).toEqual(['categorie', 'departement', 'lat', 'lng', 'milieu', 'nom', 'prive']);
  expect(champs['nom'].stringValue).toBe('Pont de Cé');
  expect(champs['prive'].booleanValue).toBe(true);
  expect(champs['milieu'].stringValue).toBe('riviere');
});

test('critère 9 : given je n\'ai pas de réseau, when j\'enregistre un spot, then il apparaît avec « Pas encore synchronisé… » et il est synchronisé au retour du réseau', async ({ page, context }) => {
  test.setTimeout(90_000);
  const uid = await ouvrirSpots(page);
  await ajouter(page).click();
  await remplir(page, 'Hors ligne');
  await context.setOffline(true);
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();

  await expect(formulaire(page)).toHaveCount(0);
  const ligne = page.locator('ul li').filter({ hasText: 'Hors ligne' });
  await expect(ligne).toContainText('Pas encore synchronisé : il le sera au retour du réseau.');

  await context.setOffline(false);
  await expect.poll(async () => (await spotsSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(1);
  await expect(ligne).not.toContainText('Pas encore synchronisé');
});

test('given l\'onglet « Spots » ouvert avant que le compte anonyme existe, when le compte apparaît et que j\'enregistre un spot, then il apparaît dans la liste', async ({ page }) => {
  test.setTimeout(90_000);
  // Le compte anonyme est retardé : la liste s'ouvre sans utilisateur, puis doit suivre le compte qui arrive.
  let bloque = true;
  await page.route(/accounts:signUp/, async (route) => {
    while (bloque) await new Promise((r) => setTimeout(r, 200));
    await route.fallback();
  });
  await page.goto('/spots');
  await expect(ajouter(page)).toBeVisible({ timeout: 20_000 });
  expect(await lireUid(page)).toBeNull();
  bloque = false;
  await expect.poll(() => lireUid(page), { timeout: 20_000 }).not.toBeNull();
  const uid = (await lireUid(page))!;

  await ajouter(page).click();
  await remplir(page, 'Tardif');
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();

  await expect(formulaire(page)).toHaveCount(0);
  await expect(page.locator('ul li').filter({ hasText: 'Tardif' })).toHaveCount(1);
  await expect.poll(async () => (await spotsSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(1);
});

for (const theme of ['light', 'dark'] as const) {
  test(`given le formulaire d'ajout ouvert en thème ${theme}, when on mesure ses boutons et son champ, then ils mesurent au moins 48 px de haut`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await ouvrirSpots(page);
    await ajouter(page).click();
    await expect(formulaire(page)).toBeVisible();
    const cibles = formulaire(page).locator('button, input');
    expect(await cibles.count()).toBeGreaterThan(0);
    for (const c of await cibles.all()) {
      if (!(await c.isVisible())) continue;
      const boite = await c.boundingBox();
      const nom = (await c.textContent())?.trim() || (await c.getAttribute('placeholder'));
      expect(boite!.height, `hauteur de « ${nom} »`).toBeGreaterThanOrEqual(48);
      expect(boite!.width, `largeur de « ${nom} »`).toBeGreaterThanOrEqual(48);
    }
  });
}
