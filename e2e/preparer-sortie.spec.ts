import { test, expect, type Page } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';
import { estLocal } from './firebase-helpers';
import { conditionsAffichees, conseilAffiche, top3Affiche } from './conseil-helpers';

// US 14 : « Préparer ma sortie » depuis le Conseil (PLAN §3, §4). Maquette : docs/maquettes/us-14-preparer-ma-sortie.html.
// Aucun service réel : la position est simulée, Open-Meteo répond par une prévision heure par heure fabriquée ici,
// Hub'Eau est coupé, tout autre hôte non local aussi. Le mode avion est `context.setOffline(true)`.
// Le temps est fixé au 24/11/2026 à 9 h (Paris, 08:00Z) : la sortie préparée court jusqu'au 26/11 à 9 h.

test.beforeEach(async ({ page }) => onboardingTermine(page));

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MAINTENANT = new Date('2026-11-24T08:00:00Z');
const HEURE_MS = 3_600_000;

/** Prévision horaire GMT de maintenant − 96 h à maintenant + 96 h, quelle que soit la fenêtre demandée. */
function reponseOpenMeteo(url: URL) {
  const heures = Array.from({ length: 193 }, (_, i) => new Date(MAINTENANT.getTime() + (i - 96) * HEURE_MS));
  const gmt = (h: Date) => h.toISOString().slice(0, 13) + ':00';
  const serie = (f: (i: number) => number) => heures.map((_, i) => f(i));
  const valeurs = { temperature_2m: 8, cloud_cover: 60, wind_speed_10m: 9, pressure_msl: 1014 };
  if (url.searchParams.has('current')) return { current: valeurs };
  return {
    hourly: {
      time: heures.map(gmt),
      temperature_2m: serie(() => 8),
      cloud_cover: serie(() => 60),
      wind_speed_10m: serie(() => 9),
      pressure_msl: serie((i) => 1000 + (i % 30)),
    },
  };
}

async function ouvrirLApp(page: Page, requetesMeteo: string[] = []): Promise<void> {
  await page.clock.setFixedTime(MAINTENANT);
  await page.route((url) => !estLocal(url.toString()), (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'api.open-meteo.com') {
      requetesMeteo.push(url.toString());
      return route.fulfill({ json: reponseOpenMeteo(url) });
    }
    return route.abort();
  });
  await page.goto('/');
  await conditionsAffichees(page);
}

const boutonPreparer = (page: Page) => page.getByRole('navigation', { name: 'Navigation' }).getByRole('button', { name: /^Ma sortie$/ });
const reseau = async (page: Page, coupe: boolean) => {
  await page.context().setOffline(coupe);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(!coupe);
};

test("critère 1 : given l'écran Conseil avec du réseau et un lieu choisi, when l'utilisateur touche « Ma sortie », then « Sortie prête : conditions jusqu'au 26/11 à 9 h » s'affiche", async ({ page }) => {
  await ouvrirLApp(page);
  await expect(boutonPreparer(page)).toBeEnabled();

  await boutonPreparer(page).click();

  await expect(page.getByRole('status').filter({ hasText: "Sortie prête : conditions jusqu'au 26/11 à 9 h" })).toBeVisible();
});

test("critère 2 : given une sortie préparée puis le mode avion, when l'utilisateur choisit demain 12 h sur l'écran Conseil, then le top 3 s'affiche avec la mention « Conditions du 24/11 à 9 h »", async ({ page }) => {
  await ouvrirLApp(page);
  await boutonPreparer(page).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sortie prête' })).toBeVisible();

  await reseau(page, true);
  await page.getByRole('button', { name: /Moment/ }).first().click();
  const feuille = page.getByRole('dialog');
  await feuille.getByText('Demain', { exact: true }).click();
  await feuille.getByLabel('Heure').selectOption({ label: '12 h' });
  await feuille.getByRole('button', { name: 'Valider' }).click();

  await expect(page.getByText('Conditions du 24/11 à 9 h')).toBeVisible();
  await conseilAffiche(page);
  await top3Affiche(page);
  await expect(page.getByText('Conseil moins précis')).toHaveCount(0);
});

test("critère 4 : given l'appareil sans réseau, when l'utilisateur touche « Ma sortie », then rien n'est téléchargé et « Pas de réseau : prépare ta sortie avant de partir » s'affiche", async ({ page }) => {
  const requetesMeteo: string[] = [];
  await ouvrirLApp(page, requetesMeteo);
  await reseau(page, true);
  const avant = requetesMeteo.length;
  const tentatives: string[] = [];
  page.on('request', (r) => tentatives.push(r.url()));

  await boutonPreparer(page).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Pas de réseau : prépare ta sortie avant de partir' })).toBeVisible();
  expect(requetesMeteo.length).toBe(avant);
  expect(tentatives.filter((u) => u.includes('open-meteo'))).toEqual([]);
});
