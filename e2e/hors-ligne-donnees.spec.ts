// US 16 : garder la boîte et les spots accessibles hors ligne (PLAN §4 persistentLocalCache, §10 phase 5, §11).
// Sur les émulateurs ; le mode avion est `context.setOffline(true)` (coupe aussi les émulateurs locaux).
// Fermer puis rouvrir l'app (le service worker n'existe que dans le build de production) : e2e/hors-ligne-donnees.prod.spec.ts.
// Hors périmètre : la photo d'un leurre ajoutée hors ligne (Storage).
import { test, expect, type Page } from '@playwright/test';
import { estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';
import {
  ajouterLeurre, ajouterSpot, attendreCompte, bloquerLeReseauExterne, identifiantsUniques, leurresSurEmulateur, lierAUnEmail,
  ligneLeurre, ligneSpot, modeAvion, onglet, ouvrirOnglet, ouvrirSecondAppareil, spotsSurEmulateur,
} from './hors-ligne-donnees-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MAINTENANT = new Date('2026-11-24T08:00:00Z');
const HEURE_MS = 3_600_000;

function prevision(url: URL) {
  const heures = Array.from({ length: 193 }, (_, i) => new Date(MAINTENANT.getTime() + (i - 96) * HEURE_MS));
  const valeurs = { temperature_2m: 8, cloud_cover: 60, wind_speed_10m: 9, pressure_msl: 1014 };
  if (url.searchParams.has('current')) return { current: valeurs };
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

test.beforeEach(async ({ page, context }) => {
  await onboardingTermine(page);
  await bloquerLeReseauExterne(context);
});

async function ouvrir(page: Page): Promise<string> {
  await page.goto('/');
  return attendreCompte(page);
}

test('critère 1 : given la boîte et les spots chargés une fois avec du réseau, when l\'utilisateur ouvre « Boîte » puis « Spots » en mode avion, then ses leurres et ses spots s\'affichent', async ({ page }) => {
  test.setTimeout(90_000);
  const uid = await ouvrir(page);
  await ouvrirOnglet(page, 'Boîte');
  await ajouterLeurre(page, 'gardon');
  await ouvrirOnglet(page, 'Spots');
  await ajouterSpot(page, 'Pont de Cé');
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length + (await spotsSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(2);
  // On quitte les deux listes (elles se rouvrent ensuite sans réseau). Ici l'app n'est pas fermée : la preuve après fermeture et réouverture est dans hors-ligne-donnees.prod.spec.ts.
  await onglet(page, 'Compte');

  await modeAvion(page, true);
  await ouvrirOnglet(page, 'Boîte');
  await expect(ligneLeurre(page, 'gardon')).toHaveCount(1);
  await expect(ligneLeurre(page, 'gardon')).not.toContainText('Pas encore synchronisé');
  await ouvrirOnglet(page, 'Spots');
  await expect(ligneSpot(page, 'Pont de Cé')).toHaveCount(1);
  await expect(ligneSpot(page, 'Pont de Cé')).not.toContainText('Pas encore synchronisé');
});

test('critère 2 : given l\'appareil en mode avion, when l\'utilisateur ajoute un spot, then le spot s\'affiche dans la liste, et au retour du réseau il est enregistré sur son compte et visible depuis un autre appareil connecté au même compte', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const uid = await ouvrir(page);
  const id = identifiantsUniques();
  await lierAUnEmail(page, id);
  await ouvrirOnglet(page, 'Spots');

  await modeAvion(page, true);
  await ajouterSpot(page, 'Mode avion');
  await expect(ligneSpot(page, 'Mode avion')).toContainText('Pas encore synchronisé : il le sera au retour du réseau.');
  expect(await spotsSurEmulateur(uid)).toHaveLength(0);

  await modeAvion(page, false);
  await expect.poll(async () => (await spotsSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(1);
  expect((await spotsSurEmulateur(uid))[0]['nom'].stringValue).toBe('Mode avion');
  await expect(ligneSpot(page, 'Mode avion')).not.toContainText('Pas encore synchronisé');

  // Second appareil : même compte, autre stockage.
  const second = await ouvrirSecondAppareil(browser, id);
  try {
    expect(second.uid, 'même compte que le premier appareil').toBe(uid);
    await ouvrirOnglet(second.page, 'Spots');
    await expect(ligneSpot(second.page, 'Mode avion')).toHaveCount(1, { timeout: 20_000 });
  } finally {
    await second.context.close();
  }
});

test('critère 3 : given l\'appareil en mode avion, when l\'utilisateur ajoute un leurre à sa boîte, then le leurre s\'affiche dans la boîte et est enregistré sur son compte au retour du réseau', async ({ page }) => {
  test.setTimeout(90_000);
  const uid = await ouvrir(page);
  await ouvrirOnglet(page, 'Boîte');

  await modeAvion(page, true);
  await ajouterLeurre(page, 'perche');
  await expect(ligneLeurre(page, 'perche')).toContainText('Pas encore synchronisé : il le sera au retour du réseau.');
  expect(await leurresSurEmulateur(uid)).toHaveLength(0);

  await modeAvion(page, false);
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(1);
  expect((await leurresSurEmulateur(uid))[0]['couleur'].stringValue).toBe('perche');
  await expect(ligneLeurre(page, 'perche')).not.toContainText('Pas encore synchronisé');
});

test('critère 4 : given une sortie préparée, puis le mode avion, when l\'utilisateur passe par « Conseil », « Boîte » et « Spots », then le conseil, la boîte et les spots restent accessibles', async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(MAINTENANT);
  await page.route((url) => !estLocal(url.toString()), (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'api.open-meteo.com') return route.fulfill({ json: prevision(url) });
    return route.abort();
  });
  const uid = await ouvrir(page);
  await ouvrirOnglet(page, 'Boîte');
  await ajouterLeurre(page, 'gardon');
  await ouvrirOnglet(page, 'Spots');
  await ajouterSpot(page, 'Pont de Cé');
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length + (await spotsSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(2);
  await onglet(page, 'Conseil');
  await expect(page.getByRole('heading', { name: 'Conditions', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Préparer ma sortie$/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sortie prête' })).toBeVisible();

  await modeAvion(page, true);
  await page.getByRole('button', { name: /Moment/ }).first().click();
  const feuille = page.getByRole('dialog');
  await feuille.getByText('Demain', { exact: true }).click();
  await feuille.getByLabel('Heure').selectOption({ label: '12 h' });
  await feuille.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByRole('heading', { name: 'Ton top 3' })).toBeVisible();
  await expect(page.getByText('Conseil moins précis')).toHaveCount(0);

  await ouvrirOnglet(page, 'Boîte');
  await expect(ligneLeurre(page, 'gardon')).toHaveCount(1);
  await ouvrirOnglet(page, 'Spots');
  await expect(ligneSpot(page, 'Pont de Cé')).toHaveCount(1);
  await onglet(page, 'Conseil');
  await expect(page.getByRole('heading', { name: 'Ton top 3' })).toBeVisible();

  // §11 dans un seul scénario : un spot ajouté sans réseau est enregistré au retour du réseau.
  await ouvrirOnglet(page, 'Spots');
  await ajouterSpot(page, 'Au bord de l\'eau');
  await expect(ligneSpot(page, 'Au bord de l\'eau')).toContainText('Pas encore synchronisé');
  await modeAvion(page, false);
  await expect.poll(async () => (await spotsSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(2);
  await expect(ligneSpot(page, 'Au bord de l\'eau')).not.toContainText('Pas encore synchronisé');
});
