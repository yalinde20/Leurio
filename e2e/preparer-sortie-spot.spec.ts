import { test, expect, type Page } from '@playwright/test';
import { attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';
import { ouvrirEcran } from './dock-helpers';

// US 15 : « Préparer ma sortie » depuis un spot (PLAN §3, §4). Maquette : docs/maquettes/us-15-preparer-ma-sortie-spot.html.
// Spot créé par l'interface (émulateurs, comme spots-ajout.spec.ts). Aucun service réel : Open-Meteo répond par une prévision
// heure par heure fabriquée ici, tout autre hôte non local est coupé. Le mode avion est `context.setOffline(true)`.
// Le temps est fixé au 24/11/2026 à 9 h (Paris, 08:00Z) : la sortie préparée court jusqu'au 26/11 à 9 h.

test.beforeEach(async ({ page }) => onboardingTermine(page));
// Position accordée : à l'ouverture, l'onglet d'accueil « Conseil » calcule son conseil en ligne, comme pour un vrai
// utilisateur ; il charge alors le contenu du moteur (assets/data). En production, le service worker le précache (US 12) ;
// le projet [dev] n'a pas de service worker, d'où ce premier affichage en ligne avant d'aller sur « Spots ».
test.use({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 47.47, longitude: -0.55 }, permissions: ['geolocation'] });

const MAINTENANT = new Date('2026-11-24T08:00:00Z');
const HEURE_MS = 3_600_000;

/** Prévision horaire GMT de maintenant − 96 h à maintenant + 96 h, quelle que soit la fenêtre demandée. */
function reponseOpenMeteo(url: URL) {
  const heures = Array.from({ length: 193 }, (_, i) => new Date(MAINTENANT.getTime() + (i - 96) * HEURE_MS));
  const gmt = (h: Date) => h.toISOString().slice(0, 13) + ':00';
  const serie = (f: (i: number) => number) => heures.map((_, i) => f(i));
  if (url.searchParams.has('current')) return { current: { temperature_2m: 8, cloud_cover: 60, wind_speed_10m: 9, pressure_msl: 1014 } };
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

const formulaire = (page: Page) => page.locator('[role="dialog"]');
const boutonPreparer = (page: Page) => page.getByRole('button', { name: /^Préparer ma sortie$/ });
const reseau = async (page: Page, coupe: boolean) => {
  await page.context().setOffline(coupe);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(!coupe);
};

/** Ouvre l'app, crée le spot « Pont de Cé » et l'ouvre dans la liste. */
async function ouvrirLeSpot(page: Page, requetesMeteo: string[] = []): Promise<void> {
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
  await attendreFirebase(page);
  // L'app s'ouvre sur « Conseil » : on attend son top 3 en ligne (contenu du moteur chargé), puis on va sur « Spots ».
  await expect(page.locator('section, article, ion-card').filter({ hasText: /Animation\s*:/ }).filter({ hasNot: page.locator('section, article, ion-card') })).toHaveCount(3);
  await ouvrirEcran(page, 'Spots');
  await page.getByRole('button', { name: 'Ajouter un spot', exact: true }).click();
  await formulaire(page).getByLabel('Nom').fill('Pont de Cé');
  await formulaire(page).getByRole('radio', { name: '2e catégorie' }).click();
  await formulaire(page).getByRole('radio', { name: 'Rivière' }).click();
  await formulaire(page).getByRole('region', { name: 'Position' }).click({ position: { x: 100, y: 100 } });
  await expect(formulaire(page).getByRole('status')).toContainText('Département :');
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire(page)).toHaveCount(0);
  await page.locator('ul li').filter({ hasText: 'Pont de Cé' }).getByRole('button').first().click();
  await expect(boutonPreparer(page)).toBeVisible();
}

test("critère 1 : given le détail du spot « Pont de Cé » avec du réseau, when l'utilisateur touche « Préparer ma sortie », then « Sortie prête : conditions jusqu'au 26/11 à 9 h » s'affiche", async ({ page }) => {
  const requetesMeteo: string[] = [];
  await ouvrirLeSpot(page, requetesMeteo);
  const avant = requetesMeteo.length;

  await boutonPreparer(page).click();

  await expect(page.getByRole('status').filter({ hasText: "Sortie prête : conditions jusqu'au 26/11 à 9 h" })).toBeVisible();
  // La requête posée par la touche est la prévision heure par heure (48 h) du spot, avec ses coordonnées.
  const nouvelles = requetesMeteo.slice(avant).map((u) => new URL(u));
  const previsions = nouvelles.filter((u) => u.searchParams.has('hourly'));
  expect(previsions.length).toBeGreaterThan(0);
  expect(Number.isFinite(Number(previsions[0].searchParams.get('latitude')))).toBe(true);
  expect(Number.isFinite(Number(previsions[0].searchParams.get('longitude')))).toBe(true);
  await expect(page.getByText('Bientôt disponible')).toHaveCount(0);
});

test("critère 2 : given une sortie préparée pour « Pont de Cé » puis le mode avion, when l'utilisateur touche « Voir le conseil » sur ce spot, then le top 3 s'affiche avec la mention « Conditions du 24/11 à 9 h »", async ({ page }) => {
  await ouvrirLeSpot(page);
  await boutonPreparer(page).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sortie prête' })).toBeVisible();

  await reseau(page, true);
  await page.getByRole('button', { name: 'Voir le conseil', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Ton top 3' })).toBeVisible();
  await expect(page.getByText('Conditions du 24/11 à 9 h')).toBeVisible();
  await expect(page.locator('section, article, ion-card').filter({ hasText: /Animation\s*:/ }).filter({ hasNot: page.locator('section, article, ion-card') })).toHaveCount(3);
});

test("critère 3 : given le détail d'un spot sans réseau, when l'utilisateur touche « Préparer ma sortie », then « Pas de réseau : prépare ta sortie avant de partir » s'affiche", async ({ page }) => {
  const requetesMeteo: string[] = [];
  await ouvrirLeSpot(page, requetesMeteo);
  await reseau(page, true);
  const avant = requetesMeteo.length;

  await boutonPreparer(page).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Pas de réseau : prépare ta sortie avant de partir' })).toBeVisible();
  expect(requetesMeteo.length).toBe(avant);
});
