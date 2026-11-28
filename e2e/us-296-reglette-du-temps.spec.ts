// US 296 : la réglette du temps sur l'écran Conseil (PLAN §3, §6). Maquette validée : docs/maquettes/us-296-reglette-du-temps.html.
// Mesure réelle (mise en page du navigateur) que les specs Vitest, sous jsdom, ne peuvent pas faire.
//
// CONTRAT DU DOM : un `slider` nommé « Moment du conseil » (`aria-valuetext` = le libellé lu en clair, p. ex. « Maintenant 14 h 20 »,
// « Ce soir 18 h 30 ») ; son curseur est un élément `.curseur` DANS le slider ; le slider occupe la largeur de l'écran, entre la rivière et le dock.
// Aucun service réel : doubles de Hub'Eau et d'Open-Meteo, tout autre hôte non local est coupé.
import { test, expect, type Page } from '@playwright/test';
import { conseilAffiche } from './conseil-helpers';
import { estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MAINTENANT = new Date('2026-11-09T13:20:00Z'); // 14 h 20 à Paris

async function simulerServices(page: Page): Promise<void> {
  await page.clock.setFixedTime(MAINTENANT);
  await page.route(
    (url) => !estLocal(url.toString()),
    (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'hubeau.eaufrance.fr' && url.pathname.endsWith('/temperature/chronique')) {
        return route.fulfill({
          json: { data: [{ code_station: '04101000', libelle_station: 'La Maine à Angers', longitude: -0.5, latitude: 47.5, date_mesure_temp: '2026-11-09', heure_mesure_temp: '01:00:00', resultat: 11.5 }] },
        });
      }
      if (url.hostname === 'api.open-meteo.com') {
        const valeurs = { temperature_2m: 12, cloud_cover: 40, wind_speed_10m: 12, pressure_msl: 1016 };
        if (url.searchParams.has('current')) return route.fulfill({ json: { current: valeurs } });
        const debut = Date.parse(`${url.searchParams.get('start_hour')}:00Z`);
        const fin = Date.parse(`${url.searchParams.get('end_hour')}:00Z`);
        const time: string[] = [];
        for (let t = debut; t <= fin; t += 3_600_000) time.push(new Date(t).toISOString().slice(0, 13) + ':00');
        const serie = (v: number) => time.map(() => v);
        return route.fulfill({ json: { hourly: { time, temperature_2m: serie(12), cloud_cover: serie(40), wind_speed_10m: serie(12), pressure_msl: serie(1016) } } });
      }
      if (url.hostname === 'archive-api.open-meteo.com') {
        const debut = Date.parse(`${url.searchParams.get('start_date')}T00:00:00Z`);
        const fin = Date.parse(`${url.searchParams.get('end_date')}T00:00:00Z`);
        const time: string[] = [];
        for (let t = debut; t <= fin; t += 86_400_000) time.push(new Date(t).toISOString().slice(0, 10));
        return route.fulfill({ json: { daily: { time, temperature_2m_mean: time.map(() => 11) } } });
      }
      return route.abort();
    },
  );
}

const reglette = (page: Page) => page.getByRole('slider', { name: 'Moment du conseil' });

test.beforeEach(async ({ page }) => {
  await onboardingTermine(page);
  await simulerServices(page);
  await page.goto('/');
  await conseilAffiche(page);
});

test('US 296 critère 6 : given un téléphone de 390 px, when je mesure le curseur, then sa zone tactile fait au moins 48 × 48 px et la réglette tient dans l\'écran, au-dessus du dock', async ({ page }) => {
  const piste = reglette(page);
  await expect(piste).toBeVisible();
  await expect(piste).toHaveAttribute('aria-valuetext', 'Maintenant 14 h 20');

  const curseur = (await piste.locator('.curseur').boundingBox())!;
  expect(curseur.width, 'largeur du curseur').toBeGreaterThanOrEqual(48);
  expect(curseur.height, 'hauteur du curseur').toBeGreaterThanOrEqual(48);
  const boite = (await piste.boundingBox())!;
  expect(boite.x, 'bord gauche de la piste').toBeGreaterThanOrEqual(0);
  expect(boite.x + boite.width, 'bord droit de la piste').toBeLessThanOrEqual(390);
  const dock = (await page.getByRole('navigation', { name: 'Navigation' }).boundingBox())!;
  expect(boite.y + boite.height, 'piste au-dessus du dock').toBeLessThanOrEqual(dock.y + 1);
});

test('US 296 critère 2 : given la réglette, when je fais glisser le curseur au doigt jusqu\'à 18 h 30, then le libellé devient « Ce soir 18 h 30 » et la température de l\'eau est recalculée au relâchement', async ({ page }) => {
  const piste = reglette(page);
  const boite = (await piste.boundingBox())!;
  const curseur = (await piste.locator('.curseur').boundingBox())!;
  const y = boite.y + boite.height / 2;

  await page.mouse.move(curseur.x + curseur.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(boite.x + boite.width * (17 / 24), y, { steps: 5 });
  await page.mouse.move(boite.x + boite.width * (18.5 / 24), y, { steps: 5 });
  await expect(piste).toHaveAttribute('aria-valuetext', 'Ce soir 18 h 30');
  await page.mouse.up();

  await expect(piste).toHaveAttribute('aria-valuetext', 'Ce soir 18 h 30');
  await conseilAffiche(page);
});

test('US 296 critère 4 : given la réglette, when je relâche le curseur à 21 h, then l\'écran Conseil passe dans l\'état « hors des heures légales »', async ({ page }) => {
  const piste = reglette(page);
  const boite = (await piste.boundingBox())!;
  const curseur = (await piste.locator('.curseur').boundingBox())!;
  const y = boite.y + boite.height / 2;

  await page.mouse.move(curseur.x + curseur.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(boite.x + boite.width * (21 / 24), y, { steps: 10 });
  await page.mouse.up();

  await expect(piste).toHaveAttribute('aria-valuetext', 'Ce soir 21 h');
  await expect(page.getByRole('region', { name: 'Rivière en coupe' }).getByRole('alert')).toContainText('Hors des heures légales');
});

test('US 296 critère 5 : given la réglette au clavier, when je la règle avec les flèches, then le moment change et sa valeur est annoncée en clair', async ({ page }) => {
  const piste = reglette(page);
  await piste.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(piste).toHaveAttribute('aria-valuetext', 'Cet après-midi 15 h');
  await page.keyboard.press('Home');
  await expect(piste).toHaveAttribute('aria-valuetext', 'Maintenant 14 h 20');
});
