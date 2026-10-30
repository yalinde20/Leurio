import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

function fond(bloc: string): string {
  const m = /--lr-fond\s*:\s*#([0-9a-fA-F]{6})\s*;/.exec(bloc);
  if (!m) throw new Error('--lr-fond introuvable dans src/theme/tokens.scss');
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function fonds(): { clair: string; sombre: string } {
  // Lu dans chaque test : un fichier absent fait échouer le test, pas la collecte.
  const css = readFileSync('src/theme/tokens.scss', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const i = css.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/);
  if (i < 0) throw new Error('bloc @media (prefers-color-scheme: dark) introuvable');
  return { clair: fond(css.slice(0, i)), sombre: fond(css.slice(i)) };
}

// Ionic peint le body avec --ion-background-color ; on vérifie aussi le fond que voit l'utilisateur : celui de ion-content.
const fondBody = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const fondContenu = (page: import('@playwright/test').Page) =>
  page.locator('ion-content #background-content').evaluate((el) => getComputedStyle(el).backgroundColor);
const fondDe = async (page: import('@playwright/test').Page) => {
  const [body, contenu] = [await fondBody(page), await fondContenu(page)];
  return body === contenu ? body : `body ${body} ≠ ion-content ${contenu}`;
};

test('critère 0 : given un téléphone réglé en mode sombre, when on ouvre l\'app, then le thème sombre est appliqué : le fond a la valeur du token de fond sombre', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('ion-content')).toBeVisible();
  await expect.poll(() => fondDe(page)).toBe(fonds().sombre);
});

test('critère 1 : given un téléphone réglé en mode clair, when on ouvre l\'app, then le thème clair est appliqué : le fond a la valeur du token de fond clair', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('ion-content')).toBeVisible();
  await expect.poll(() => fondDe(page)).toBe(fonds().clair);
});

test('critère 2 : given l\'app ouverte en thème clair, when le téléphone passe en mode sombre, then le thème sombre s\'applique sans recharger la page, et inversement', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('ion-content')).toBeVisible();
  await expect.poll(() => fondDe(page)).toBe(fonds().clair);
  await page.evaluate(() => { (window as unknown as Record<string, number>)['__marqueur'] = 1; });

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => fondDe(page)).toBe(fonds().sombre);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => fondDe(page)).toBe(fonds().clair);

  expect(await page.evaluate(() => (window as unknown as Record<string, number>)['__marqueur'])).toBe(1);
});
