// US 102 : « Retirer la photo » d'un leurre enregistré, sur les émulateurs : le champ photoUrl disparaît du document
// (deleteField) et le fichier disparaît de Storage. Contrat du DOM : voir e2e/boite-photo.spec.ts.
import { test, expect } from '@playwright/test';
import { EMULATEURS, PROJET, attendreFirebase, estLocal, photosLeurresActives } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.use({ viewport: { width: 390, height: 844 } });

const BUCKET = 'demo-leurio.appspot.test'; // storageBucket de src/app/core/firebase/config.ts

test.beforeEach(async ({ page }) => {
  await onboardingTermine(page);
  await photosLeurresActives(page);
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
});

test('given un leurre avec photo, when je touche « Retirer la photo » puis « Enregistrer », then le document n\'a plus de photoUrl et le fichier est supprimé du stockage', async ({ page }) => {
  await page.goto('/');
  await attendreFirebase(page);
  const lireUid = () => page.evaluate(() => ((window as any).leurioFirebase.auth.currentUser?.uid ?? null) as string | null);
  await expect.poll(lireUid, { timeout: 20_000 }).not.toBeNull();
  const uid = (await lireUid())!;
  await page.getByRole('tab', { name: 'Boîte', exact: true }).click();

  const leurres = async (): Promise<Record<string, any>[]> => {
    const r = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}/tackleBox`, {
      headers: { Authorization: 'Bearer owner' },
    });
    const corps = (await r.json()) as { documents?: { fields: Record<string, any> }[] };
    return (corps.documents ?? []).map((d) => d.fields);
  };
  const fichiers = async (): Promise<number> => {
    const r = await fetch(`http://127.0.0.1:${EMULATEURS.storage}/v0/b/${BUCKET}/o?prefix=${encodeURIComponent(`users/${uid}/lures/`)}`, {
      headers: { Authorization: 'Bearer owner' },
    });
    return (((await r.json()) as { items?: unknown[] }).items ?? []).length;
  };
  const formulaire = page.locator('[role="dialog"]').filter({ has: page.getByLabel('Couleur') });

  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await formulaire.getByLabel('Type').selectOption({ label: 'Shad' });
  await formulaire.getByLabel('Taille (cm)').fill('10');
  await formulaire.getByLabel('Poids (g)').fill('12');
  await formulaire.getByLabel('Couleur').fill('gardon');
  await formulaire.getByRole('button', { name: 'Ajouter une photo', exact: true }).click();
  const [selecteur] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Choisir dans la galerie', exact: true }).click(),
  ]);
  await selecteur.setFiles({
    name: 'p.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
  });
  await formulaire.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await leurres())[0]?.['photoUrl']?.stringValue, { timeout: 20_000 }).toBeTruthy();
  expect(await fichiers()).toBe(1);

  await page.locator('li button').first().click();
  await formulaire.getByRole('button', { name: 'Retirer la photo', exact: true }).click();
  await formulaire.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire).toHaveCount(0, { timeout: 30_000 });

  await expect.poll(async () => Object.keys((await leurres())[0] ?? {}).includes('photoUrl'), { timeout: 20_000 }).toBe(false);
  expect(Object.keys((await leurres())[0])).toContain('typeId');
  await expect.poll(fichiers, { timeout: 20_000 }).toBe(0);
  await expect(page.locator('li img')).toHaveCount(0);
});
