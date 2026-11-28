// US 101 : modifier ou supprimer un leurre de ma boîte, sur les émulateurs (PLAN §2.3, §4, §7 : users/{uid}/tackleBox).
// Contrat du DOM : voir src/app/features/boite/boite.page.modification.spec.ts et boite.page.ajout.spec.ts.
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
  const lireUid = () => page.evaluate(() => ((window as any).leurioFirebase.auth.currentUser?.uid ?? null) as string | null);
  await expect.poll(lireUid, { timeout: 20_000 }).not.toBeNull();
  const uid = (await lireUid())!;
  await ouvrirEcran(page, 'Boîte');
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Boîte');
  return uid;
}

async function leurresSurEmulateur(uid: string): Promise<Record<string, any>[]> {
  const r = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}/tackleBox`, {
    headers: { Authorization: 'Bearer owner' },
  });
  const corps = (await r.json()) as { documents?: { fields: Record<string, any> }[] };
  return (corps.documents ?? []).map((d) => d.fields);
}

const formulaire = (page: Page) => page.locator('[role="dialog"]');

async function ajouterUnLeurre(page: Page, uid: string) {
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await formulaire(page).getByLabel('Type').selectOption({ label: 'Shad' });
  await formulaire(page).getByLabel('Taille (cm)').fill('10');
  await formulaire(page).getByLabel('Poids (g)').fill('12');
  await formulaire(page).getByLabel('Couleur').fill('gardon');
  await formulaire(page).getByLabel('Marque (facultatif)').fill('Sakura');
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire(page)).toHaveCount(0);
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(1);
}

const ligneTouchable = (page: Page) => page.locator('li button').first();

test('critères 1 et 2 : given un leurre dans ma boîte, when je le touche, change sa taille et touche « Enregistrer », then la liste montre la nouvelle taille et le document est mis à jour', async ({ page }) => {
  const uid = await ouvrirBoite(page);
  await ajouterUnLeurre(page, uid);
  const avant = (await leurresSurEmulateur(uid))[0];

  await ligneTouchable(page).click();
  await expect(formulaire(page)).toContainText('Modifier le leurre');
  await expect(formulaire(page).getByLabel('Taille (cm)')).toHaveValue('10');
  await expect(formulaire(page).getByLabel('Couleur')).toHaveValue('gardon');
  await expect(formulaire(page).getByLabel('Marque (facultatif)')).toHaveValue('Sakura');
  await expect(formulaire(page).getByRole('button', { name: 'Supprimer', exact: true })).toBeVisible();
  await formulaire(page).getByLabel('Taille (cm)').fill('12');
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();

  await expect(formulaire(page)).toHaveCount(0);
  await expect(page.locator('li').first()).toContainText('12 cm · 12 g · gardon');
  await expect
    .poll(async () => Number((await leurresSurEmulateur(uid))[0]['tailleCm'].integerValue ?? (await leurresSurEmulateur(uid))[0]['tailleCm'].doubleValue), { timeout: 20_000 })
    .toBe(12);
  const apres = (await leurresSurEmulateur(uid))[0];
  expect(apres['createdAt']).toEqual(avant['createdAt']);
});

test('critères 3, 4 et 5 : given le formulaire d\'un leurre, when je touche « Supprimer », then la confirmation propose « Annuler » (le leurre reste) puis « Supprimer » (le leurre et son document disparaissent)', async ({ page }) => {
  const uid = await ouvrirBoite(page);
  await ajouterUnLeurre(page, uid);

  await ligneTouchable(page).click();
  await formulaire(page).getByRole('button', { name: 'Supprimer', exact: true }).click();
  const confirmation = page.locator('[role="alertdialog"]');
  await expect(confirmation).toContainText('Supprimer ce leurre ?');
  await confirmation.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(page.locator('li')).toHaveCount(1);
  expect((await leurresSurEmulateur(uid)).length).toBe(1);

  await formulaire(page).getByRole('button', { name: 'Supprimer', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(formulaire(page)).toHaveCount(0);
  await expect(page.locator('li')).toHaveCount(0);
  await expect(page.getByText('Ta boîte est vide.')).toBeVisible();
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(0);
});

test('critère 6 : given je n\'ai pas de réseau, when je modifie un leurre, then la liste change tout de suite avec « Pas encore synchronisé… » et la modification est synchronisée au retour du réseau', async ({ page, context }) => {
  test.setTimeout(90_000);
  const uid = await ouvrirBoite(page);
  await ajouterUnLeurre(page, uid);

  await context.setOffline(true);
  await ligneTouchable(page).click();
  await formulaire(page).getByLabel('Taille (cm)').fill('12');
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const ligne = page.locator('li').first();
  await expect(ligne).toContainText('12 cm · 12 g · gardon');
  await expect(ligne).toContainText('Pas encore synchronisé : il le sera au retour du réseau.');

  await context.setOffline(false);
  await expect
    .poll(async () => {
      const t = (await leurresSurEmulateur(uid))[0]['tailleCm'];
      return Number(t.integerValue ?? t.doubleValue);
    }, { timeout: 30_000 })
    .toBe(12);
  await expect(ligne).not.toContainText('Pas encore synchronisé');
});

test('critère 6 : given je n\'ai pas de réseau, when je supprime un leurre, then il disparaît tout de suite et son document est supprimé au retour du réseau', async ({ page, context }) => {
  test.setTimeout(90_000);
  const uid = await ouvrirBoite(page);
  await ajouterUnLeurre(page, uid);

  await context.setOffline(true);
  await ligneTouchable(page).click();
  await formulaire(page).getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.locator('li')).toHaveCount(0);

  await context.setOffline(false);
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(0);
});
