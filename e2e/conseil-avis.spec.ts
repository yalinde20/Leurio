import { test, expect, type Page } from '@playwright/test';
import { conseilAffiche, ouvrirAutresCoups, riviere } from './conseil-helpers';
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

const OUI = { name: "Oui, ce conseil m'a aidé" };

test('US 88 critère 2 : given le top 3 affiché, when je touche « 👍 » du coup 01 (vrai clic), then « Merci pour ton retour ! » s\'affiche à sa place, le détail ne s\'ouvre pas et les avis des coups 02 et 03 restent', async ({ page }) => {
  await ouvrirLApp(page);
  await conseilAffiche(page);
  const urlAvant = page.url();

  await riviere(page).getByRole('button', OUI).click();

  await expect(riviere(page).getByRole('status').filter({ hasText: 'Merci pour ton retour !' })).toBeVisible();
  await expect(riviere(page).getByRole('button', { name: /Oui, ce conseil/ })).toHaveCount(0);
  expect(page.url()).toBe(urlAvant);
  await expect(page).not.toHaveURL(/detail/);
  const feuille = await ouvrirAutresCoups(page);
  await expect(feuille.getByRole('button', OUI)).toHaveCount(2);
  await expect(feuille.getByText('Merci pour ton retour !')).toHaveCount(0);
});

test('US 88 critère 2 : given la feuille « 2 autres coups », when je touche « 👎 » du coup 02, then « Merci pour ton retour ! » remplace ses boutons et le détail ne s\'ouvre pas', async ({ page }) => {
  await ouvrirLApp(page);
  await conseilAffiche(page);
  const feuille = await ouvrirAutresCoups(page);
  const urlAvant = page.url();

  await feuille.getByRole('button', { name: "Non, ce conseil ne m'a pas aidé" }).first().click();

  await expect(feuille.getByRole('status').filter({ hasText: 'Merci pour ton retour !' })).toHaveCount(1);
  await expect(feuille.getByRole('button', { name: /ce conseil ne m'a pas aidé/ })).toHaveCount(1);
  expect(page.url()).toBe(urlAvant);
  await expect(page).not.toHaveURL(/detail/);
});
