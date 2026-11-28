// US 295 : l'écran Conseil « rivière en coupe » (PLAN §3, §4, §6).
// Maquette validée : docs/maquettes/us-295-riviere-en-coupe.html (référence des textes, de la structure et des états).
//
// CONTRAT DU DOM (ce que le développeur doit produire ; tout le reste de la structure est libre) :
//  - Le lieu, le moment (bouton « Moment … ») et l'espèce (bouton « Espèce … ») restent ; la feuille « Espèce visée »
//    (role="dialog", lignes role="radio") reste celle de l'US 83.
//  - Ligne d'état réglementaire : un `button` dont le nom accessible commence par
//      « Pêche ouverte jusqu'à H h MM »            (ouvert, plus de 30 min avant la fin des heures légales),
//      « Fermeture à H h MM, dans N min »           (moins de 30 min avant la fin),
//      « Pêche fermée jusqu'à H h MM »              (hors des heures légales).
//    Il contient une icône d'état : `[data-icone="livre"]` (ouvert), `[data-icone="alerte"]` (fermeture proche),
//    `[data-icone="lune"]` (fermé). Un tap ouvre un `role="dialog"` nommé « Réglementation » (« à vérifier dans l'arrêté
//    de ton département » + `link` vers la fédération, nom et href lus dans federations.json).
//  - Température de l'eau en gros (« 11,5 °C ») suivie de sa source ; sous elle, la ligne météo : un `button` dont le nom
//    contient « vent N km/h ». Un tap ouvre un `role="dialog"` nommé « Conditions » avec les lignes
//    Débit, Pression, Ciel, Vent, Lune, Heures légales (libellé puis valeur, dans cet ordre de lecture).
//  - La rivière : une `region` nommée « Rivière en coupe », contenant trois `group` nommés « Surface », « Mi-eau »
//    et « Fond » (de haut en bas, dans cet ordre). Le coup « 01 » est un `link` dont le nom accessible commence par « 01 »
//    et contient le nom du type de leurre, l'animation, la taille (ou le poids) et la couleur ; il est posé dans le groupe
//    de la zone `zoneNage` du type de leurre (contenu lure-types.json) et ouvre le détail (/conseil/detail/…).
//    Le lien « 2 autres coups » est un `button` de la région ; il ouvre un `role="dialog"` nommé « 2 autres coups » avec les
//    `link` « 02 » et « 03 » (nom du leurre et animation) et la note des leurres écartés (« Brochet fermé : … »).
//  - Hors des heures légales : aucun coup dans la rivière, un `role="alert"` dans la région avec « Hors des heures légales »
//    et « à vérifier dans l'arrêté de ton département ».
//  - Conseil « moins précis » : un badge « Conseil moins précis » dans la région « Rivière en coupe ».
//
// Aucun service réel : position simulée, Hub'Eau et Open-Meteo répondent par des doubles, tout autre hôte non local est coupé.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTimes } from 'suncalc';
import { onboardingTermine } from './onboarding-helpers';
import { estLocal } from './firebase-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const lire = <T>(f: string) => JSON.parse(readFileSync(join(process.cwd(), 'src/assets/data', `${f}.json`), 'utf8')) as T;
interface TypeLeurre { id: string; nom: string; zoneNage: 'surface' | 'mi-eau' | 'fond' }
const TYPES = lire<TypeLeurre[]>('lure-types');
const TECHNIQUES = lire<{ id: string; nom: string }[]>('techniques');
const FEDERATIONS = lire<{ departement: string; nom: string; url: string }[]>('federations');
const FEDERATION_49 = FEDERATIONS.find((f) => f.departement === '49')!;

const LIBELLE_ZONE = { surface: 'Surface', 'mi-eau': 'Mi-eau', fond: 'Fond' } as const;
const typeParId = (id: string) => TYPES.find((t) => t.id === id)!;
const echapper = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternance = (noms: string[]) => new RegExp(`(${noms.map(echapper).join('|')})`, 'i');

const LAT = 47.47;
const LNG = -0.55;
const heureFr = (d: Date) => {
  const p = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).formatToParts(d);
  return `${Number(p.find((x) => x.type === 'hour')!.value)} h ${p.find((x) => x.type === 'minute')!.value}`;
};
/** Fin des heures légales : coucher du soleil + 30 min (PLAN §6, legal-hours.ts). */
const finLegale = (jour: Date) => new Date(getTimes(jour, LAT, LNG).sunset.getTime() + 30 * 60_000);

