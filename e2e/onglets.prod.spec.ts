import { test, expect, type Page } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';

// US 89 : l'onboarding est terminé, l'app s'ouvre sur le Conseil (fixture, aucune assertion changée).
test.beforeEach(async ({ page }) => onboardingTermine(page));

// US 33 sur le build de production : une adresse d'onglet ouverte directement affiche cet onglet,
// y compris hors ligne une fois l'app en cache (fallback du serveur et du service worker).
const titreVisible = (page: Page) => page.locator('ion-toolbar ion-title:visible');

test('given le build de production, when on ouvre directement l\'adresse d\'un onglet, puis une autre sans réseau, then cet onglet s\'affiche', async ({ page, context }) => {
  await page.goto('/boite');
  await expect(titreVisible(page)).toHaveText('Boîte');

  // Un rechargement en ligne pour que le service worker contrôle la page et remplisse son cache.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller), { timeout: 30_000 }).toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          for (const nom of await caches.keys()) {
            const requetes = await (await caches.open(nom)).keys();
            if (requetes.some((r) => new URL(r.url).pathname === '/index.html')) return true;
          }
          return false;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);

  await context.setOffline(true);
  await page.goto('/spots');

  await expect(titreVisible(page)).toHaveText('Spots');
  await expect(page).toHaveURL(/\/spots$/);
});
