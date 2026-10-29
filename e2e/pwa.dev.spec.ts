import { test, expect } from '@playwright/test';

test('critère 4 : given le serveur de développement, when on ouvre l\'app, then aucun service worker n\'est enregistré', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('ion-toolbar ion-title')).toHaveText('Leurio');
  await page.waitForTimeout(5000);

  const enregistrements = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 0;
    return (await navigator.serviceWorker.getRegistrations()).length;
  });
  expect(enregistrements).toBe(0);
});
