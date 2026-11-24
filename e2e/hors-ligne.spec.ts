// US 13 : indicateur « Hors ligne » en haut de chaque onglet (PLAN §3, §4). Maquette : docs/maquettes/us-13-indicateur-hors-ligne.html.
// Le mode avion est `context.setOffline(true)` ; le retour du réseau est `setOffline(false)` (événements `offline` / `online`), sans recharger.
// Aucun service réel : tout hôte non local est coupé, Hub'Eau et Open-Meteo aussi. Chaque onglet est visité une fois avec du réseau
// (les écrans sont chargés à la demande), puis on coupe le réseau et on repasse par les quatre onglets.
import { test, expect, type Page } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';
import { estLocal } from './firebase-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

test.beforeEach(async ({ page }) => {
  await onboardingTermine(page);
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
});

const ONGLETS = ['Conseil', 'Boîte', 'Spots', 'Compte'];
const onglet = (page: Page, nom: string) => page.getByRole('tab', { name: nom, exact: true });
const bandeau = (page: Page) => page.getByRole('status').filter({ hasText: /^\s*Hors ligne\s*$/ });

async function visiterLesOnglets(page: Page): Promise<void> {
  await page.goto('/');
  for (const nom of ONGLETS) {
    await onglet(page, nom).click();
    await expect(onglet(page, nom)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText(nom);
  }
}

const reseau = async (page: Page, coupe: boolean) => {
  await page.context().setOffline(coupe);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(!coupe);
};

test("critère 1 : given l'app ouverte avec du réseau, when le réseau est coupé, then un indicateur « Hors ligne » s'affiche en haut de chaque onglet (Conseil, Boîte, Spots, Compte)", async ({ page }) => {
  await visiterLesOnglets(page);
  await onglet(page, 'Conseil').click();
  await expect(bandeau(page)).toHaveCount(0);

  await reseau(page, true);
  for (const nom of ONGLETS) {
    await onglet(page, nom).click();
    await expect(page.locator('ion-toolbar ion-title:visible'), nom).toHaveText(nom);
    await expect(bandeau(page), `bandeau sur ${nom}`).toBeVisible();
    // En haut de l'écran : au-dessus de la barre de titre de la page, sans la recouvrir (l'écran est poussé vers le bas).
    const [b, barre] = await Promise.all([bandeau(page).boundingBox(), page.locator('ion-toolbar:visible').first().boundingBox()]);
    expect(b!.y + b!.height, `bandeau au-dessus de la barre de titre sur ${nom}, sans la recouvrir`).toBeLessThanOrEqual(barre!.y + 0.5);
  }
});

test("critère 2 : given l'indicateur « Hors ligne » affiché, when le réseau revient, then l'indicateur disparaît", async ({ page }) => {
  await visiterLesOnglets(page);
  await onglet(page, 'Conseil').click();
  await reseau(page, true);
  await expect(bandeau(page)).toBeVisible();

  await reseau(page, false);
  await expect(bandeau(page)).toHaveCount(0);
  for (const nom of ONGLETS) {
    await onglet(page, nom).click();
    await expect(page.locator('ion-toolbar ion-title:visible'), nom).toHaveText(nom);
    await expect(bandeau(page), `pas de bandeau sur ${nom}`).toHaveCount(0);
  }
});
