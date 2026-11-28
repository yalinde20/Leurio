import { test, expect, type Page } from '@playwright/test';
import { conseilAffiche, ligneEtat, riviere, tousLesCoups } from './conseil-helpers';
import { onboardingTermine } from './onboarding-helpers';

// US 89 : l'onboarding est terminé, l'app s'ouvre sur le Conseil (fixture, aucune assertion changée).
test.beforeEach(async ({ page }) => onboardingTermine(page));

// US 81, critères 1 et 8 : le top 3 du moment, avec l'app réelle sur un téléphone (iPhone, 390 px).
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


// US 295 : l'écran Conseil « rivière en coupe » : le lieu en titre, les conditions (eau, météo, état réglementaire) et le coup 01 sans aucun tap,
// puis les coups 02 et 03 dans la feuille « 2 autres coups ».
test('US 81 critère 1 : given l\'onboarding terminé, la localisation autorisée et un moment dans les heures légales, when j\'ouvre l\'app, then l\'écran « Conseil » montre les conditions et le top 3 (le coup 01, puis 02 et 03) sans aucun tap', async ({ page }) => {
  await ouvrirLApp(page);

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ma position');
  await expect(riviere(page)).toBeVisible();
  await expect(page.getByText(/11,5\s°C/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /vent/i })).toBeVisible();
  await expect(ligneEtat(page, /^Pêche ouverte jusqu.à/)).toBeVisible();
  await conseilAffiche(page);
  const coups = await tousLesCoups(page);
  for (const coup of coups) await expect(coup).toBeVisible();
  await expect(page.getByText('Hors des heures légales')).toHaveCount(0);
});

test('US 81 critère 8 : given l\'écran Conseil affiché sur un téléphone, when on mesure ses boutons, then chaque bouton mesure au moins 48 × 48 px', async ({ page }) => {
  await ouvrirLApp(page);
  await conseilAffiche(page);
  const bouton = page.getByRole('navigation', { name: 'Navigation' }).getByRole('button', { name: 'Ma sortie' });
  await expect(bouton).toBeVisible();

  const cibles = page.locator('button:visible, a:visible, ion-button:visible, [role="button"]:visible');
  const nombre = await cibles.count();
  expect(nombre).toBeGreaterThan(3); // 3 boutons du dock et l'avatar au moins
  for (let i = 0; i < nombre; i++) {
    const cible = cibles.nth(i);
    await cible.scrollIntoViewIfNeeded();
    const boite = await cible.boundingBox();
    const nom = ((await cible.textContent()) ?? '').trim() || (await cible.getAttribute('aria-label')) || `cible ${i}`;
    expect(boite!.height, `hauteur de « ${nom} »`).toBeGreaterThanOrEqual(48);
    expect(boite!.width, `largeur de « ${nom} »`).toBeGreaterThanOrEqual(48);
  }
});

test('US 295 : given l\'écran Conseil, when le coup 01 s\'affiche, then il porte le pictogramme de la famille de son leurre (composant partagé de l\'US 293)', async ({ page }) => {
  await ouvrirLApp(page);
  await conseilAffiche(page);

  await expect(page.getByRole('region', { name: 'Rivière en coupe' }).getByRole('link', { name: /^01\b/ }).locator('app-pictogramme-famille svg').locator('path, line, circle, rect, polyline, polygon, ellipse').first()).toBeAttached();
});
