import { test, expect, type Page } from '@playwright/test';

// US 24 : un visiteur ouvre leurio.app/accueil (ici le build servi par serve-dist, qui imite Firebase Hosting avec cleanUrls).
// Aucun appel réseau réel : les liens des stores sont servis par page.route, et les URL des stores sont interceptées.
const PLAY = 'https://play.google.com/store/apps/details?id=app.leurio';
const APPLE = 'https://apps.apple.com/fr/app/leurio/id0000000000';
const BTN_PLAY = 'Disponible sur Google Play';
const BTN_APPLE = "Télécharger dans l'App Store";

async function bloquerStores(page: Page) {
  await page.route(/^https:\/\/(play\.google\.com|apps\.apple\.com)\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>store</title>' }));
}
// La page statique d'accueil est affichée (et non le repli vers l'app Angular).
async function pageStatique(page: Page) {
  await expect(page.locator('app-root')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quel leurre, quelle animation, maintenant, ici ?');
}
async function stores(page: Page, corps: unknown) {
  await page.route('**/stores.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) }));
}

test('critère 1 : given un visiteur, when il ouvre /accueil, then il voit la page statique avec l\'accroche et les 5 points clés, pas l\'app Angular', async ({ page }) => {
  const reponse = await page.goto('/accueil');

  expect(reponse?.status()).toBe(200);
  expect(reponse?.headers()['content-type']).toContain('text/html');
  await expect(page.locator('app-root')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quel leurre, quelle animation, maintenant, ici ?');
  for (const point of ['Le conseil du moment', 'La fiche animation', 'Ta boîte à leurres', 'Tes spots', 'Fonctionne hors ligne']) {
    await expect(page.getByText(point, { exact: true })).toBeVisible();
  }
});

test('critère 2 : given la page d\'accueil, when le visiteur touche « Ouvrir l\'app », then la PWA Leurio s\'ouvre (app Angular à la racine)', async ({ page }) => {
  await page.goto('/accueil');
  const lien = page.getByRole('link', { name: "Ouvrir l'app" }).first();
  const boite = await lien.boundingBox();
  expect(boite?.height).toBeGreaterThanOrEqual(48);

  await lien.click();

  await expect(page).toHaveURL(/localhost:4300\/(#.*)?$/);
  await expect(page.locator('app-root')).toHaveCount(1);
});

test('critère 3 : given la page d\'accueil, when le visiteur touche « Politique de confidentialité », then la politique en ligne s\'ouvre', async ({ page }) => {
  await page.goto('/accueil');

  await page.getByRole('link', { name: 'Politique de confidentialité' }).click();

  await expect(page).toHaveURL(/\/confidentialite$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
});

test('critère 4 : given des liens vers les stores non encore renseignés (stores.json committé), when le visiteur ouvre la page, then aucun bouton de store n\'est affiché', async ({ page }) => {
  await page.goto('/accueil');
  await pageStatique(page);

  await expect(page.getByRole('link', { name: BTN_PLAY })).toHaveCount(0);
  await expect(page.getByRole('link', { name: BTN_APPLE })).toHaveCount(0);
  await expect(page.getByText(BTN_PLAY)).toBeHidden();
  await expect(page.getByText(BTN_APPLE)).toBeHidden();
});

test('critère 4 : given un stores.json introuvable (404), when le visiteur ouvre la page, then aucun bouton de store n\'est affiché', async ({ page }) => {
  await page.route('**/stores.json', (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }));
  await page.goto('/accueil');
  await pageStatique(page);

  await expect(page.getByRole('link', { name: BTN_PLAY })).toHaveCount(0);
  await expect(page.getByRole('link', { name: BTN_APPLE })).toHaveCount(0);
});

test('critère 4 : given des liens vides ou un stores.json illisible, when le visiteur ouvre la page, then aucun bouton de store n\'est affiché', async ({ page }) => {
  await page.route('**/stores.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{pas du json' }));
  await page.goto('/accueil');
  await pageStatique(page);

  await expect(page.getByRole('link', { name: BTN_PLAY })).toHaveCount(0);
  await expect(page.getByRole('link', { name: BTN_APPLE })).toHaveCount(0);
});

test('critère 5 : given des liens vers le Play Store et l\'App Store renseignés, when le visiteur ouvre la page, then les deux boutons s\'affichent et ouvrent les fiches correspondantes', async ({ page }) => {
  await bloquerStores(page);
  await stores(page, { appStore: APPLE, googlePlay: PLAY });
  await page.goto('/accueil');

  const play = page.getByRole('link', { name: BTN_PLAY });
  const apple = page.getByRole('link', { name: BTN_APPLE });
  await expect(play).toBeVisible();
  await expect(apple).toBeVisible();
  await expect(play).toHaveAttribute('href', PLAY);
  await expect(apple).toHaveAttribute('href', APPLE);

  await play.click();
  await expect(page).toHaveURL(PLAY);
  await page.goBack();
  await page.getByRole('link', { name: BTN_APPLE }).click();
  await expect(page).toHaveURL(APPLE);
});

test('critère 5 : given un seul lien de store renseigné, when le visiteur ouvre la page, then seul son bouton s\'affiche', async ({ page }) => {
  await stores(page, { appStore: '', googlePlay: PLAY });
  await page.goto('/accueil');

  await expect(page.getByRole('link', { name: BTN_PLAY })).toBeVisible();
  await expect(page.getByRole('link', { name: BTN_APPLE })).toHaveCount(0);
});

test('critère 6 : given le téléphone en thème sombre puis en thème clair, when le visiteur ouvre la page, then la page suit le thème du téléphone', async ({ page }) => {
  const fond = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/accueil');
  await pageStatique(page);
  expect(await fond()).toBe('rgb(14, 23, 20)'); // #0e1714

  await page.emulateMedia({ colorScheme: 'light' });
  expect(await fond()).toBe('rgb(247, 243, 234)'); // #f7f3ea
});
