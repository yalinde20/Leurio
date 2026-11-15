// US 94 : modifier mes consentements depuis Compte (PLAN §4, §7, §9 bis, §11). Maquette : docs/maquettes/us-94-consentements.html.
// Contenu réel, émulateurs Firebase (Auth et Firestore) ; tout service externe est coupé (Hub'Eau répond par un faux relevé).
// Périmètre (option A) : le SDK Analytics (US 19), la boucle courte (US 9) et le lecteur tiers (US 10) ne sont pas faits ; on prouve
// qu'avec les consentements refusés, rien de Google Analytics ni d'une plateforme vidéo n'est demandé.
// Contrat : route `compte/consentements` (ligne « Consentements » du groupe « Réglages »), deux interrupteurs « Mesure d’audience (Analytics) »
// et « Lecteurs vidéo tiers » (rôle `switch` ou `checkbox`), mention « Pas encore synchronisé : ce sera fait au retour du réseau. ».
import { test, expect, type Locator, type Page } from '@playwright/test';
import { CLE_ONBOARDING } from './onboarding-helpers';
import { attendreFirebase, enregistrerRequetes, EMULATEURS, estLocal, lireSurEmulateur, PROJET, profil } from './firebase-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MENTION = 'Pas encore synchronisé : ce sera fait au retour du réseau.';
const ANALYTICS = 'Mesure d’audience (Analytics)';
const VIDEO = 'Lecteurs vidéo tiers';
const MAINTENANT = new Date('2026-11-09T12:00:00Z');
const DOMAINES_ANALYTICS = /(^|\.)(google-analytics\.com|googletagmanager\.com|analytics\.google\.com)$/;
const DOMAINES_VIDEO = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|vimeocdn\.com|dailymotion\.com|dai\.ly)$/;

const versDomaines = (urls: string[], motif: RegExp) =>
  urls.filter((u) => {
    try {
      return motif.test(new URL(u).hostname);
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
  // Aucun service réel : tout ce qui n'est pas local est coupé, sauf le faux relevé Hub'Eau.
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
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

/** Crée le profil users/{uid} sur l'émulateur Firestore (REST, jeton « owner » : hors règles). */
async function creerProfilSurEmulateur(uid: string, analytics: boolean, video: boolean): Promise<void> {
  const reponse = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        niveau: { stringValue: 'debutant' },
        especesFavorites: { arrayValue: { values: [{ stringValue: 'SAN' }, { stringValue: 'BRO' }] } },
        consentements: { mapValue: { fields: { analytics: { booleanValue: analytics }, video: { booleanValue: video } } } },
        createdAt: { integerValue: String(profil.createdAt) },
        plan: { stringValue: 'free' },
      },
    }),
  });
  expect(reponse.status).toBe(200);
}

/** Ouvre l'app, attend le compte anonyme qu'elle crée, y pose users/{uid} avec ces consentements, rend l'uid. */
async function avecProfil(page: Page, analytics = false, video = false): Promise<string> {
  await page.goto('/');
  await attendreFirebase(page);
  await page.waitForFunction(() => !!localStorage.getItem('leurio.compte'), undefined, { timeout: 30_000 });
  const uid = await page.evaluate(() => localStorage.getItem('leurio.compte') as string);
  await creerProfilSurEmulateur(uid, analytics, video);
  return uid;
}

async function ouvrirConsentements(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Compte', exact: true }).click();
  await expect(page.getByText('Réglages', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Consentements/ }).click();
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Consentements');
}

const interrupteur = (page: Page, nom: string): Locator => page.getByRole('switch', { name: nom }).or(page.getByRole('checkbox', { name: nom })).first();
const consentements = async (uid: string) => {
  const champs = (await lireSurEmulateur(uid)).body.fields as Record<string, { mapValue?: { fields?: Record<string, { booleanValue?: boolean }> } }>;
  const f = champs['consentements']?.mapValue?.fields ?? {};
  return { analytics: f['analytics']?.booleanValue, video: f['video']?.booleanValue };
};

test('critère 1 : given j\'ai refusé les deux consentements, when j\'ouvre « Consentements » dans Compte, then « Mesure d’audience (Analytics) » et « Lecteurs vidéo tiers » sont désactivés', async ({ page }) => {
  await avecProfil(page, false, false);
  await ouvrirConsentements(page);

  await expect(interrupteur(page, ANALYTICS)).not.toBeChecked();
  await expect(interrupteur(page, VIDEO)).not.toBeChecked();
  await expect(page.getByText(MENTION)).toHaveCount(0);
});

test('critère 1 : given users/{uid} a analytics vrai et video vrai, when j\'ouvre « Consentements », then les deux interrupteurs sont activés', async ({ page }) => {
  await avecProfil(page, true, true);
  await ouvrirConsentements(page);

  await expect(interrupteur(page, ANALYTICS)).toBeChecked();
  await expect(interrupteur(page, VIDEO)).toBeChecked();
});

