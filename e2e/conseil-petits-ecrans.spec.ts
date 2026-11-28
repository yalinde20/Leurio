// US 295 (maquette, section 6) : sur un petit écran, les zones vides se réduisent à leur nom et celle du coup prend la place ; rien ne
// déborde ni n'est recouvert. Pour chaque taille d'écran : aucune zone ne déborde, le coup, « 2 autres coups » et 👍/👎 sont entièrement
// dans leur zone et se touchent par un vrai clic (sans `force`). Aucun service réel : doubles de Hub'Eau et d'Open-Meteo.
import { test, expect, type Page } from '@playwright/test';
import { conseilAffiche, coupUn, riviere } from './conseil-helpers';
import { estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

test.use({ geolocation: { latitude: 47.47, longitude: -0.55 }, permissions: ['geolocation'] });

const MAINTENANT = new Date('2026-11-09T12:00:00Z');
const ECRANS = [
  { nom: 'iPhone 390 × 844', width: 390, height: 844 },
  { nom: 'iPhone SE 375 × 667', width: 375, height: 667 },
  { nom: 'iPhone dans Safari 390 × 664', width: 390, height: 664 },
  { nom: 'petit écran 320 × 568', width: 320, height: 568 },
];

async function simulerServices(page: Page, eau: number | null, maintenant = MAINTENANT): Promise<void> {
  await page.clock.setFixedTime(maintenant);
  await page.route(
    (url) => !estLocal(url.toString()),
    (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'hubeau.eaufrance.fr' && url.pathname.endsWith('/temperature/chronique') && eau !== null) {
        return route.fulfill({
          json: { data: [{ code_station: '04101000', libelle_station: 'La Maine à Angers', longitude: -0.5, latitude: 47.5, date_mesure_temp: maintenant.toISOString().slice(0, 10), heure_mesure_temp: '01:00:00', resultat: eau }] },
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

// Le leurre n° 1 du moteur change de zone de nage avec la saison et l'espèce : un scénario par zone (contenu de lure-types.json).
const SCENARIOS = [
  { zone: 'Surface', espece: 'Black-bass', date: new Date('2026-05-12T04:10:00Z'), eau: 16 }, // popper
  { zone: 'Mi-eau', espece: 'Sandre', date: MAINTENANT, eau: 11.5 }, // shad
  { zone: 'Fond', espece: 'Black-bass', date: new Date('2026-11-09T06:45:00Z'), eau: 2 }, // ver souple finesse
] as const;

const defilement = (page: Page) =>
  page.evaluate(async () => {
    const contenu = document.querySelector('ion-content') as (HTMLElement & { getScrollElement(): Promise<HTMLElement> }) | null;
    const el = await contenu!.getScrollElement();
    return { scroll: el.scrollHeight, client: el.clientHeight };
  });

for (const ecran of ECRANS) {
  const petitEcran = ecran.width < 375 || ecran.height < 600; // 320 × 568 : le contenu minimal peut ne pas tenir, ion-content défile
  for (const sc of SCENARIOS) {
    for (const [cas, hubeau, sortie] of [['conditions normales', true, false], ["Hub'Eau indisponible et « Sortie prête »", false, true]] as const) {
      test(`US 295 B1 : given ${ecran.nom}, un coup en ${sc.zone} et ${cas}, when l'écran Conseil s'affiche, then ${petitEcran ? '' : 'rien ne défile, '}aucune zone ne déborde et le coup, « 2 autres coups » et 👍/👎 sont dans leur zone et se touchent`, async ({ page }) => {
        await page.setViewportSize({ width: ecran.width, height: ecran.height });
        await onboardingTermine(page);
        await simulerServices(page, hubeau ? sc.eau : null, sc.date);
        await page.goto('/');
        await page.getByRole('button', { name: /^Espèce/ }).click();
        await page.getByRole('radio', { name: sc.espece }).click();
        await conseilAffiche(page);
        if (sortie) {
          await page.getByRole('navigation', { name: 'Navigation' }).getByRole('button', { name: 'Ma sortie' }).click();
          await expect(page.getByRole('status').filter({ hasText: 'Sortie prête' })).toBeVisible();
          await expect(riviere(page).getByText('Conseil moins précis')).toBeVisible();
        }

        const zone = riviere(page).getByRole('group').filter({ has: page.getByRole('link', { name: /^01\b/ }) });
        if (hubeau) await expect(zone).toHaveAttribute('aria-label', sc.zone);

        // Sans défilement : l'écran tient (sauf 320 × 568, où le contenu minimal peut ne pas tenir).
        if (!petitEcran) {
          const d = await defilement(page);
          expect(d.scroll, 'défilement de ion-content').toBeLessThanOrEqual(d.client);
        }
        // Aucune zone ne déborde ; les zones vides se réduisent à leur nom sur les petits écrans.
        const zones = await riviere(page).getByRole('group').evaluateAll((els) =>
          els.map((z) => ({ nom: z.getAttribute('aria-label'), scroll: z.scrollHeight, client: z.clientHeight, haut: z.getBoundingClientRect().height })),
        );
        const nomDuCoup = await zone.getAttribute('aria-label');
        for (const z of zones) {
          expect(z.scroll, `zone ${z.nom}`).toBeLessThanOrEqual(z.client);
          if (ecran.height < 700 && z.nom !== nomDuCoup) expect(z.haut, `zone vide ${z.nom}`).toBeLessThanOrEqual(40);
        }

        // Le coup et ses boutons sont entièrement dans la zone du coup, sans avoir fait défiler la page (sauf 320 × 568).
        const dedans = async (nom: string, cible: ReturnType<Page['locator']>) => {
          if (petitEcran) await cible.scrollIntoViewIfNeeded();
          const z = (await zone.boundingBox())!;
          const b = (await cible.boundingBox())!;
          expect(b.x, `${nom} : bord gauche`).toBeGreaterThanOrEqual(z.x - 1);
          expect(b.x + b.width, `${nom} : bord droit`).toBeLessThanOrEqual(z.x + z.width + 1);
          expect(b.y, `${nom} : haut`).toBeGreaterThanOrEqual(z.y - 1);
          expect(b.y + b.height, `${nom} : bas`).toBeLessThanOrEqual(z.y + z.height + 1);
          if (!petitEcran) expect(b.y + b.height, `${nom} : au-dessus du dock`).toBeLessThanOrEqual((await page.getByRole('navigation', { name: 'Navigation' }).boundingBox())!.y + 1);
        };
        const autres = riviere(page).getByRole('button', { name: /autres? coups?/ });
        const oui = riviere(page).getByRole('button', { name: "Oui, ce conseil m'a aidé" });
        const non = riviere(page).getByRole('button', { name: "Non, ce conseil ne m'a pas aidé" });
        await dedans('le coup 01', coupUn(page));
        await dedans('« 2 autres coups »', autres);
        await dedans('👍', oui);
        await dedans('👎', non);

        // Vrais clics, sans `force` : rien ne les recouvre.
        await autres.click();
        const feuille = page.getByRole('dialog', { name: /autres? coups?/ });
        await expect(feuille).toBeVisible();
        await feuille.getByRole('button', { name: 'Fermer' }).click();
        await expect(feuille).toHaveCount(0);
        await oui.click();
        await expect(riviere(page).getByText('Merci pour ton retour !')).toBeVisible();
        await coupUn(page).click();
        await expect(page.getByText('Détail du conseil')).toBeVisible();
      });
    }
  }
}

test('US 295 B2 : given Brochet en mars (aucun conseil), when l\'écran Conseil s\'affiche, then la note des leurres écartés est dans la rivière sous « Aucun conseil pour cette espèce en ce moment. »', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await onboardingTermine(page);
  await simulerServices(page, 9);
  await page.clock.setFixedTime(new Date('2026-03-10T12:00:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: /^Espèce/ }).click();
  await page.getByRole('radio', { name: 'Brochet' }).click();

  await expect(riviere(page).getByText('Aucun conseil pour cette espèce en ce moment.')).toBeVisible();
  await expect(riviere(page).getByRole('note')).toContainText(/Brochet fermé/);
});
