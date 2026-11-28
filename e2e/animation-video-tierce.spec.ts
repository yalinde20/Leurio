// US 10 : lire la vidéo YouTube dans la fiche, après consentement (PLAN §7, §9 bis, §11). Maquette : docs/maquettes/us-10-video-tierce-consentement.html.
// Contenu réel (la première animation conseillée a une vidéo YouTube), émulateurs Firebase (Auth et Firestore). Aucune plateforme réelle :
// les requêtes vers un hôte non local sont coupées, et l'<iframe> de YouTube reçoit une page vide. On vérifie l'URL du lecteur,
// l'absence de toute requête vers une plateforme avant le consentement, et le choix écrit dans users/{uid}.consentements.video.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { CLE_ONBOARDING } from './onboarding-helpers';
import { attendreFirebase, enregistrerRequetes, EMULATEURS, estLocal, lireSurEmulateur, PROJET, profil } from './firebase-helpers';
import { coupUn } from './conseil-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MAINTENANT = new Date('2026-11-09T12:00:00Z');
// Les boucles « self » ne sont pas encore dans le build (décision US 9) : le clip de test de e2e/fixtures est servi à leur place, comme dans animation-boucle.spec.ts.
const CLIP = readFileSync(join(__dirname, 'fixtures', 'boucle-test.webm'));
const PLATEFORMES = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|vimeo\.com|vimeocdn\.com|dailymotion\.com|dai\.ly)$/;

const versPlateformes = (urls: string[]) =>
  urls.filter((u) => {
    try {
      return PLATEFORMES.test(new URL(u).hostname);
    } catch {
      return false;
    }
  });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(MAINTENANT);
  await page.addInitScript(
    ([cle, valeur]) => {
      if (!localStorage.getItem(cle)) localStorage.setItem(cle, valeur);
    },
    [CLE_ONBOARDING, JSON.stringify({ niveau: 'debutant', especesFavorites: ['SAN', 'BRO'] })],
  );
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
  // Le faux lecteur de YouTube : une page vide (la requête reste enregistrée par enregistrerRequetes).
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>faux lecteur</title>' }));
  await page.route('**/assets/videos/*.mp4', (route) => route.fulfill({ status: 200, contentType: 'video/webm', body: CLIP }));
  await page.route('https://hubeau.eaufrance.fr/**', (route) => {
    if (!route.request().url().includes('/temperature/chronique')) return route.abort();
    return route.fulfill({
      json: {
        data: [
          { code_station: '04101000', libelle_station: 'La Maine à Angers', longitude: -0.5, latitude: 47.5, date_mesure_temp: '2026-11-09', heure_mesure_temp: '06:00:00', resultat: 11.5 },
        ],
      },
    });
  });
});

type Reponse = boolean | null;

/** Pose users/{uid} avec ce consentement vidéo (null : jamais répondu) sur l'émulateur Firestore. */
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

async function avecProfil(page: Page, video: Reponse): Promise<string> {
  await page.goto('/');
  await attendreFirebase(page);
  await page.waitForFunction(() => !!localStorage.getItem('leurio.compte'), undefined, { timeout: 30_000 });
  const uid = await page.evaluate(() => localStorage.getItem('leurio.compte') as string);
  await creerProfil(uid, video);
  // L'app relit users/{uid} au prochain chargement.
  await page.reload();
  return uid;
}

async function ouvrirLaFiche(page: Page): Promise<void> {
  await coupUn(page).click();
  await page.getByRole('button', { name: "Voir l'animation" }).click();
  await expect(page.getByText('Le geste', { exact: true })).toBeVisible();
}

const consentementVideo = async (uid: string) => {
  const champs = (await lireSurEmulateur(uid)).body.fields as Record<string, { mapValue?: { fields?: Record<string, { booleanValue?: boolean; nullValue?: null }> } }>;
  const v = champs['consentements']?.mapValue?.fields?.['video'];
  return v && 'booleanValue' in v ? v.booleanValue : v && 'nullValue' in v ? null : undefined;
};

test('US 10 critère 1 : given une animation avec une vidéo YouTube et un pêcheur qui n\'a jamais répondu, when j\'ouvre la fiche, then aucun lecteur tiers n\'est chargé et le message de consentement s\'affiche', async ({ page }) => {
  const urls = enregistrerRequetes(page);
  await avecProfil(page, null);
  await ouvrirLaFiche(page);

  await expect(page.getByRole('heading', { name: 'Vidéo complète' })).toBeVisible();
  await expect(page.getByText('Cette vidéo est hébergée par YouTube. La charger ?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Charger la vidéo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Non merci' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(versPlateformes(urls)).toEqual([]);
});

test('US 10 critère 2 : given le message affiché, when je touche « Charger la vidéo », then le lecteur officiel YouTube s\'affiche avec start et users/{uid} contient consentements.video vrai', async ({ page }) => {
  const uid = await avecProfil(page, null);
  await ouvrirLaFiche(page);

  await page.getByRole('button', { name: 'Charger la vidéo' }).click();

  const lecteur = page.locator('iframe');
  await expect(lecteur).toHaveCount(1);
  const src = (await lecteur.getAttribute('src'))!;
  const url = new URL(src);
  expect(url.host).toBe('www.youtube-nocookie.com');
  expect(url.pathname).toMatch(/^\/embed\/[\w-]+$/);
  expect(url.searchParams.get('start')).not.toBeNull();
  expect(await lecteur.getAttribute('title')).toContain('YouTube');
  await expect(page.getByText('Cette vidéo est hébergée par YouTube. La charger ?')).toHaveCount(0);
  await expect.poll(() => consentementVideo(uid)).toBe(true);
});

test('US 10 critère 3 : given un pêcheur qui a déjà accepté la vidéo, when il ouvre la fiche, then le lecteur se charge sans redemander', async ({ page }) => {
  await avecProfil(page, true);
  await ouvrirLaFiche(page);

  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.getByText('Cette vidéo est hébergée par YouTube. La charger ?')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Charger la vidéo' })).toHaveCount(0);
});

test('US 10 critère 4 : given le message affiché, when je touche « Non merci », then aucun lecteur tiers n\'est chargé, la boucle reste, le refus est enregistré et la question n\'est plus posée', async ({ page }) => {
  const urls = enregistrerRequetes(page);
  const uid = await avecProfil(page, null);
  await ouvrirLaFiche(page);

  await page.getByRole('button', { name: 'Non merci' }).click();

  await expect(page.getByRole('heading', { name: 'Vidéo complète' })).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(1);
  await expect.poll(() => consentementVideo(uid)).toBe(false);

  await page.reload();
  await ouvrirLaFiche(page);
  await expect(page.getByText('Cette vidéo est hébergée par YouTube. La charger ?')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(versPlateformes(urls)).toEqual([]);
});
