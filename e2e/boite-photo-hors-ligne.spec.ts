// US 102 (revue) : sans réseau, supprimer un leurre qui a une photo ne fait pas attendre l'écran (Storage réessaie longtemps).
// Contrat du DOM : voir e2e/boite-photo.spec.ts et e2e/boite-modification.spec.ts.
import { test, expect, type Page } from '@playwright/test';
import { EMULATEURS, PROJET, attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await onboardingTermine(page);
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
});

const formulaire = (page: Page) => page.locator('[role="dialog"]').filter({ has: page.getByLabel('Couleur') });

async function leurresSurEmulateur(uid: string): Promise<Record<string, any>[]> {
  const r = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}/tackleBox`, {
    headers: { Authorization: 'Bearer owner' },
  });
  const corps = (await r.json()) as { documents?: { fields: Record<string, any> }[] };
  return (corps.documents ?? []).map((d) => d.fields);
}

test('given je n\'ai pas de réseau, when je supprime un leurre qui a une photo, then il disparaît tout de suite et le formulaire se ferme sans attendre', async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await attendreFirebase(page);
  const lireUid = () => page.evaluate(() => ((window as any).leurioFirebase.auth.currentUser?.uid ?? null) as string | null);
  await expect.poll(lireUid, { timeout: 20_000 }).not.toBeNull();
  const uid = (await lireUid())!;
  await page.getByRole('tab', { name: 'Boîte', exact: true }).click();

  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await formulaire(page).getByLabel('Type').selectOption({ label: 'Shad' });
  await formulaire(page).getByLabel('Taille (cm)').fill('10');
  await formulaire(page).getByLabel('Poids (g)').fill('12');
  await formulaire(page).getByLabel('Couleur').fill('gardon');
  await formulaire(page).getByRole('button', { name: 'Ajouter une photo', exact: true }).click();
  const [selecteur] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Choisir dans la galerie', exact: true }).click(),
  ]);
  // Un GIF 1×1 : sous le seuil, il est envoyé tel quel.
  await selecteur.setFiles({
    name: 'p.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
  });
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire(page)).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(1);

  await context.setOffline(true);
  await page.locator('li button').first().click();
  await formulaire(page).getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.locator('li')).toHaveCount(0, { timeout: 5_000 });
  await expect(formulaire(page)).toHaveCount(0, { timeout: 5_000 });

  // Le réseau est toujours coupé : un nouveau leurre s'enregistre et le formulaire se ferme sans attendre la suppression du fichier.
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await formulaire(page).getByLabel('Type').selectOption({ label: 'Shad' });
  await formulaire(page).getByLabel('Taille (cm)').fill('8');
  await formulaire(page).getByLabel('Poids (g)').fill('9');
  await formulaire(page).getByLabel('Couleur').fill('perche');
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire(page)).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('li')).toHaveCount(1);

  await context.setOffline(false);
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(1);
});
