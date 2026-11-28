// US 17 : la carte des spots reste utilisable sans réseau grâce aux tuiles gardées autour des spots (PLAN §4, §10 phase 5, §11).
// Build de production (service worker) sur le port 4300, Firestore sur l'émulateur. Aucun service réel : tile.openstreetmap.org
// est remplacé ici par une tuile PNG fabriquée, Open-Meteo par une prévision fabriquée, tout autre hôte non local est coupé.
// Le mode avion est `context.setOffline(true)` ; en plus, la route refuse toute tuile (la seule source hors ligne est le cache du service worker).
// Pour que ces tests ne passent pas par les tuiles déjà vues à l'écran, la carte n'est jamais cadrée en ligne sur le zoom 16
// autour du spot (la carte s'ouvre au zoom 13 au plus) : le zoom 16 n'existe hors ligne que si l'app l'a mis en cache elle-même.
// Contrat du DOM : région « Carte des spots », `.leaflet-tile-loaded`, `.leaflet-marker-icon`, `.leaflet-control-zoom-in`, data-zoom, data-centre-lat/lng.
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';
import { ajouterSpot, attendreCompte, modeAvion, ouvrirOnglet, ouvrirUneFoisEnLigne, onglet, titreVisible } from './hors-ligne-donnees-helpers';
import { top3Affiche } from './conseil-helpers';

test.use({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 47.47, longitude: -0.55 }, permissions: ['geolocation'] });

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==', 'base64');
const HEURE_MS = 3_600_000;

interface Reseau {
  /** Vrai : les tuiles répondent (réseau) ; faux : elles sont coupées (mode avion). */
  tuilesRepondent: boolean;
  /** Chemins `z/x/y` demandés à tile.openstreetmap.org. */
  tuiles: string[];
}

function prevision(url: URL) {
  const debut = Math.floor(Date.now() / HEURE_MS) * HEURE_MS;
  const heures = Array.from({ length: 193 }, (_, i) => new Date(debut + (i - 96) * HEURE_MS));
  if (url.searchParams.has('current')) return { current: { temperature_2m: 8, cloud_cover: 60, wind_speed_10m: 9, pressure_msl: 1014 } };
  return {
    hourly: {
      time: heures.map((h) => h.toISOString().slice(0, 13) + ':00'),
      temperature_2m: heures.map(() => 8),
      cloud_cover: heures.map(() => 60),
      wind_speed_10m: heures.map(() => 9),
      pressure_msl: heures.map((_, i) => 1000 + (i % 30)),
    },
  };
}

async function doublerLeReseau(context: BrowserContext): Promise<Reseau> {
  const reseau: Reseau = { tuilesRepondent: true, tuiles: [] };
  await context.route((url) => !estLocal(url.toString()), (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith('tile.openstreetmap.org')) {
      reseau.tuiles.push(url.pathname.slice(1).replace(/\.png$/, ''));
      return reseau.tuilesRepondent
        ? route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG })
        : route.abort();
    }
    if (url.hostname === 'api.open-meteo.com') return route.fulfill({ json: prevision(url) });
    return route.abort();
  });
  return reseau;
}

const carte = (page: Page) => page.getByRole('region', { name: 'Carte des spots' });
const rangee = (page: Page, nom: string) => page.locator('ul li button', { hasText: nom });

/** Nombre de tuiles OpenStreetMap de zoom 16 gardées par le navigateur (Cache Storage du service worker). */
const tuilesGardeesAuZoom16 = (page: Page) =>
  page.evaluate(async () => {
    let n = 0;
    for (const nom of await caches.keys()) {
      for (const r of await (await caches.open(nom)).keys()) {
        const u = new URL(r.url);
        if (u.hostname.endsWith('tile.openstreetmap.org') && u.pathname.split('/')[1] === '16') n++;
      }
    }
    return n;
  });

/** Zoome (ou dézoome) avec les boutons de la carte jusqu'au zoom voulu. */
async function zoomer(page: Page, cible: number): Promise<void> {
  const zoom = async () => Number(await carte(page).getAttribute('data-zoom'));
  for (let i = 0; i < 20 && (await zoom()) !== cible; i++) {
    const avant = await zoom();
    await page.locator(avant < cible ? '.leaflet-control-zoom-in' : '.leaflet-control-zoom-out').click();
    await expect.poll(zoom).not.toBe(avant);
  }
  await expect.poll(async () => Number(await carte(page).getAttribute('data-zoom'))).toBe(cible);
}

const tuilesAffichees = (page: Page) => page.locator('.leaflet-tile-loaded');

/** Chaque tuile affichée est une vraie image (pas une image cassée). */
async function tuilesSontDesImages(page: Page): Promise<boolean> {
  return page.locator('.leaflet-tile-loaded').evaluateAll((imgs) => imgs.length > 0 && imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0));
}

/** Rouvre l'app en mode avion (page rechargée) sur l'onglet « Spots », la carte centrée sur le spot au zoom 16. */
async function ouvrirLaCarteHorsLigne(page: Page, nomSpot: string): Promise<void> {
  await page.reload();
  await expect(titreVisible(page)).toHaveText('Conseil');
  await ouvrirOnglet(page, 'Spots');
  await expect(carte(page)).toBeVisible();
  await expect(rangee(page, nomSpot)).toBeVisible();
  await rangee(page, nomSpot).click();
  await zoomer(page, 16);
}

