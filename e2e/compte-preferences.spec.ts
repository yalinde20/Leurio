// US 93 : modifier mes espèces favorites, mon niveau et mes unités depuis Compte (PLAN §3, §4, §7, §11).
// Maquette : docs/maquettes/us-93-preferences.html. Contenu réel, émulateurs Firebase (Auth et Firestore) ; tout service externe est coupé
// (Hub'Eau répond par un faux relevé, Open-Meteo et le reste sont abandonnés).
// Contrat : route `compte/preferences` (ligne « Préférences » du groupe « Réglages » de Compte), cases par espèce, radios « Débutant »,
// « Intermédiaire », « Métriques (°C, cm, g) » et « Impériales (°F, po, oz) », mention « Pas encore synchronisé : ce sera fait au retour du réseau. ».
import { test, expect, type Page } from '@playwright/test';
import { CLE_ONBOARDING } from './onboarding-helpers';
import { attendreFirebase, EMULATEURS, estLocal, lireSurEmulateur, PROJET, profil } from './firebase-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MENTION = 'Pas encore synchronisé : ce sera fait au retour du réseau.';

/** Les choix de l'onboarding gardés sur l'appareil, identiques au profil créé sur l'émulateur (SAN, BRO ; Débutant). */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([cle, valeur]) => {
      if (!localStorage.getItem(cle)) localStorage.setItem(cle, valeur);
    },
    [CLE_ONBOARDING, JSON.stringify({ niveau: 'debutant', especesFavorites: ['SAN', 'BRO'] })],
  );
  // Aucun service réel : tout ce qui n'est pas local est coupé, sauf le faux relevé Hub'Eau.
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
  const maintenant = new Date();
  await page.route('https://hubeau.eaufrance.fr/**', (route) => {
    if (!route.request().url().includes('/temperature/chronique')) return route.abort();
    return route.fulfill({
      json: {
        data: [
          {
            code_station: '04101000',
            libelle_station: 'La Maine à Angers',
            longitude: -0.5,
            latitude: 47.5,
            date_mesure_temp: maintenant.toISOString().slice(0, 10),
            heure_mesure_temp: '06:00:00',
            resultat: 11.5,
          },
        ],
      },
    });
  });
});

/** Crée le profil users/{uid} directement sur l'émulateur Firestore (REST, jeton « owner » : hors règles). */
async function creerProfilSurEmulateur(uid: string): Promise<void> {
  const valeur = (v: string) => ({ stringValue: v });
  const reponse = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        niveau: valeur('debutant'),
        especesFavorites: { arrayValue: { values: [valeur('SAN'), valeur('BRO')] } },
        consentements: { mapValue: { fields: { analytics: { booleanValue: false }, video: { booleanValue: false } } } },
        createdAt: { integerValue: String(profil.createdAt) },
        plan: valeur('free'),
      },
    }),
  });
  expect(reponse.status).toBe(200);
}

/** Ouvre l'app, crée le compte anonyme et son profil users/{uid} sur l'émulateur (ce que l'onboarding a fait), rend l'uid. */
async function avecProfil(page: Page): Promise<string> {
  await page.goto('/');
  await attendreFirebase(page);
  // On attend le compte que l'app crée elle-même au lancement (marqueur `leurio.compte` écrit une fois le profil en place) : c'est son uid qui sert.
  await page.waitForFunction(() => !!localStorage.getItem('leurio.compte'), undefined, { timeout: 30_000 });
  const uid = await page.evaluate(() => localStorage.getItem('leurio.compte') as string);
  await creerProfilSurEmulateur(uid);
  return uid;
}

async function ouvrirPreferences(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Compte', exact: true }).click();
  await expect(page.getByText('Réglages', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Préférences/ }).click();
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Préférences');
}

const champ = async (uid: string) => (await lireSurEmulateur(uid)).body.fields as Record<string, any>;
const especesDe = (fields: Record<string, any>): string[] => (fields['especesFavorites']?.arrayValue?.values ?? []).map((v: any) => v.stringValue);

test('critère 1 : given j\'ai terminé l\'onboarding (Débutant, Sandre et Brochet), when j\'ouvre « Préférences » dans Compte, then mes espèces et mon niveau sont sélectionnés et les 7 espèces du contenu sont listées dans son ordre', async ({ page }) => {
  await avecProfil(page);
  await ouvrirPreferences(page);

  await expect(page.getByRole('checkbox')).toHaveCount(7);
  const noms = await page.getByRole('checkbox').evaluateAll((els) => els.map((e) => (e.closest('label')?.textContent ?? e.getAttribute('aria-label') ?? '').trim()));
  expect(noms).toEqual(['Brochet', 'Sandre', 'Perche', 'Black-bass', 'Chevesne', 'Aspe', 'Silure']);
  for (const [nom, coche] of [['Brochet', true], ['Sandre', true], ['Perche', false], ['Black-bass', false], ['Chevesne', false], ['Aspe', false], ['Silure', false]] as const) {
    if (coche) await expect(page.getByRole('checkbox', { name: nom })).toBeChecked();
    else await expect(page.getByRole('checkbox', { name: nom })).not.toBeChecked();
  }
  await expect(page.getByRole('radio', { name: /Débutant/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Intermédiaire/ })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: /Métriques/ })).toBeChecked();
  await expect(page.getByText(MENTION)).toHaveCount(0);
});

