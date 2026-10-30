import { test, expect, type Page } from '@playwright/test';
import { lireThemes } from './tokens';

const CLE = 'leurio.theme';

function fonds(): { clair: { rgb: string; hex: string }; sombre: { rgb: string; hex: string } } {
  const themes = lireThemes();
  const fond = (hex: string | undefined) => {
    if (!hex) throw new Error('--lr-fond introuvable dans src/theme/tokens.scss');
    const n = parseInt(hex.slice(1), 16);
    return { hex, rgb: `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})` };
  };
  return { clair: fond(themes.clair['--lr-fond']), sombre: fond(themes.sombre['--lr-fond']) };
}

const fondDe = async (page: Page) => {
  const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const contenu = await page.locator('ion-content #background-content').evaluate((el) => getComputedStyle(el).backgroundColor);
  return body === contenu ? body : `body ${body} ≠ ion-content ${contenu}`;
};

const enregistrer = (page: Page, valeur: string) =>
  page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLE, valeur]);

/**
 * Bloque le bundle Angular : seul le script inline d'index.html peut alors avoir posé le thème.
 * Le bundle principal s'appelle main.js (dev) ou main-<hash>.js (build).
 */
const sansAngular = (page: Page) => page.route(/\/main[^/]*\.js(\?.*)?$/, (route) => route.abort());

const premierAffichage = (page: Page) =>
  page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    token: getComputedStyle(document.documentElement).getPropertyValue('--lr-fond').trim().toLowerCase(),
    fond: getComputedStyle(document.body).backgroundColor,
    angular: document.querySelector('app-root')?.childElementCount ?? 0,
  }));

test('critère 0 : given un premier lancement de l\'app sur un téléphone en mode sombre, when on ouvre l\'app, then le thème suit le téléphone (sombre)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('ion-content')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-theme'))).toBe(false);
  expect(await fondDe(page)).toBe(fonds().sombre.rgb);
  // L'app a posé le choix par défaut « système » ou n'a rien écrit : jamais un thème forcé.
  const stocke = await page.evaluate((k) => localStorage.getItem(k), CLE);
  expect([null, 'systeme']).toContain(stocke);
});

test('critère 1 : given un téléphone en mode sombre, when on choisit le thème clair, then le thème clair s\'applique aussitôt (fond clair)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await enregistrer(page, 'clair');
  await page.goto('/');
  await expect(page.locator('ion-content')).toBeVisible();
  expect(await fondDe(page)).toBe(fonds().clair.rgb);
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('clair');
});

test('critère 2 : given un téléphone en mode clair, when on choisit le thème sombre, then le thème sombre s\'applique aussitôt (fond sombre)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await enregistrer(page, 'sombre');
  await page.goto('/');
  await expect(page.locator('ion-content')).toBeVisible();
  expect(await fondDe(page)).toBe(fonds().sombre.rgb);
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('sombre');
});

test('critère 3 : given le thème forcé en clair, when le téléphone change de mode, then le thème reste clair', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await enregistrer(page, 'clair');
  await page.goto('/');
  await expect(page.locator('ion-content')).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(300);
  expect(await fondDe(page)).toBe(fonds().clair.rgb);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(100);
  expect(await fondDe(page)).toBe(fonds().clair.rgb);
});

test('critère 4 : given le thème forcé en sombre, when on revient au choix « système », then le thème suit de nouveau le téléphone, sans recharger', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await enregistrer(page, 'sombre');
  await page.goto('/');
  await expect(page.locator('ion-content')).toBeVisible();
  expect(await fondDe(page)).toBe(fonds().sombre.rgb);
  await page.evaluate(() => { (window as unknown as Record<string, number>)['__marqueur'] = 1; });

  // Le service retire l'attribut de <html> quand le choix est « système » : les tokens suivent alors prefers-color-scheme.
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await expect.poll(() => fondDe(page)).toBe(fonds().clair.rgb);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => fondDe(page)).toBe(fonds().sombre.rgb);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => fondDe(page)).toBe(fonds().clair.rgb);
  expect(await page.evaluate(() => (window as unknown as Record<string, number>)['__marqueur'])).toBe(1);
});

test('critère 5 : given le thème forcé en sombre, when on relance l\'app sur un téléphone en mode clair, then le thème sombre est appliqué dès le premier affichage', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await enregistrer(page, 'sombre');
  await sansAngular(page);
  await page.goto('/', { waitUntil: 'load' });
  // Angular n'a pas démarré : seul le script inline a pu poser le thème.
  const r = await premierAffichage(page);
  expect(r.angular).toBe(0);
  expect(r.theme).toBe('sombre');
  expect(r.token).toBe(fonds().sombre.hex);
  expect(r.fond).toBe(fonds().sombre.rgb);
});

test('critère 5 (clair) : given le thème forcé en clair, when on relance l\'app sur un téléphone en mode sombre, then le thème clair est appliqué dès le premier affichage', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await enregistrer(page, 'clair');
  await sansAngular(page);
  await page.goto('/', { waitUntil: 'load' });
  const r = await premierAffichage(page);
  expect(r.angular).toBe(0);
  expect(r.theme).toBe('clair');
  expect(r.token).toBe(fonds().clair.hex);
  expect(r.fond).toBe(fonds().clair.rgb);
});

for (const illisible of ['violet', '', '{"theme":"clair"}']) {
  test(`critère 6 : given un choix de thème enregistré illisible ou inconnu (« ${illisible} »), when on lance l'app sur un téléphone en mode sombre, then le choix vaut « système » et le thème suit le téléphone`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await enregistrer(page, illisible);
    await page.goto('/');
    await expect(page.locator('ion-content')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-theme'))).toBe(false);
    expect(await fondDe(page)).toBe(fonds().sombre.rgb);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => fondDe(page)).toBe(fonds().clair.rgb);
  });
}
