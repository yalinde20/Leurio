import { test, expect, type Page } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';

test.beforeEach(async ({ page }) => onboardingTermine(page));

// US 88 : l'avis 👍 / 👎 sur une carte du top 3, avec l'app réelle sur un téléphone (iPhone, 390 px).
// Aucun service réel : position simulée, Hub'Eau répond par un faux relevé, Open-Meteo est coupé.
test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MAINTENANT = new Date('2026-11-09T12:00:00Z');

async function ouvrirLApp(page: Page): Promise<void> {
  await page.clock.setFixedTime(MAINTENANT);
  await page.route('https://hubeau.eaufrance.fr/**', (route) => {
    if (!route.request().url().includes('/temperature/chronique')) return route.abort();
    return route.fulfill({
      json: {
        data: [
          {
            code_station: '04101000',
            libelle_station: 'La Maine à Angers',
            longitude: -0.5,
            latitude: 47.5,
            date_mesure_temp: MAINTENANT.toISOString().slice(0, 10),
            heure_mesure_temp: '06:00:00',
            resultat: 11.5,
          },
        ],
      },
    });
  });
  await page.route(/open-meteo\.com/, (route) => route.abort());
  await page.goto('/');
}

const cartesConseil = (page: Page) =>
  page.locator('section, article, ion-card').filter({ hasText: /Animation\s*:/ }).filter({ hasNot: page.locator('section, article, ion-card') });

test('US 88 critère 2 : given le top 3 affiché, when je touche « 👍 » de la carte 1 (vrai clic), then « Merci pour ton retour ! » s\'affiche sur cette carte et le détail ne s\'ouvre pas', async ({ page }) => {
  await ouvrirLApp(page);
  await expect(cartesConseil(page)).toHaveCount(3);
  const urlAvant = page.url();

  await cartesConseil(page).first().getByRole('button', { name: "Oui, ce conseil m'a aidé" }).click();

  await expect(cartesConseil(page).first().getByText('Merci pour ton retour !')).toBeVisible();
  await expect(cartesConseil(page).nth(1).getByText('Merci pour ton retour !')).toHaveCount(0);
  await expect(cartesConseil(page).first().getByRole('button', { name: /Oui, ce conseil/ })).toHaveCount(0);
  expect(page.url()).toBe(urlAvant);
  await expect(page).not.toHaveURL(/detail/);
  await expect(page.getByRole('heading', { name: 'Ton top 3' })).toBeVisible();
});
