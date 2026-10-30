import { test, expect } from '@playwright/test';

test('critère 4 : given le serveur de développement, when on ouvre l\'app, then aucun service worker n\'est enregistré', async ({ page }) => {
  // Compte les tentatives d'enregistrement : un 404 sur ngsw-worker.js ne doit pas masquer un register() appelé.
  await page.addInitScript(() => {
    const w = window as unknown as { __registerAppels: number };
    w.__registerAppels = 0;
    if (!('serviceWorker' in navigator)) return;
    const original = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (...args: Parameters<ServiceWorkerContainer['register']>) => {
      w.__registerAppels++;
      return original(...args);
    };
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Conseil');

  const { appels, enregistrements } = await page.evaluate(async () => {
    const appels = (window as unknown as { __registerAppels: number }).__registerAppels;
    if (!('serviceWorker' in navigator)) return { appels, enregistrements: 0 };
    return { appels, enregistrements: (await navigator.serviceWorker.getRegistrations()).length };
  });
  expect(appels).toBe(0);
  expect(enregistrements).toBe(0);
});
