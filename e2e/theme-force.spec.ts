import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const CLE = 'leurio.theme';

function blocs() {
  const css = readFileSync('src/theme/tokens.scss', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const i = css.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/);
  if (i < 0) throw new Error('bloc @media (prefers-color-scheme: dark) introuvable');
  return { clair: css.slice(0, i), sombre: css.slice(i) };
}
function fond(bloc: string): { rgb: string; hex: string } {
  const m = /--lr-fond\s*:\s*(#[0-9a-fA-F]{6})\s*;/.exec(bloc);
  if (!m) throw new Error('--lr-fond introuvable dans src/theme/tokens.scss');
  const n = parseInt(m[1].slice(1), 16);
  return { hex: m[1].toLowerCase(), rgb: `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})` };
}
const fonds = () => ({ clair: fond(blocs().clair), sombre: fond(blocs().sombre) });

const fondDe = async (page: Page) => {
  const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const contenu = await page.locator('ion-content #background-content').evaluate((el) => getComputedStyle(el).backgroundColor);
  return body === contenu ? body : `body ${body} ≠ ion-content ${contenu}`;
};

const enregistrer = (page: Page, valeur: string) =>
  page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLE, valeur]);

/** Relève la valeur du token --lr-fond au premier affichage, avant que l'application Angular ne démarre. */
const relevePremierAffichage = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const releve = () => {
      if (w['__premier']) return;
      const v = getComputedStyle(document.documentElement).getPropertyValue('--lr-fond').trim().toLowerCase();
      if (v) w['__premier'] = v;
    };
    document.addEventListener('readystatechange', releve);
    document.addEventListener('DOMContentLoaded', releve);
  });
const premier = (page: Page) => page.evaluate(() => (window as unknown as Record<string, string>)['__premier']);

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
  await relevePremierAffichage(page);
  await page.goto('/');
  // Valeur relevée avant le démarrage d'Angular : pas de flash de thème clair.
  expect(await premier(page)).toBe(fonds().sombre.hex);
  await expect(page.locator('ion-content')).toBeVisible();
  expect(await fondDe(page)).toBe(fonds().sombre.rgb);
});

test('critère 5 (clair) : given le thème forcé en clair, when on relance l\'app sur un téléphone en mode sombre, then le thème clair est appliqué dès le premier affichage', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await enregistrer(page, 'clair');
  await relevePremierAffichage(page);
  await page.goto('/');
  expect(await premier(page)).toBe(fonds().clair.hex);
  await expect(page.locator('ion-content')).toBeVisible();
  expect(await fondDe(page)).toBe(fonds().clair.rgb);
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
