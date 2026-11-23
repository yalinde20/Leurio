// US 11 : sans réseau, la boucle courte remplace la vidéo tierce dans la fiche (PLAN §3, §4, §9 bis, §11).
// Maquette : docs/maquettes/us-11-boucle-sans-reseau.html. Même montage que animation-video-tierce.spec.ts : contenu réel, émulateurs Firebase,
// requêtes vers un hôte non local coupées, faux lecteur YouTube. Le mode avion est `context.setOffline(true)`, activé APRÈS l'affichage des conseils
// et AVANT l'ouverture de la fiche ; le retour du réseau est `setOffline(false)` (événement `online` du navigateur), sans recharger la page.
// Limite : le clip de la boucle est servi par page.route (les .mp4 ne sont pas encore dans le build, décision US 9) ; « 404 » simule un fichier absent.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { CLE_ONBOARDING } from './onboarding-helpers';
import { attendreFirebase, enregistrerRequetes, EMULATEURS, estLocal, PROJET, profil } from './firebase-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MAINTENANT = new Date('2026-11-09T12:00:00Z');
const CLIP = readFileSync(join(__dirname, 'fixtures', 'boucle-test.webm'));
const PLATEFORMES = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|vimeo\.com|vimeocdn\.com|dailymotion\.com|dai\.ly)$/;
const TEXTE_HORS_LIGNE = 'Hors ligne : la vidéo complète sera disponible avec du réseau';
const TEXTE_SANS_BOUCLE = 'Vidéo disponible avec du réseau';
const QUESTION = 'Cette vidéo est hébergée par YouTube. La charger ?';

const versPlateformes = (urls: string[]) =>
  urls.filter((u) => {
    try {
      return PLATEFORMES.test(new URL(u).hostname);
    } catch {
      return false;
    }
  });

let boucleDisponible = true;

test.beforeEach(async ({ page }) => {
  boucleDisponible = true;
  await page.clock.setFixedTime(MAINTENANT);
  await page.addInitScript(
    ([cle, valeur]) => {
      if (!localStorage.getItem(cle)) localStorage.setItem(cle, valeur);
    },
    [CLE_ONBOARDING, JSON.stringify({ niveau: 'debutant', especesFavorites: ['SAN', 'BRO'] })],
  );
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>faux lecteur</title>' }));
  await page.route('**/assets/videos/*.mp4', (route) =>
    boucleDisponible ? route.fulfill({ status: 200, contentType: 'video/webm', body: CLIP }) : route.fulfill({ status: 404, body: '' }),
  );
  await page.route('https://hubeau.eaufrance.fr/**', (route) => {
    if (!route.request().url().includes('/temperature/chronique')) return route.abort();
    return route.fulfill({
      json: {
        data: [{ code_station: '04101000', libelle_station: 'La Maine à Angers', longitude: -0.5, latitude: 47.5, date_mesure_temp: '2026-11-09', heure_mesure_temp: '06:00:00', resultat: 11.5 }],
      },
    });
  });
});

type Reponse = boolean | null;

async function creerProfil(uid: string, video: Reponse): Promise<void> {
  const reponse = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        niveau: { stringValue: 'debutant' },
        especesFavorites: { arrayValue: { values: [{ stringValue: 'SAN' }, { stringValue: 'BRO' }] } },
        consentements: { mapValue: { fields: { analytics: { booleanValue: false }, video: video === null ? { nullValue: null } : { booleanValue: video } } } },
        createdAt: { integerValue: String(profil.createdAt) },
        plan: { stringValue: 'free' },
      },
    }),
  });
  expect(reponse.status).toBe(200);
}

/** Pose le profil, recharge, attend les conseils, puis coupe le réseau (mode avion) : la fiche s'ouvrira sans réseau. */
async function conseilsPuisModeAvion(page: Page, video: Reponse): Promise<void> {
  await page.goto('/');
  await attendreFirebase(page);
  await page.waitForFunction(() => !!localStorage.getItem('leurio.compte'), undefined, { timeout: 30_000 });
  const uid = await page.evaluate(() => localStorage.getItem('leurio.compte') as string);
  await creerProfil(uid, video);
  await page.reload();
  const carte = page.locator('section, article, ion-card').filter({ hasText: /Animation\s*:/ }).filter({ hasNot: page.locator('section, article, ion-card') }).first();
  await expect(carte.getByText('Voir le détail')).toBeVisible();
  // Les écrans sont chargés à la demande : on visite la fiche une fois avec du réseau (puis on revient aux conseils) pour que son code soit déjà là, comme pour un pêcheur qui a utilisé l'app.
  await ouvrirLaFiche(page);
  await page.goBack();
  await page.goBack();
  await expect(carte.getByText('Voir le détail')).toBeVisible();
  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
}

