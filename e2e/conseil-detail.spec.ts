import { test, expect, type Page } from '@playwright/test';
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

// Une carte de conseil : un conteneur le plus interne dont le texte contient « Animation : ».
const cartesConseil = (page: Page) =>
  page.locator('section, article, ion-card').filter({ hasText: /Animation\s*:/ }).filter({ hasNot: page.locator('section, article, ion-card') });

test('US 86 critère 1 : given l\'écran Conseil avec 3 cartes, when je touche la première, then le détail s\'ouvre avec couleur, où le lancer et au moins une phrase du pourquoi, et la ligne « Voir le détail » mesure 48 px', async ({ page }) => {
  await ouvrirLApp(page);
  await expect(cartesConseil(page)).toHaveCount(3);
  const ligne = cartesConseil(page).first().getByText('Voir le détail');
  const boite = await ligne.boundingBox();
  expect(boite!.height).toBeGreaterThanOrEqual(48);

  await ligne.click();

  await expect(page.getByText('Détail du conseil')).toBeVisible();
  await expect(page.getByText(/Couleur\s*:/)).toBeVisible();
  await expect(page.getByText(/Où le lancer\s*:/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pourquoi ce conseil' })).toBeVisible();
  expect(await page.locator('li').count()).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole('tab', { name: 'Conseil', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('US 86 critère 2 : given le détail ouvert, when je touche « Voir l\'animation », then la fiche de l\'animation s\'ouvre avec le geste, la vitesse et l\'erreur à éviter', async ({ page }) => {
  await ouvrirLApp(page);
  await cartesConseil(page).first().getByText('Voir le détail').click();
  await page.getByRole('button', { name: "Voir l'animation" }).click();

  await expect(page.getByText('Le geste', { exact: true })).toBeVisible();
  await expect(page.getByText('Vitesse', { exact: true })).toBeVisible();
  await expect(page.getByText('Erreur à éviter', { exact: true })).toBeVisible();
  await expect(page.getByText("La vidéo de l'animation arrive bientôt.")).toBeVisible();
});

test('US 86 critère 3 : given le détail ouvert, when je reviens en arrière, then l\'écran Conseil montre le même top 3', async ({ page }) => {
  await ouvrirLApp(page);
  await expect(cartesConseil(page)).toHaveCount(3);
  const avant = await cartesConseil(page).allInnerTexts();

  await cartesConseil(page).nth(1).getByText('Voir le détail').click();
  await expect(page.getByText('Détail du conseil')).toBeVisible();
  const retour = page.getByRole('button', { name: 'Conseil', exact: true });
  const boite = await retour.boundingBox();
  expect(boite!.height).toBeGreaterThanOrEqual(48);
  expect(boite!.width).toBeGreaterThanOrEqual(48);
  await page.goBack();

  await expect(page.getByText('Détail du conseil')).toHaveCount(0);
  await expect(cartesConseil(page)).toHaveCount(3);
  expect(await cartesConseil(page).allInnerTexts()).toEqual(avant);
  await expect(page.getByText('Calcul du conseil')).toHaveCount(0);
});
