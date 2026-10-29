import { test, expect } from '@playwright/test';

test('critère 0 : given l\'app démarrée, when on ouvre la page, then une page Ionic vide titrée « Leurio » s\'affiche sans erreur dans la console', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(e.message));

  await page.goto('/');

  await expect(page.locator('ion-toolbar ion-title')).toHaveText('Leurio');
  await expect(page.locator('ion-content')).toBeVisible();
  expect(erreurs).toEqual([]);
});
