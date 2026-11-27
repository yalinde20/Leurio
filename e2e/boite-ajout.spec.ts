// US 99 : ajouter un leurre à ma boîte, sur les émulateurs (PLAN §3, §4, §7 : users/{uid}/tackleBox).
// Contrat du DOM : voir src/app/features/boite/boite.page.ajout.spec.ts (formulaire = [role="dialog"], champs par libellé).
// L'utilisateur anonyme est celui que l'app crée en silence (US 90) ; on attend son uid via window.leurioFirebase.
import { test, expect, type Page } from '@playwright/test';
import { EMULATEURS, PROJET, attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';
import { ouvrirEcran } from './dock-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await onboardingTermine(page);
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
});

async function ouvrirBoite(page: Page): Promise<string> {
  await page.goto('/');
  await attendreFirebase(page);
  // Le compte anonyme est créé par l'app elle-même (US 90) : on l'attend au lieu d'en ouvrir un second.
  const lireUid = () => page.evaluate(() => ((window as any).leurioFirebase.auth.currentUser?.uid ?? null) as string | null);
  await expect.poll(lireUid, { timeout: 20_000 }).not.toBeNull();
  const uid = (await lireUid())!;
  await ouvrirEcran(page, 'Boîte');
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Boîte');
  return uid;
}

/** Documents de users/{uid}/tackleBox lus sur l'émulateur (REST, jeton « owner »). */
async function leurresSurEmulateur(uid: string): Promise<Record<string, any>[]> {
  const r = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}/tackleBox`, {
    headers: { Authorization: 'Bearer owner' },
  });
  const corps = (await r.json()) as { documents?: { fields: Record<string, any> }[] };
  return (corps.documents ?? []).map((d) => d.fields);
}

const formulaire = (page: Page) => page.locator('[role="dialog"]');

async function remplir(page: Page, couleur = 'gardon') {
  await formulaire(page).getByLabel('Type').selectOption({ label: 'Shad' });
  await formulaire(page).getByLabel('Taille (cm)').fill('10');
  await formulaire(page).getByLabel('Poids (g)').fill('12');
  await formulaire(page).getByLabel('Couleur').fill(couleur);
  await formulaire(page).getByLabel('Marque (facultatif)').fill('Sakura');
}

test('critère 1 : given ma boîte est vide, when j\'ouvre l\'onglet « Boîte », then « Ta boîte est vide. » et le bouton « Ajouter un leurre » s\'affichent', async ({ page }) => {
  await ouvrirBoite(page);
  await expect(page.getByText('Ta boîte est vide.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter un leurre', exact: true })).toBeVisible();
});

test('critère 3 : given le formulaire rempli (type, 10 cm, 12 g, gardon), when je touche « Enregistrer », then le leurre est dans la liste et users/{uid}/tackleBox contient typeId, tailleCm, poidsG, couleur, marque et createdAt', async ({ page }) => {
  const uid = await ouvrirBoite(page);
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await remplir(page);
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();

  await expect(formulaire(page)).toHaveCount(0);
  const ligne = page.locator('li').first();
  await expect(ligne).toContainText('Shad');
  await expect(ligne).toContainText('10 cm · 12 g · gardon');
  await expect(ligne).toContainText('Sakura');

  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(1);
  const champs = (await leurresSurEmulateur(uid))[0];
  expect(Object.keys(champs).sort()).toEqual(['couleur', 'createdAt', 'marque', 'poidsG', 'tailleCm', 'typeId']);
  expect(champs['typeId'].stringValue).toBe('shad');
  expect(Number(champs['tailleCm'].integerValue ?? champs['tailleCm'].doubleValue)).toBe(10);
  expect(Number(champs['poidsG'].integerValue ?? champs['poidsG'].doubleValue)).toBe(12);
  expect(champs['couleur'].stringValue).toBe('gardon');
  expect(champs['marque'].stringValue).toBe('Sakura');
  expect(champs['createdAt']).toBeDefined();
});

test('critère 4 : given des champs vides, when je touche « Enregistrer », then rien n\'est enregistré et « Champ obligatoire » s\'affiche sous chaque champ vide', async ({ page }) => {
  const uid = await ouvrirBoite(page);
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire(page).getByText('Champ obligatoire')).toHaveCount(4);
  expect(await leurresSurEmulateur(uid)).toEqual([]);
});

test('critère 6 : given je n\'ai pas de réseau, when j\'enregistre un leurre, then il apparaît tout de suite avec la mention « Pas encore synchronisé… » et il est synchronisé au retour du réseau', async ({ page, context }) => {
  test.setTimeout(90_000);
  const uid = await ouvrirBoite(page);
  await expect(page.getByText('Ta boîte est vide.')).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await remplir(page, 'noir');
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();

  const ligne = page.locator('li').first();
  await expect(ligne).toContainText('10 cm · 12 g · noir');
  await expect(ligne).toContainText('Pas encore synchronisé : il le sera au retour du réseau.');

  await context.setOffline(false);
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(1);
  await expect(ligne).not.toContainText('Pas encore synchronisé');
});

test('critère 8 : given l\'onglet « Boîte » ou le formulaire affiché, when on mesure ses boutons, then chaque bouton mesure au moins 48 × 48 px', async ({ page }) => {
  await ouvrirBoite(page);
  await expect(page.getByText('Ta boîte est vide.')).toBeVisible();
  const mesurer = async (zone: ReturnType<Page['locator']>, contexte: string) => {
    const boutons = zone.getByRole('button');
    expect(await boutons.count(), `boutons (${contexte})`).toBeGreaterThan(0);
    for (const b of await boutons.all()) {
      if (!(await b.isVisible())) continue;
      const boite = await b.boundingBox();
      const nom = (await b.textContent())?.trim();
      expect(boite!.height, `hauteur de « ${nom} » (${contexte})`).toBeGreaterThanOrEqual(48);
      expect(boite!.width, `largeur de « ${nom} » (${contexte})`).toBeGreaterThanOrEqual(48);
    }
  };
  // Hors barre d'onglets (testée par l'US des onglets) : l'écran vide, la liste, puis le formulaire.
  await mesurer(page.locator('ion-content:visible'), 'boîte vide');
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await expect(formulaire(page)).toBeVisible();
  await mesurer(formulaire(page), 'formulaire');
  await remplir(page);
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire(page)).toHaveCount(0);
  await mesurer(page.locator('ion-content:visible'), 'liste');
});