/** Un spot écrit directement dans Firestore (sans passer par l'ajout) : l'app n'a pas d'autre raison de mettre ses tuiles en cache. */
async function ecrireUnSpot(page: Page, nom: string): Promise<void> {
  await page.evaluate(async (n) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = (window as any).leurioFirebase;
    const { doc, setDoc, waitForPendingWrites } = f.sdk.firestore;
    await setDoc(doc(f.db, 'users', f.auth.currentUser.uid, 'spots', 'spot-17'), {
      nom: n, lat: 47.43, lng: -0.52, categorie: 2, milieu: 'riviere', departement: '49', prive: true,
    });
    await waitForPendingWrites(f.db);
  }, nom);
}

test.beforeEach(async ({ page }) => onboardingTermine(page));

test('US 17 critère 1 : given un spot enregistré avec du réseau, when l\'utilisateur ouvre l\'onglet « Spots » en mode avion et centre la carte sur ce spot, then le fond de carte s\'affiche autour du spot', async ({ page, context }) => {
  test.setTimeout(120_000);
  const reseau = await doublerLeReseau(context);
  await ouvrirUneFoisEnLigne(page);
  await attendreCompte(page);
  await ouvrirOnglet(page, 'Spots');
  await ajouterSpot(page, 'Pont de Cé');
  // Avec du réseau, l'app garde d'elle-même les tuiles autour du spot enregistré, y compris le zoom 16 que l'utilisateur n'a jamais affiché.
  await expect.poll(() => tuilesGardeesAuZoom16(page), { timeout: 30_000 }).toBeGreaterThan(0);
  await onglet(page, 'Conseil');

  await modeAvion(page, true);
  reseau.tuilesRepondent = false;
  await ouvrirLaCarteHorsLigne(page, 'Pont de Cé');

  await expect.poll(() => tuilesAffichees(page).count()).toBeGreaterThan(0);
  expect(await tuilesSontDesImages(page)).toBe(true);
  // Politique d'usage d'OpenStreetMap : jamais de zoom 17 ou plus.
  expect(reseau.tuiles.filter((t) => Number(t.split('/')[0]) >= 17)).toEqual([]);
});

test('US 17 critère 2 : given une sortie préparée pour un spot, when l\'utilisateur ouvre la carte en mode avion autour de ce spot, then le fond de carte s\'affiche autour du spot', async ({ page, context }) => {
  test.setTimeout(120_000);
  const reseau = await doublerLeReseau(context);
  await ouvrirUneFoisEnLigne(page);
  await attendreCompte(page);
  // Le conseil d'accueil charge le contenu du moteur en ligne (comme pour un vrai utilisateur) avant d'aller sur « Spots ».
  await top3Affiche(page);
  await ecrireUnSpot(page, 'Pont de Cé');
  await ouvrirOnglet(page, 'Spots');
  await expect(rangee(page, 'Pont de Cé')).toBeVisible();
  expect(await tuilesGardeesAuZoom16(page)).toBe(0);

  await rangee(page, 'Pont de Cé').click();
  await page.getByRole('button', { name: /^Préparer ma sortie$/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sortie prête' })).toBeVisible();
  await expect.poll(() => tuilesGardeesAuZoom16(page), { timeout: 30_000 }).toBeGreaterThan(0);
  await onglet(page, 'Conseil');

  await modeAvion(page, true);
  reseau.tuilesRepondent = false;
  await ouvrirLaCarteHorsLigne(page, 'Pont de Cé');

  await expect.poll(() => tuilesAffichees(page).count()).toBeGreaterThan(0);
  expect(await tuilesSontDesImages(page)).toBe(true);
  expect(reseau.tuiles.filter((t) => Number(t.split('/')[0]) >= 17)).toEqual([]);
});

test('US 17 critère 3 : given l\'appareil en mode avion, when l\'utilisateur déplace la carte loin de tout spot, then les zones non mises en cache restent vides, sans message d\'erreur bloquant, et les marqueurs restent visibles', async ({ page, context }) => {
  test.setTimeout(120_000);
  const reseau = await doublerLeReseau(context);
  await ouvrirUneFoisEnLigne(page);
  await attendreCompte(page);
  await ouvrirOnglet(page, 'Spots');
  await ajouterSpot(page, 'Pont de Cé');
  await expect.poll(() => tuilesGardeesAuZoom16(page), { timeout: 30_000 }).toBeGreaterThan(0);
  await onglet(page, 'Conseil');

  await modeAvion(page, true);
  reseau.tuilesRepondent = false;
  await ouvrirLaCarteHorsLigne(page, 'Pont de Cé');
  // Autour du spot, le fond de carte est là (zone mise en cache) ...
  await expect.poll(() => tuilesAffichees(page).count()).toBeGreaterThan(0);

  // ... loin du spot, rien n'est en cache : on dézoome, puis on glisse la carte de plusieurs écrans.
  await zoomer(page, 6);
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  const avant = Number(await carte(page).getAttribute('data-centre-lng'));
  const boite = (await carte(page).boundingBox())!;
  const [x, y] = [boite.x + boite.width / 2, boite.y + boite.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 150, y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs(Number(await carte(page).getAttribute('data-centre-lng')) - avant)).toBeGreaterThan(1);

  // Les zones non gardées restent vides : aucune tuile affichée, aucune image cassée, aucun message d'erreur bloquant.
  await expect(tuilesAffichees(page)).toHaveCount(0);
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);
  await expect(page.locator('[role="alert"], [role="alertdialog"], ion-alert, ion-toast')).toHaveCount(0);
  await expect(carte(page)).toBeVisible();
  await page.locator('.leaflet-control-zoom-in').click();
  await expect.poll(async () => Number(await carte(page).getAttribute('data-zoom'))).toBe(7);
});