test('critère 2 : given « Préférences » est ouvert en « Débutant », when je choisis « Intermédiaire », then users/{uid} contient niveau intermediaire et la copie de l\'appareil aussi', async ({ page }) => {
  const uid = await avecProfil(page);
  await ouvrirPreferences(page);

  await page.getByRole('radio', { name: /Intermédiaire/ }).check({ force: true });
  await expect(page.getByRole('radio', { name: /Intermédiaire/ })).toBeChecked();

  await expect.poll(async () => (await champ(uid))['niveau']?.stringValue).toBe('intermediaire');
  expect(especesDe(await champ(uid))).toEqual(['SAN', 'BRO']); // les autres champs ne bougent pas
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CLE_ONBOARDING)) ?? 'null').niveau).toBe('intermediaire');

  // Le conseil suivant est calculé pour ce niveau : l'écran Conseil s'affiche sans erreur avec le nouveau niveau gardé.
  await page.getByRole('tab', { name: 'Conseil', exact: true }).click();
  await expect(page.getByText('Ton top 3')).toBeVisible();
});

test('critère 3 : given « Préférences » est ouvert, when je coche « Perche » puis décoche « Sandre », then especesFavorites de users/{uid} est mis à jour à chaque fois', async ({ page }) => {
  const uid = await avecProfil(page);
  await ouvrirPreferences(page);

  await page.getByRole('checkbox', { name: 'Perche' }).check({ force: true });
  await expect.poll(async () => especesDe(await champ(uid))).toEqual(['BRO', 'SAN', 'PER']);

  await page.getByRole('checkbox', { name: 'Sandre' }).uncheck({ force: true });
  await expect.poll(async () => especesDe(await champ(uid))).toEqual(['BRO', 'PER']);
  expect((await champ(uid))['niveau']?.stringValue).toBe('debutant');
  await expect(page.getByRole('checkbox', { name: 'Sandre' })).not.toBeChecked();
});

test('critère 4 : given « Préférences » est ouvert, when je choisis « Impériales », then le Conseil montre l\'eau en °F et les tailles en po ou oz, et en revenant à « Métriques » tout repasse en °C, cm et g', async ({ page }) => {
  // Le moment est fixé au 9 novembre 2026 à 13 h (Paris), dans les heures légales d'Angers : le conseil s'affiche (comme conseil-top3.spec.ts).
  await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
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
  const eauMetrique = /Température de l.eau\s*:\s*11,5\s*°C/;
  const eauImperiale = /Température de l.eau\s*:\s*52,7\s*°F/;
  const tailleMetrique = /(Taille|Poids)\s*:\s*[\d,]+\s*(cm|g)\b/;
  const tailleImperiale = /(Taille|Poids)\s*:\s*[\d,]+\s*(po|oz)\b/;
  const conseil = page.locator('ion-content:visible');

  await avecProfil(page);
  await page.getByRole('tab', { name: 'Conseil', exact: true }).click();
  await expect(conseil).toContainText(eauMetrique);
  await expect(conseil).toContainText(tailleMetrique);

  await ouvrirPreferences(page);
  await page.getByRole('radio', { name: /Impériales/ }).check({ force: true });
  await expect(page.getByRole('radio', { name: /Impériales/ })).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('leurio.unites'))).toBe('imperiales');

  await page.getByRole('tab', { name: 'Conseil', exact: true }).click();
  await expect(conseil).toContainText(eauImperiale);
  await expect(conseil).toContainText(tailleImperiale);
  await expect(conseil).not.toContainText(eauMetrique);
  await expect(conseil).not.toContainText(tailleMetrique);

  await ouvrirPreferences(page);
  await page.getByRole('radio', { name: /Métriques/ }).check({ force: true });
  await page.getByRole('tab', { name: 'Conseil', exact: true }).click();
  await expect(conseil).toContainText(eauMetrique);
  await expect(conseil).toContainText(tailleMetrique);
  await expect(conseil).not.toContainText('°F');
});

test('critère 5 : given je n\'ai pas de réseau, when je change mon niveau, then il s\'applique tout de suite avec la mention « Pas encore synchronisé », puis users/{uid} est mis à jour au retour du réseau et la mention disparaît', async ({ page, context }) => {
  test.setTimeout(90_000);
  const uid = await avecProfil(page);
  await ouvrirPreferences(page);

  await context.setOffline(true);
  await page.getByRole('radio', { name: /Intermédiaire/ }).check({ force: true });

  // Appliqué tout de suite, sans réseau.
  await expect(page.getByRole('radio', { name: /Intermédiaire/ })).toBeChecked();
  await expect(page.getByText(MENTION)).toBeVisible();
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CLE_ONBOARDING)) ?? 'null').niveau).toBe('intermediaire');
  expect((await champ(uid))['niveau']?.stringValue).toBe('debutant'); // pas encore sur le serveur

  await context.setOffline(false);
  await expect.poll(async () => (await champ(uid))['niveau']?.stringValue, { timeout: 30_000 }).toBe('intermediaire');
  await expect(page.getByText(MENTION)).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('radio', { name: /Intermédiaire/ })).toBeChecked();
});
