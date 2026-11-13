// US 102 : ajouter une photo à un leurre, sur les émulateurs (PLAN §2.3, §4, §7 : users/{uid}/tackleBox, Storage users/{uid}/lures/).
// Contrat du DOM : voir src/app/features/boite/boite.page.photo.spec.ts. Sur le web, « Prendre une photo » et « Choisir dans la
// galerie » aboutissent à un sélecteur de fichier (`input[type=file][accept="image/*"]`, avec `capture` pour l'appareil photo).
import { test, expect, type Page } from '@playwright/test';
import { EMULATEURS, PROJET, attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.use({ viewport: { width: 390, height: 844 } });

const SEUIL_OCTETS = 200 * 1024;
const BUCKET = 'demo-leurio.appspot.test'; // storageBucket de src/app/core/firebase/config.ts

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
  await page.getByRole('tab', { name: 'Boîte', exact: true }).click();
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

/** Les fichiers de `users/{uid}/lures/` sur l'émulateur Storage, avec leur taille en octets. */
async function photosSurEmulateur(uid: string): Promise<{ name: string; size: number }[]> {
  const base = `http://127.0.0.1:${EMULATEURS.storage}/v0/b/${BUCKET}/o`;
  const entetes = { Authorization: 'Bearer owner' };
  const liste = await fetch(`${base}?prefix=${encodeURIComponent(`users/${uid}/lures/`)}`, { headers: entetes });
  const corps = (await liste.json()) as { items?: { name: string; size?: string }[] };
  const resultat: { name: string; size: number }[] = [];
  for (const item of corps.items ?? []) {
    let taille = item.size;
    if (taille === undefined) {
      const meta = (await (await fetch(`${base}/${encodeURIComponent(item.name)}`, { headers: entetes })).json()) as { size: string };
      taille = meta.size;
    }
    resultat.push({ name: item.name, size: Number(taille) });
  }
  return resultat;
}

/** Une image BMP 24 bits de bruit aléatoire : plusieurs Mo, incompressible sans réduction. */
function grosseImage(largeur = 1600, hauteur = 1200): Buffer {
  const ligne = Math.ceil((largeur * 3) / 4) * 4;
  const taillePixels = ligne * hauteur;
  const tampon = Buffer.alloc(54 + taillePixels);
  tampon.write('BM', 0, 'ascii');
  tampon.writeUInt32LE(tampon.length, 2);
  tampon.writeUInt32LE(54, 10);
  tampon.writeUInt32LE(40, 14);
  tampon.writeInt32LE(largeur, 18);
  tampon.writeInt32LE(hauteur, 22);
  tampon.writeUInt16LE(1, 26);
  tampon.writeUInt16LE(24, 28);
  tampon.writeUInt32LE(taillePixels, 34);
  for (let i = 54; i < tampon.length; i++) tampon[i] = Math.floor(Math.random() * 256);
  return tampon;
}

const formulaire = (page: Page) => page.locator('[role="dialog"]').filter({ has: page.getByLabel('Couleur') });

async function remplirFormulaire(page: Page) {
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await formulaire(page).getByLabel('Type').selectOption({ label: 'Shad' });
  await formulaire(page).getByLabel('Taille (cm)').fill('10');
  await formulaire(page).getByLabel('Poids (g)').fill('12');
  await formulaire(page).getByLabel('Couleur').fill('gardon');
}

/** Touche « Ajouter une photo », l'option donnée, et alimente le sélecteur de fichier. */
async function choisirPhoto(page: Page, option: 'Prendre une photo' | 'Choisir dans la galerie', image: Buffer) {
  await formulaire(page).getByRole('button', { name: 'Ajouter une photo', exact: true }).click();
  const [selecteur] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: option, exact: true }).click(),
  ]);
  await selecteur.setFiles({ name: 'leurre.bmp', mimeType: 'image/bmp', buffer: image });
  await expect(formulaire(page).locator('img[alt="Photo du leurre"]')).toBeVisible();
}

async function enregistrer(page: Page) {
  await formulaire(page).getByRole('button', { name: /^(Enregistrer|Envoi de la photo…)$/ }).click();
  await expect(formulaire(page)).toHaveCount(0, { timeout: 30_000 });
}

test('critère 1 : given le formulaire d\'un leurre ouvert, when je touche « Ajouter une photo », then je peux prendre une photo ou choisir dans la galerie, chacun ouvrant le sélecteur de fichier', async ({ page }) => {
  await ouvrirBoite(page);
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await formulaire(page).getByRole('button', { name: 'Ajouter une photo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Prendre une photo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choisir dans la galerie', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Annuler', exact: true }).last()).toBeVisible();

  const [selecteurGalerie] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Choisir dans la galerie', exact: true }).click(),
  ]);
  await selecteurGalerie.setFiles({ name: 'g.bmp', mimeType: 'image/bmp', buffer: grosseImage(64, 64) });
  await expect(formulaire(page).locator('img[alt="Photo du leurre"]')).toBeVisible();

  await formulaire(page).getByRole('button', { name: 'Changer la photo', exact: true }).click();
  const [selecteurCamera] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Prendre une photo', exact: true }).click(),
  ]);
  await selecteurCamera.setFiles({ name: 'c.bmp', mimeType: 'image/bmp', buffer: grosseImage(64, 64) });
  await expect(formulaire(page).locator('img[alt="Photo du leurre"]')).toBeVisible();
});

test('critère 2 : given j\'ai choisi une photo et enregistré le leurre, when la liste s\'affiche, then la photo apparaît en vignette et le document contient photoUrl', async ({ page }) => {
  const uid = await ouvrirBoite(page);
  await remplirFormulaire(page);
  await choisirPhoto(page, 'Choisir dans la galerie', grosseImage(400, 300));
  await enregistrer(page);

  const vignette = page.locator('li img[alt="Photo du leurre"]');
  await expect(vignette).toBeVisible();
  await expect.poll(() => vignette.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(1);
  const photoUrl = (await leurresSurEmulateur(uid))[0]['photoUrl']?.stringValue as string | undefined;
  expect(photoUrl).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):9199\//);
  expect(await vignette.getAttribute('src')).toBe(photoUrl);
  expect(await photosSurEmulateur(uid)).toHaveLength(1);
});

test('critère 3 : given la photo choisie pèse plusieurs Mo, when elle est envoyée, then le fichier stocké pèse 200 Ko au plus', async ({ page }) => {
  test.setTimeout(120_000);
  const uid = await ouvrirBoite(page);
  const image = grosseImage();
  expect(image.length).toBeGreaterThan(2 * 1024 * 1024);
  await remplirFormulaire(page);
  await choisirPhoto(page, 'Choisir dans la galerie', image);
  await enregistrer(page);

  await expect.poll(async () => (await photosSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(1);
  const [stockee] = await photosSurEmulateur(uid);
  expect(stockee.size).toBeGreaterThan(0);
  expect(stockee.size).toBeLessThanOrEqual(SEUIL_OCTETS);
});

test('critère 5 : given un leurre a une photo, when je le supprime, then sa photo est aussi supprimée du stockage', async ({ page }) => {
  const uid = await ouvrirBoite(page);
  await remplirFormulaire(page);
  await choisirPhoto(page, 'Choisir dans la galerie', grosseImage(400, 300));
  await enregistrer(page);
  await expect.poll(async () => (await photosSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(1);

  await page.locator('li button').first().click();
  await formulaire(page).getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.locator('li')).toHaveCount(0);

  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(0);
  await expect.poll(async () => (await photosSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(0);
});
