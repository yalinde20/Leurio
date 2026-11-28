// US 295 : « Maintenant » avance avec l'horloge. La ligne d'état passe à « Fermeture à … » sous les 30 min, puis, la fin des heures
// légales franchie, les coups laissent la place à l'avertissement. L'horloge du navigateur est pilotée par page.clock.
// Aucun service réel : position simulée, Hub'Eau et Open-Meteo répondent par des doubles, tout autre hôte non local est coupé.
import { test, expect, type Page } from '@playwright/test';
import { getTimes } from 'suncalc';
import { conseilAffiche, coupUn, ligneEtat, riviere } from './conseil-helpers';
import { estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MINUTE = 60_000;
const JOUR = new Date('2026-11-09T12:00:00Z');
/** Fin des heures légales : coucher du soleil + 30 min (PLAN §6). */
const FIN = new Date(getTimes(JOUR, 47.47, -0.55).sunset.getTime() + 30 * MINUTE);

async function simulerServices(page: Page, maintenant: Date): Promise<void> {
  await page.route(
    (url) => !estLocal(url.toString()),
    (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'hubeau.eaufrance.fr' && url.pathname.endsWith('/temperature/chronique')) {
        return route.fulfill({
          json: { data: [{ code_station: '04101000', libelle_station: 'La Maine à Angers', longitude: -0.5, latitude: 47.5, date_mesure_temp: maintenant.toISOString().slice(0, 10), heure_mesure_temp: '01:00:00', resultat: 11.5 }] },
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
        return route.fulfill({ json: { daily: { time: [url.searchParams.get('end_date')], temperature_2m_mean: [11] } } });
      }
      return route.abort();
    },
  );
}

test('US 295 : given « Pêche ouverte » à 40 min de la fin, when les minutes passent, then la ligne passe à « Fermeture à … » sous 30 min, puis, la fin franchie, l\'alerte « Hors des heures légales » remplace les coups', async ({ page }) => {
  const depart = new Date(FIN.getTime() - 40 * MINUTE);
  await onboardingTermine(page);
  await simulerServices(page, depart);
  await page.clock.install({ time: depart });
  await page.goto('/');
  await expect(ligneEtat(page, /^Pêche ouverte jusqu.à/)).toBeVisible();
  await conseilAffiche(page);

  await page.clock.runFor(15 * MINUTE); // 25 min avant la fin
  await expect(ligneEtat(page, /^Fermeture à \d{1,2} h \d{2}, dans (24|25|26) min/)).toBeVisible();
  await expect(ligneEtat(page, /^Fermeture/).locator('[data-icone="alerte"]')).toHaveCount(1);
  await expect(coupUn(page)).toBeVisible();

  await page.clock.runFor(30 * MINUTE); // 5 min après la fin
  await expect(ligneEtat(page, /^Pêche fermée jusqu.à \d{1,2} h \d{2}/)).toBeVisible();
  await expect(coupUn(page)).toHaveCount(0);
  const alerte = riviere(page).getByRole('alert');
  await expect(alerte).toContainText(/Hors des heures légales/);
  await expect(alerte).toContainText(/Heures légales demain : \d{1,2} h \d{2} – \d{1,2} h \d{2}/);
  await expect(alerte).toContainText(/à vérifier dans l'arrêté de ton département/i);
});
