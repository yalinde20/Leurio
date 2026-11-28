import { test, expect, type Page } from '@playwright/test';
import { conseilAffiche, coupUn, ouvrirAutresCoups, ouvrirDetailDuCoup, tousLesCoups } from './conseil-helpers';
import { onboardingTermine } from './onboarding-helpers';

// US 89 : l'onboarding est terminé, l'app s'ouvre sur le Conseil (fixture, aucune assertion changée).
test.beforeEach(async ({ page }) => onboardingTermine(page));

// US 86 : détail d'un conseil, fiche animation et retour, avec l'app réelle sur un téléphone (iPhone, 390 px).
// Aucun service réel : position simulée, Hub'Eau répond par un faux relevé, Open-Meteo est coupé.
// Le moment est fixé au 9 novembre 2026 à 13 h (Paris), dans les heures légales d'Angers.

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MAINTENANT = new Date('2026-11-09T12:00:00Z');

async function ouvrirLApp(page: Page): Promise<void> {
  await page.clock.setFixedTime(MAINTENANT);
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
            date_mesure_temp: MAINTENANT.toISOString().slice(0, 10),
            heure_mesure_temp: '06:00:00',
            resultat: 11.5,
          },
        ],
      },
    });
  });
  await page.route(/open-meteo\.com/, (route) => route.abort());
  await page.goto('/');
}

// US 295 : le coup « 01 » est un lien de la rivière en coupe ; « 02 » et « 03 » sont dans la feuille « 2 autres coups ».

test('US 86 critère 1 : given l\'écran Conseil avec 3 coups, when je touche le coup 01, then le détail s\'ouvre avec couleur, où le lancer et au moins une phrase du pourquoi, et le lien du coup mesure 48 px', async ({ page }) => {
  await ouvrirLApp(page);
  await conseilAffiche(page);
  const boite = await coupUn(page).boundingBox();
  expect(boite!.height).toBeGreaterThanOrEqual(48);

  await coupUn(page).click();

  await expect(page.getByText('Détail du conseil')).toBeVisible();
  await expect(page.getByText(/Couleur\s*:/)).toBeVisible();
  await expect(page.getByText(/Où le lancer\s*:/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pourquoi ce conseil' })).toBeVisible();
  expect(await page.locator('li').count()).toBeGreaterThanOrEqual(1);
  await expect(page).toHaveURL(/\/conseil\/detail\//);
});

test('US 86 critère 2 : given le détail ouvert, when je touche « Voir l\'animation », then la fiche de l\'animation s\'ouvre avec le geste, la vitesse et l\'erreur à éviter', async ({ page }) => {
  await ouvrirLApp(page);
  await ouvrirDetailDuCoup(page, 1);
  await page.getByRole('button', { name: "Voir l'animation" }).click();

  await expect(page.getByText('Le geste', { exact: true })).toBeVisible();
  await expect(page.getByText('Vitesse', { exact: true })).toBeVisible();
  await expect(page.getByText('Erreur à éviter', { exact: true })).toBeVisible();
  await expect(page.getByText("La vidéo de l'animation arrive bientôt.")).toHaveCount(0);
});

test('US 86 critère 3 : given le détail ouvert, when je reviens en arrière, then l\'écran Conseil montre le même top 3', async ({ page }) => {
  await ouvrirLApp(page);
  const textes = async () => Promise.all((await tousLesCoups(page)).map((c) => c.innerText()));
  const avant = await textes();
  expect(avant).toHaveLength(3);
  await page.getByRole('dialog', { name: /autres? coups?/ }).getByRole('button', { name: 'Fermer' }).click();

  await ouvrirDetailDuCoup(page, 2);
  await expect(page.getByText('Détail du conseil')).toBeVisible();
  const retour = page.getByRole('button', { name: 'Conseil', exact: true });
  const boite = await retour.boundingBox();
  expect(boite!.height).toBeGreaterThanOrEqual(48);
  expect(boite!.width).toBeGreaterThanOrEqual(48);
  await page.goBack();

  await expect(page.getByText('Détail du conseil')).toHaveCount(0);
  await conseilAffiche(page);
  expect(await textes()).toEqual(avant);
  await expect(page.getByText('Calcul du conseil')).toHaveCount(0);
});