async function ouvrirLaFiche(page: Page): Promise<void> {
  await page.locator('section, article, ion-card').filter({ hasText: /Animation\s*:/ }).filter({ hasNot: page.locator('section, article, ion-card') }).first().getByText('Voir le détail').click();
  await page.getByRole('button', { name: "Voir l'animation" }).click();
  await expect(page.getByText('Le geste', { exact: true })).toBeVisible();
}

const retourDuReseau = async (page: Page) => {
  await page.context().setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
};

test("US 11 critère 1 : given le consentement accepté, une vidéo YouTube et une boucle, et le mode avion, when j'ouvre la fiche, then aucun lecteur tiers n'est chargé et la boucle est lue avec « Hors ligne : la vidéo complète sera disponible avec du réseau »", async ({ page }) => {
  const urls = enregistrerRequetes(page);
  await conseilsPuisModeAvion(page, true);
  await ouvrirLaFiche(page);

  await expect(page.getByText(TEXTE_HORS_LIGNE)).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Vidéo complète' })).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(1);
  await expect(page.getByText('Boucle · sans son')).toBeVisible();
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => !v.paused && v.readyState >= 2 && v.muted && v.loop), { timeout: 10_000 }).toBe(true);
  expect(versPlateformes(urls)).toEqual([]);
});

test("US 11 critère 2 : given une animation sans boucle utilisable et le mode avion, when j'ouvre la fiche, then la zone vidéo affiche « Vidéo disponible avec du réseau » et les textes de la fiche restent lisibles", async ({ page }) => {
  boucleDisponible = false;
  const urls = enregistrerRequetes(page);
  await conseilsPuisModeAvion(page, true);
  await ouvrirLaFiche(page);

  await expect(page.getByText(TEXTE_SANS_BOUCLE)).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByText('Le geste', { exact: true })).toBeVisible();
  await expect(page.getByText('Vitesse', { exact: true })).toBeVisible();
  await expect(page.getByText('Erreur à éviter', { exact: true })).toBeVisible();
  expect(versPlateformes(urls)).toEqual([]);
});

test('US 11 critère 3 : given la fiche ouverte hors ligne avec la boucle, when le réseau revient, then le lecteur tiers se charge à la place de la phrase, sans recharger la page', async ({ page }) => {
  await conseilsPuisModeAvion(page, true);
  await ouvrirLaFiche(page);
  await expect(page.getByText(TEXTE_HORS_LIGNE)).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);

  await retourDuReseau(page);

  await expect(page.locator('iframe')).toHaveCount(1);
  expect(new URL((await page.locator('iframe').getAttribute('src'))!).host).toBe('www.youtube-nocookie.com');
  await expect(page.getByRole('heading', { name: 'Vidéo complète' })).toBeVisible();
  await expect(page.getByText(TEXTE_HORS_LIGNE)).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(1);
});

test("US 11 cas limite : given le consentement jamais répondu et le mode avion, when j'ouvre la fiche puis que le réseau revient, then la question n'est posée qu'au retour du réseau, sans lecteur", async ({ page }) => {
  const urls = enregistrerRequetes(page);
  await conseilsPuisModeAvion(page, null);
  await ouvrirLaFiche(page);

  await expect(page.getByText(TEXTE_HORS_LIGNE)).toBeVisible();
  await expect(page.getByText(QUESTION)).toHaveCount(0);

  await retourDuReseau(page);

  await expect(page.getByText(QUESTION)).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(versPlateformes(urls)).toEqual([]);
});

test("US 11 cas limite : given le consentement refusé et le mode avion, when j'ouvre la fiche, then la boucle est lue seule, sans rubrique ni message de réseau", async ({ page }) => {
  await conseilsPuisModeAvion(page, false);
  await ouvrirLaFiche(page);

  await expect(page.locator('video')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Vidéo complète' })).toHaveCount(0);
  await expect(page.getByText(TEXTE_HORS_LIGNE)).toHaveCount(0);
  await expect(page.getByText(TEXTE_SANS_BOUCLE)).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
});
