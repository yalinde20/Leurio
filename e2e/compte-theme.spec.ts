// US 92 : choisir le thème de l'app depuis Compte (PLAN §3, §11). Maquette : docs/maquettes/us-92-choisir-le-theme.html.
// Contenu réel ; tout service externe est coupé. Les couleurs attendues viennent de src/theme/tokens.scss (e2e/tokens.ts).
import { test, expect, type Page } from '@playwright/test';
import { lireThemes } from './tokens';
import { onboardingTermine } from './onboarding-helpers';
import { ouvrirEcran } from './dock-helpers';
import { estLocal } from './firebase-helpers';

test.use({ viewport: { width: 390, height: 844 } });

const CLE = 'leurio.theme';

function fonds(): { clair: string; sombre: string } {
  const themes = lireThemes();
  const rgb = (hex: string | undefined) => {
    if (!hex) throw new Error('--lr-fond introuvable dans src/theme/tokens.scss');
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  };
  return { clair: rgb(themes.clair['--lr-fond']), sombre: rgb(themes.sombre['--lr-fond']) };
}

const fondDe = async (page: Page) => {
  const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const contenu = await page.locator('ion-content:visible #background-content').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  return body === contenu ? body : `body ${body} ≠ ion-content ${contenu}`;
};

test.beforeEach(async ({ page }) => {
  await onboardingTermine(page);
  // Aucun service réel : tout ce qui n'est pas local est coupé.
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
});

async function ouvrirTheme(page: Page): Promise<void> {
  await page.goto('/');
  await ouvrirEcran(page, 'Compte');
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Compte');
  await expect(page.getByText('Réglages', { exact: true })).toBeVisible();
  await page.getByText('Thème', { exact: true }).first().click();
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Thème');
}

const option = (page: Page, nom: string) => page.getByRole('radio', { name: nom });

test("critère 1 : given je n'ai jamais changé le thème, when j'ouvre « Thème » dans Compte, then « Suivre le téléphone » est sélectionné parmi « Suivre le téléphone », « Clair » et « Sombre »", async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await ouvrirEcran(page, 'Compte');
  // La ligne « Thème » montre le choix courant.
  await expect(page.getByRole('link', { name: /Thème/ })).toContainText('Suivre le téléphone');
  await page.getByRole('link', { name: /Thème/ }).click();

  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Thème');
  await expect(page).toHaveURL(/\/compte\/theme$/);
  await expect(page.getByRole('radiogroup')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(option(page, 'Suivre le téléphone')).toBeChecked();
  await expect(option(page, 'Clair')).not.toBeChecked();
  await expect(option(page, 'Sombre')).not.toBeChecked();
  expect(await page.evaluate((k) => localStorage.getItem(k), CLE)).toBeNull();
});

test("critère 2 : given le téléphone est en mode sombre, when je choisis « Clair », then toute l'app passe en thème clair (page Thème et autres onglets)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await ouvrirTheme(page);
  expect(await fondDe(page)).toBe(fonds().sombre);

  await option(page, 'Clair').check({ force: true });
  await expect(option(page, 'Clair')).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('clair');
  await expect.poll(() => fondDe(page)).toBe(fonds().clair);
  expect(await page.evaluate((k) => localStorage.getItem(k), CLE)).toBe('clair');

  // Retour à Compte : la ligne affiche « Clair », le fond reste clair.
  await page.getByRole('button', { name: /Compte/ }).first().click();
  await expect(page.getByRole('link', { name: /Thème/ })).toContainText('Clair');
  expect(await fondDe(page)).toBe(fonds().clair);

  // Un autre onglet est aussi en thème clair, sans recharger.
  await ouvrirEcran(page, 'Conseil');
  await expect(page.locator('ion-content:visible').first()).toBeVisible();
  await expect.poll(() => fondDe(page)).toBe(fonds().clair);
});

test("critère 3 : given j'ai choisi « Sombre », when je relance l'app, then elle s'ouvre en thème sombre", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await ouvrirTheme(page);
  expect(await fondDe(page)).toBe(fonds().clair);
  await option(page, 'Sombre').check({ force: true });
  await expect.poll(() => fondDe(page)).toBe(fonds().sombre);

  // Rechargement.
  await page.reload();
  await expect(page.locator('ion-content:visible').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('sombre');
  expect(await fondDe(page)).toBe(fonds().sombre);

  // Nouvelle page du même contexte (même appareil), téléphone toujours en mode clair.
  const autre = await context.newPage();
  await autre.emulateMedia({ colorScheme: 'light' });
  await autre.goto('/');
  await expect(autre.locator('ion-content:visible').first()).toBeVisible();
  expect(await autre.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('sombre');
  expect(await fondDe(autre)).toBe(fonds().sombre);

  // La page Thème relue montre « Sombre » coché.
  await autre.getByRole('button', { name: 'Compte', exact: true }).click();
  await autre.getByRole('link', { name: /Thème/ }).click();
  await expect(option(autre, 'Sombre')).toBeChecked();
});

test("critère 4 : given « Suivre le téléphone » est choisi, when le téléphone passe du mode clair au mode sombre, then l'app passe en thème sombre sans redémarrer", async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await ouvrirTheme(page);
  // Un choix forcé d'abord, puis retour à « Suivre le téléphone » par la page.
  await option(page, 'Sombre').check({ force: true });
  await expect.poll(() => fondDe(page)).toBe(fonds().sombre);
  await option(page, 'Suivre le téléphone').check({ force: true });
  await expect(option(page, 'Suivre le téléphone')).toBeChecked();
  await expect.poll(() => fondDe(page)).toBe(fonds().clair);

  await page.evaluate(() => { (window as unknown as Record<string, number>)['__marqueur'] = 1; });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => fondDe(page)).toBe(fonds().sombre);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => fondDe(page)).toBe(fonds().clair);
  // Aucun rechargement : le marqueur posé avant le changement de mode est toujours là.
  expect(await page.evaluate(() => (window as unknown as Record<string, number>)['__marqueur'])).toBe(1);
});