const heuresLisibles = (debut: Date, fin: Date) => `${heureFr(debut)} – ${heureFr(fin)}`;

interface Services {
  /** Température du relevé Hub'Eau ; `null` = Hub'Eau indisponible. */
  eau: number | null;
  /** Température de l'air des 10 derniers jours (estimation de l'eau quand Hub'Eau est en panne). */
  air?: number;
}

/** Hub'Eau (relevé de température) et Open-Meteo (actuel, horaire, archive) sont doublés ; tout le reste est coupé. */
async function simulerServices(page: Page, maintenant: Date, { eau, air = 11 }: Services): Promise<void> {
  await page.clock.setFixedTime(maintenant);
  await page.route(
    (url) => !estLocal(url.toString()),
    (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'hubeau.eaufrance.fr' && url.pathname.endsWith('/temperature/chronique') && eau !== null) {
        return route.fulfill({
          json: {
            data: [
              {
                code_station: '04101000',
                libelle_station: 'La Maine à Angers',
                longitude: -0.5,
                latitude: 47.5,
                date_mesure_temp: maintenant.toISOString().slice(0, 10),
                heure_mesure_temp: '01:00:00',
                resultat: eau,
              },
            ],
          },
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
        return route.fulfill({
          json: {
            hourly: {
              time,
              temperature_2m: serie(valeurs.temperature_2m),
              cloud_cover: serie(valeurs.cloud_cover),
              wind_speed_10m: serie(valeurs.wind_speed_10m),
              pressure_msl: serie(valeurs.pressure_msl),
            },
          },
        });
      }
      if (url.hostname === 'archive-api.open-meteo.com') {
        const debut = Date.parse(`${url.searchParams.get('start_date')}T00:00:00Z`);
        const fin = Date.parse(`${url.searchParams.get('end_date')}T00:00:00Z`);
        const time: string[] = [];
        for (let t = debut; t <= fin; t += 86_400_000) time.push(new Date(t).toISOString().slice(0, 10));
        return route.fulfill({ json: { daily: { time, temperature_2m_mean: time.map(() => air) } } });
      }
      return route.abort();
    },
  );
}

async function ouvrirConseil(page: Page, maintenant: Date, services: Services, espece?: string): Promise<void> {
  await onboardingTermine(page);
  await simulerServices(page, maintenant, services);
  await page.goto('/');
  if (espece) {
    await page.getByRole('button', { name: /^Espèce/ }).click();
    await page.getByRole('radio', { name: espece }).click();
  }
}

const riviere = (page: Page) => page.getByRole('region', { name: 'Rivière en coupe' });
const zone = (page: Page, nom: string) => riviere(page).getByRole('group', { name: nom, exact: true });
const coup = (page: Page, numero: string) => riviere(page).getByRole('link', { name: new RegExp(`^${numero}\\b`) });
const ligneEtat = (page: Page, nom: RegExp) => page.getByRole('button', { name: nom });

// Sandre en novembre, en plein jour : conditions fixées (voir les doubles), pour les critères qui ne dépendent pas de la zone du n°1.
const JOUR_NOVEMBRE = new Date('2026-11-09T12:00:00Z');
// Black-bass à l'aube, le 9 novembre, eau à 2 °C : le moteur place un ver souple finesse (zone « fond ») en n°1.
// L'aube (06 h 25 à 06 h 58 UTC) est dans les heures légales à partir de 06 h 27 UTC.
const AUBE_NOVEMBRE = new Date('2026-11-09T06:45:00Z');
// Black-bass à l'aube un matin de mai (16 °C) : le moteur place un popper, leurre de surface, en n°1.
// L'aube est dans les heures légales (qui commencent 30 min avant le lever du soleil).
const AUBE_MAI = new Date('2026-05-12T04:10:00Z');

test('US 295 critère 0 : given un conseil dont le n°1 est un leurre de zone « fond », when l\'écran Conseil s\'affiche, then le coup « 01 » (leurre, animation, taille, couleur) est posé dans la zone « Fond » de la rivière en coupe et ouvre son détail au tap', async ({ page }) => {
  await ouvrirConseil(page, AUBE_NOVEMBRE, { eau: 2 }, 'Black-bass');

  await expect(riviere(page)).toBeVisible();
  // Les trois zones, de haut en bas.
  const noms = ['Surface', 'Mi-eau', 'Fond'];
  const hauts: number[] = [];
  for (const nom of noms) {
    await expect(zone(page, nom)).toBeVisible();
    hauts.push((await zone(page, nom).boundingBox())!.y);
  }
  expect(hauts, 'Surface, Mi-eau, Fond de haut en bas').toEqual([...hauts].sort((a, b) => a - b));

  // Le coup 01 : un ver souple finesse, dont la zone de nage lue dans le contenu est « fond », avec animation, taille et couleur.
  const ver = typeParId('ver-finesse');
  expect(ver.zoneNage, 'le contenu place le ver souple finesse au fond').toBe('fond');
  const zoneDuCoup = LIBELLE_ZONE[ver.zoneNage];
  expect(zoneDuCoup).toBe('Fond');
  const un = zone(page, zoneDuCoup).getByRole('link', { name: /^01\b/ });
  await expect(un).toBeVisible();
  await expect(un).toHaveAccessibleName(new RegExp(ver.nom, 'i'));
  await expect(un).toHaveAccessibleName(new RegExp(TECHNIQUES.find((t) => t.id === 'tiree-relachee')!.nom, 'i'));
  await expect(un).toHaveAccessibleName(/\d+(,\d)?\s*cm/);
  await expect(un).toHaveAccessibleName(/gardon/i);
  await expect(un, 'dans la carte du coup 01 : « Dans ta boîte » ou « Il te manque »').toHaveAccessibleName(/Dans ta boîte|Il te manque/);
  // Un seul coup 01, et aucun dans les autres zones.
  for (const nom of noms.filter((n) => n !== zoneDuCoup)) await expect(zone(page, nom).getByRole('link')).toHaveCount(0);

  await un.click();
  await expect(page).toHaveURL(/\/conseil\/detail\//);
  await expect(page.getByText('Détail du conseil')).toBeVisible();
});

test('US 295 critère 1 : given un conseil dont le n°1 est un leurre de surface, when l\'écran Conseil s\'affiche, then le coup « 01 » est posé dans la zone « Surface »', async ({ page }) => {
  await ouvrirConseil(page, AUBE_MAI, { eau: 16 }, 'Black-bass');

  await expect(riviere(page)).toBeVisible();
  const popper = typeParId('popper');
  expect(popper.zoneNage, 'le contenu place le popper en surface').toBe('surface');
  const un = zone(page, 'Surface').getByRole('link', { name: /^01\b/ });
  await expect(un).toBeVisible();
  await expect(un).toHaveAccessibleName(new RegExp(popper.nom, 'i'));
  await expect(zone(page, 'Mi-eau').getByRole('link')).toHaveCount(0);
  await expect(zone(page, 'Fond').getByRole('link')).toHaveCount(0);
});

test('US 295 critère 2 : given l\'écran Conseil, when je touche « 2 autres coups », then les conseils n°2 et n°3 s\'affichent avec leur nom et leur animation', async ({ page }) => {
  await ouvrirConseil(page, JOUR_NOVEMBRE, { eau: 11.5 }, 'Sandre');
  await expect(coup(page, '01')).toBeVisible();

  await riviere(page).getByRole('button', { name: /2 autres coups/ }).click();

  const feuille = page.getByRole('dialog', { name: '2 autres coups' });
  await expect(feuille).toBeVisible();
  for (const rang of ['02', '03']) {
    const lien = feuille.getByRole('link', { name: new RegExp(`^${rang}\\b`) });
    await expect(lien).toBeVisible();
    await expect(lien).toHaveAccessibleName(alternance(TYPES.map((t) => t.nom)));
    await expect(lien).toHaveAccessibleName(alternance(TECHNIQUES.map((t) => t.nom)));
  }
  await expect(feuille.getByRole('link', { name: /^01\b/ })).toHaveCount(0);
});

test('US 295 décision du propriétaire : given le brochet fermé, when l\'écran Conseil s\'affiche, then la note des leurres écartés n\'est plus sur l\'écran mais dans la feuille « 2 autres coups »', async ({ page }) => {
  await ouvrirConseil(page, new Date('2026-03-10T12:00:00Z'), { eau: 9 }, 'Perche');
  await expect(coup(page, '01')).toBeVisible();
  await expect(page.getByText(/Brochet fermé/)).toHaveCount(0);

  await riviere(page).getByRole('button', { name: /2 autres coups/ }).click();
  await expect(page.getByRole('dialog', { name: '2 autres coups' }).getByText(/Brochet fermé/)).toBeVisible();
});

test('US 295 critère 3 : given l\'écran Conseil, when je touche la ligne météo sous la température de l\'eau, then les conditions complètes s\'affichent : débit, pression, ciel, vent, lune et heures légales', async ({ page }) => {
  await ouvrirConseil(page, JOUR_NOVEMBRE, { eau: 11.5 }, 'Sandre');
  await expect(coup(page, '01')).toBeVisible();

  const temperature = page.getByText(/11,5\s°C/).first();
  const meteo = page.getByRole('button', { name: /vent\s+12\s*km\/h/i });
  await expect(meteo).toBeVisible();
  expect((await meteo.boundingBox())!.y, 'la ligne météo est sous la température de l\'eau').toBeGreaterThan((await temperature.boundingBox())!.y);

  await meteo.click();

  const feuille = page.getByRole('dialog', { name: 'Conditions' });
  await expect(feuille).toBeVisible();
  await expect(feuille).toContainText(/Débit\s+\S+/);
  await expect(feuille).toContainText(/Pression\s+1016\s*hPa/);
  await expect(feuille).toContainText(/Ciel\s+\S+/);
  await expect(feuille).toContainText(/Vent\s+12\s*km\/h/);
  await expect(feuille).toContainText(/Lune\s+\S+/);
  const fin = finLegale(JOUR_NOVEMBRE);
  const debut = new Date(getTimes(JOUR_NOVEMBRE, LAT, LNG).sunrise.getTime() - 30 * 60_000);
  await expect(feuille).toContainText(new RegExp(`Heures légales\\s+${echapper(heuresLisibles(debut, fin))}`));
});

test('US 295 critère 4 : given un moment dans les heures légales, à plus de 30 min de la fin, when l\'écran s\'affiche, then la ligne d\'état dit « Pêche ouverte jusqu\'à » suivi de l\'heure de fin', async ({ page }) => {
  await ouvrirConseil(page, JOUR_NOVEMBRE, { eau: 11.5 }, 'Sandre');

  const fin = heureFr(finLegale(JOUR_NOVEMBRE));
  const ligne = ligneEtat(page, new RegExp(`^Pêche ouverte jusqu.à ${echapper(fin)}`));
  await expect(ligne).toBeVisible();
  await expect(ligne.locator('[data-icone="livre"]')).toHaveCount(1);
  await expect(ligne.locator('[data-icone="alerte"]')).toHaveCount(0);
});

test('US 295 critère 5 : given un moment à moins de 30 min de la fin des heures légales, when l\'écran s\'affiche, then la ligne d\'état dit « Fermeture à » l\'heure de fin et le temps restant, avec l\'icône d\'attention', async ({ page }) => {
  const fin = finLegale(JOUR_NOVEMBRE);
  const dansVingtMinutes = new Date(fin.getTime() - 20 * 60_000);
  await ouvrirConseil(page, dansVingtMinutes, { eau: 11.5 }, 'Sandre');

  const ligne = ligneEtat(page, new RegExp(`^Fermeture à ${echapper(heureFr(fin))}, dans (19|20|21) min`));
  await expect(ligne).toBeVisible();
  await expect(ligne.locator('[data-icone="alerte"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Pêche ouverte/ })).toHaveCount(0);
});

test('US 295 critère 6 : given un moment hors des heures légales, when l\'écran s\'affiche, then aucun coup n\'est posé dans la rivière et un avertissement dit que la pêche est fermée, avec « à vérifier dans l\'arrêté de ton département »', async ({ page }) => {
  await ouvrirConseil(page, new Date('2026-11-09T20:30:00Z'), { eau: 10.8 }, 'Sandre');

  await expect(riviere(page)).toBeVisible();
  const alerte = riviere(page).getByRole('alert');
  await expect(alerte).toBeVisible();
  await expect(alerte).toContainText(/Hors des heures légales/);
  await expect(alerte).toContainText(/à vérifier dans l'arrêté de ton département/i);
  // Aucun coup : aucun lien « 01 », « 02 »… Le seul lien de la rivière est celui de la fédération dans l'alerte (section 6 validée).
  await expect(riviere(page).getByRole('link', { name: /^0\d/ })).toHaveCount(0);
  await expect(riviere(page).getByRole('link')).toHaveCount(1);
  await expect(alerte.getByRole('link', { name: new RegExp(echapper(FEDERATION_49.nom)) })).toHaveAttribute('href', FEDERATION_49.url);
  await expect(riviere(page).getByRole('button', { name: /2 autres coups/ })).toHaveCount(0);
  const ligne = ligneEtat(page, /^Pêche fermée jusqu.à \d{1,2} h \d{2}/);
  await expect(ligne).toBeVisible();
  await expect(ligne.locator('[data-icone="lune"]')).toHaveCount(1);
});

test('US 295 critère 7 : given l\'écran Conseil, when je touche la ligne d\'état, then la réglementation s\'affiche avec « à vérifier dans l\'arrêté de ton département » et le lien vers la fédération', async ({ page }) => {
  await ouvrirConseil(page, JOUR_NOVEMBRE, { eau: 11.5 }, 'Sandre');

  await ligneEtat(page, /^Pêche ouverte jusqu.à/).click();

  const feuille = page.getByRole('dialog', { name: 'Réglementation' });
  await expect(feuille).toBeVisible();
  await expect(feuille).toContainText(/à vérifier dans l'arrêté de ton département/i);
  const lien = feuille.getByRole('link', { name: new RegExp(echapper(FEDERATION_49.nom)) });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute('href', FEDERATION_49.url);
  expect((await lien.boundingBox())!.height).toBeGreaterThanOrEqual(48);
});

test('US 295 critère 8 : given Hub\'Eau indisponible, when l\'écran Conseil s\'affiche, then la température de l\'eau porte « estimée depuis l\'air » et le conseil est signalé « moins précis »', async ({ page }) => {
  await ouvrirConseil(page, JOUR_NOVEMBRE, { eau: null, air: 11 }, 'Sandre');

  await expect(coup(page, '01')).toBeVisible();
  await expect(page.getByText(/estimée depuis l'air/i).first()).toBeVisible();
  await expect(page.getByText(/Station Hub'Eau/)).toHaveCount(0);
  await expect(riviere(page).getByText('Conseil moins précis')).toBeVisible();
});

test('US 295 critère 9 : given un iPhone de 390 × 844, when l\'écran Conseil s\'affiche, then tout tient sans défilement vertical, rivière et dock compris', async ({ page }) => {
  await ouvrirConseil(page, JOUR_NOVEMBRE, { eau: 11.5 }, 'Sandre');
  await expect(riviere(page)).toBeVisible();
  await expect(coup(page, '01')).toBeVisible();

  const mesures = await page.evaluate(async () => {
    const contenu = document.querySelector('ion-content') as (HTMLElement & { getScrollElement(): Promise<HTMLElement> }) | null;
    const defilant = contenu ? await contenu.getScrollElement() : null;
    const racine = document.scrollingElement!;
    return {
      document: { scroll: racine.scrollHeight, client: racine.clientHeight },
      contenu: defilant ? { scroll: defilant.scrollHeight, client: defilant.clientHeight } : null,
    };
  });
  expect(mesures.document.scroll, 'défilement du document').toBeLessThanOrEqual(mesures.document.client);
  expect(mesures.contenu, 'ion-content').not.toBeNull();
  expect(mesures.contenu!.scroll, 'défilement de ion-content').toBeLessThanOrEqual(mesures.contenu!.client);

  const dock = await page.getByRole('navigation', { name: 'Navigation' }).boundingBox();
  const eau = await riviere(page).boundingBox();
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(844);
  expect(eau!.y + eau!.height).toBeLessThanOrEqual(dock!.y + 1);
});