test('critère 2 : given « Mesure d’audience (Analytics) » est désactivé, when j\'utilise l\'app (Conseil, Boîte, Spots, Compte, Consentements), then aucune requête ne part vers Google Analytics', async ({ page }) => {
  const urls = enregistrerRequetes(page);
  await avecProfil(page, false, false);
  await ouvrirConsentements(page);
  await expect(interrupteur(page, ANALYTICS)).not.toBeChecked();

  for (const onglet of ['Conseil', 'Boîte', 'Spots', 'Compte']) {
    await page.getByRole('tab', { name: onglet, exact: true }).click();
    await expect(page.getByRole('tab', { name: onglet, exact: true })).toHaveAttribute('aria-selected', 'true');
  }

  expect(versDomaines(urls, DOMAINES_ANALYTICS)).toEqual([]);
  expect(await page.locator('script[src*="googletagmanager"], script[src*="google-analytics"]').count()).toBe(0);
});

test('critère 3 : given « Mesure d’audience (Analytics) » est désactivé, when je l\'active, then il reste activé et users/{uid} contient consentements.analytics vrai (video inchangé)', async ({ page }) => {
  const uid = await avecProfil(page, false, false);
  await ouvrirConsentements(page);

  await interrupteur(page, ANALYTICS).click();

  await expect(interrupteur(page, ANALYTICS)).toBeChecked();
  await expect.poll(async () => (await consentements(uid)).analytics).toBe(true);
  expect((await consentements(uid)).video).toBe(false);
});

test('critère 4 : given « Lecteurs vidéo tiers » est désactivé, when j\'ouvre une fiche animation, then aucun lecteur ni aucune requête YouTube, Vimeo ou Dailymotion n\'est chargé', async ({ page }) => {
  const urls = enregistrerRequetes(page);
  await avecProfil(page, false, false);
  await ouvrirConsentements(page);
  await expect(interrupteur(page, VIDEO)).not.toBeChecked();

  await page.getByRole('tab', { name: 'Conseil', exact: true }).click();
  const carte = page.locator('section, article, ion-card').filter({ hasText: /Animation\s*:/ }).filter({ hasNot: page.locator('section, article, ion-card') }).first();
  await carte.getByText('Voir le détail').click();
  await page.getByRole('button', { name: "Voir l'animation" }).click();
  await expect(page.getByText('Le geste', { exact: true })).toBeVisible();

  expect(versDomaines(urls, DOMAINES_VIDEO)).toEqual([]);
  expect(await page.locator('iframe').count()).toBe(0);
  // Non prouvé ici : « la boucle courte reste lisible » (US 9, pas encore faite).
});

test('critère 5 : given « Lecteurs vidéo tiers » est désactivé, when je l\'active, then il reste activé et users/{uid} contient consentements.video vrai (analytics inchangé)', async ({ page }) => {
  const uid = await avecProfil(page, false, false);
  await ouvrirConsentements(page);

  await interrupteur(page, VIDEO).click();

  await expect(interrupteur(page, VIDEO)).toBeChecked();
  await expect.poll(async () => (await consentements(uid)).video).toBe(true);
  expect((await consentements(uid)).analytics).toBe(false);
});

test('critère 5 : given j\'ai activé « Lecteurs vidéo tiers », when je recharge l\'app et rouvre « Consentements », then l\'interrupteur est toujours activé (valeur lue dans users/{uid})', async ({ page }) => {
  const uid = await avecProfil(page, false, false);
  await ouvrirConsentements(page);
  await interrupteur(page, VIDEO).click();
  await expect.poll(async () => (await consentements(uid)).video).toBe(true);

  await page.reload();
  await attendreFirebase(page);
  await ouvrirConsentements(page);

  await expect(interrupteur(page, VIDEO)).toBeChecked();
  await expect(interrupteur(page, ANALYTICS)).not.toBeChecked();
});

test('critère 3 : given je n\'ai pas de réseau, when j\'active « Mesure d’audience (Analytics) », then il s\'applique tout de suite avec la mention « Pas encore synchronisé », puis users/{uid} est mis à jour au retour du réseau et la mention disparaît', async ({ page, context }) => {
  test.setTimeout(90_000);
  const uid = await avecProfil(page, false, false);
  await ouvrirConsentements(page);

  await context.setOffline(true);
  await interrupteur(page, ANALYTICS).click();

  await expect(interrupteur(page, ANALYTICS)).toBeChecked();
  await expect(page.getByText(MENTION)).toBeVisible();
  expect((await consentements(uid)).analytics).toBe(false); // pas encore sur le serveur

  await context.setOffline(false);
  await expect.poll(async () => (await consentements(uid)).analytics, { timeout: 30_000 }).toBe(true);
  await expect(page.getByText(MENTION)).toHaveCount(0, { timeout: 30_000 });
  await expect(interrupteur(page, ANALYTICS)).toBeChecked();
});
