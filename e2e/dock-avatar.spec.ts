import { test, expect, type Page } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';
import { estLocal } from './firebase-helpers';
import { lireThemes } from './tokens';

// US 294 : le dock (Boîte · Ma sortie · Spots) et l'avatar Compte remplacent la barre de 4 onglets (PLAN §3).
// Maquette validée : docs/maquettes/us-294-dock-et-avatar.html.
// Aucun service réel : position simulée, Hub'Eau coupé, Open-Meteo répond par une prévision fabriquée ici.
// Le moment est fixé au 9 novembre 2026 à 13 h (Paris), dans les heures légales d'Angers.

test.beforeEach(async ({ page }) => onboardingTermine(page));

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const MAINTENANT = new Date('2026-11-09T12:00:00Z');
const HEURE_MS = 3_600_000;

function reponseOpenMeteo(url: URL) {
  const heures = Array.from({ length: 193 }, (_, i) => new Date(MAINTENANT.getTime() + (i - 96) * HEURE_MS));
  const gmt = (h: Date) => h.toISOString().slice(0, 13) + ':00';
  const valeurs = { temperature_2m: 8, cloud_cover: 60, wind_speed_10m: 9, pressure_msl: 1014 };
  if (url.searchParams.has('current')) return { current: valeurs };
  return {
    hourly: {
      time: heures.map(gmt),
      temperature_2m: heures.map(() => 8),
      cloud_cover: heures.map(() => 60),
      wind_speed_10m: heures.map(() => 9),
      pressure_msl: heures.map((_, i) => 1000 + (i % 30)),
    },
  };
}

/** `delaiMeteoMs` retarde Open-Meteo pour pouvoir observer l'état « Préparation… ». */
async function ouvrirLApp(page: Page, chemin = '/', delaiMeteoMs = 0): Promise<void> {
  await page.clock.setFixedTime(MAINTENANT);
  await page.route((url) => !estLocal(url.toString()), async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'api.open-meteo.com') {
      if (delaiMeteoMs) await new Promise((r) => setTimeout(r, delaiMeteoMs));
      return route.fulfill({ json: reponseOpenMeteo(url) });
    }
    return route.abort();
  });
  await page.goto(chemin);
}

const dock = (page: Page) => page.getByRole('navigation', { name: 'Navigation' });
const lienBoite = (page: Page) => dock(page).getByRole('link', { name: 'Boîte', exact: true });
const boutonSortie = (page: Page) => dock(page).getByRole('button', { name: /^Ma sortie$/ });
const lienSpots = (page: Page) => dock(page).getByRole('link', { name: 'Spots', exact: true });
const avatar = (page: Page) => page.getByRole('button', { name: 'Compte', exact: true });
const retour = (page: Page) => page.getByRole('button', { name: 'Conseil', exact: true });
const titreVisible = (page: Page) => page.locator('ion-toolbar ion-title:visible');

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

test("US 294 critère 0 : given l'app fermée, when on l'ouvre, then l'écran Conseil s'affiche sans aucun tap et aucune barre d'onglets n'est visible", async ({ page }) => {
  await ouvrirLApp(page);

  await expect(titreVisible(page)).toHaveText('Conseil');
  await expect(page).toHaveURL(/\/conseil$/);
  await expect(dock(page)).toBeVisible(); // le Conseil porte le dock, pas une barre d'onglets
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('ion-tab-bar:visible, ion-tab-button:visible')).toHaveCount(0);
});

test("US 294 critère 1 : given l'écran Conseil, when on regarde le bas de l'écran, then le dock montre dans cet ordre « Boîte », « Ma sortie » et « Spots », et « Ma sortie » porte la couleur d'action", async ({ page }) => {
  await ouvrirLApp(page);

  await expect(dock(page).locator('a, button')).toHaveText(['Boîte', 'Ma sortie', 'Spots']);
  await expect(lienBoite(page)).toBeVisible();
  await expect(boutonSortie(page)).toBeVisible();
  await expect(lienSpots(page)).toBeVisible();
  // Le dock est en bas de l'écran.
  const boite = await dock(page).boundingBox();
  expect(boite!.y + boite!.height).toBeGreaterThan(844 - 10);

  const clair = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const tokens = lireThemes()[clair ? 'sombre' : 'clair'];
  const style = await boutonSortie(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return { fond: s.backgroundColor, texte: s.color };
  });
  expect(style.fond).toBe(rgb(tokens['--lr-primaire']));
  expect(style.texte).toBe(rgb(tokens['--lr-sur-primaire']));
});

test("US 294 critère 2 : given l'écran Conseil, when on touche « Boîte » puis le bouton retour, then l'écran Boîte s'affiche, puis l'écran Conseil revient", async ({ page }) => {
  await ouvrirLApp(page);

  await lienBoite(page).click();
  await expect(titreVisible(page)).toHaveText('Boîte');
  await expect(retour(page)).toBeVisible();

  await retour(page).click();
  await expect(titreVisible(page)).toHaveText('Conseil');
  await expect(dock(page)).toBeVisible();
});

test("US 294 critère 3 : given l'écran Conseil, when on touche « Spots », then l'écran Spots s'affiche avec un bouton de retour au Conseil", async ({ page }) => {
  await ouvrirLApp(page);

  await lienSpots(page).click();
  await expect(titreVisible(page)).toHaveText('Spots');
  await expect(retour(page)).toBeVisible();
  await retour(page).click();
  await expect(titreVisible(page)).toHaveText('Conseil');
});

test("US 294 critère 4 : given l'écran Conseil, when on touche l'avatar nommé « Compte », then l'écran Compte s'affiche", async ({ page }) => {
  await ouvrirLApp(page);

  await avatar(page).click();
  await expect(titreVisible(page)).toHaveText('Compte');
  await expect(retour(page)).toBeVisible();
});

test("US 294 critère 5 : given l'écran Conseil, when on touche « Ma sortie », then le parcours « Préparer ma sortie » démarre comme avant et le bouton du bas du contenu a disparu", async ({ page }) => {
  await ouvrirLApp(page);
  await expect(page.getByRole('heading', { name: 'Conditions', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Préparer ma sortie$/ })).toHaveCount(0);
  await expect(boutonSortie(page)).toBeEnabled();

  await boutonSortie(page).click();

  await expect(page.getByRole('status').filter({ hasText: 'Sortie prête : conditions jusqu\'au 11/11 à 13 h' })).toBeVisible();
});

test("US 294 critère 5 : given la préparation en cours, when on a touché « Ma sortie », then le bouton du dock affiche « Préparation… »", async ({ page }) => {
  await ouvrirLApp(page, '/', 3000);
  await expect(page.getByRole('heading', { name: 'Conditions', exact: true })).toBeVisible();

  await boutonSortie(page).click();

  await expect(dock(page).getByRole('button', { name: 'Préparation…' })).toBeVisible();
});

test("US 294 critère 5 : given l'appareil sans réseau, when on touche « Ma sortie », then « Pas de réseau : prépare ta sortie avant de partir » s'affiche", async ({ page }) => {
  await ouvrirLApp(page);
  await expect(boutonSortie(page)).toBeEnabled();
  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

  await boutonSortie(page).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Pas de réseau : prépare ta sortie avant de partir' })).toBeVisible();
});

test("US 294 critère 6 : given un téléphone de 390 px de large, when on mesure les boutons du dock et l'avatar, then chaque zone tactile fait au moins 48 × 48 px", async ({ page }) => {
  await ouvrirLApp(page);
  await expect(dock(page)).toBeVisible();

  const cibles = { Boîte: lienBoite(page), 'Ma sortie': boutonSortie(page), Spots: lienSpots(page), Compte: avatar(page) };
  for (const [nom, cible] of Object.entries(cibles)) {
    const boite = await cible.boundingBox();
    expect(boite, nom).not.toBeNull();
    expect(boite!.height, `hauteur de ${nom}`).toBeGreaterThanOrEqual(48);
    expect(boite!.width, `largeur de ${nom}`).toBeGreaterThanOrEqual(48);
  }
});

for (const [chemin, nom] of [['/boite', 'Boîte'], ['/spots', 'Spots'], ['/compte', 'Compte']]) {
  test(`US 294 maquette : given l'écran ${nom}, when il s'affiche, then le dock n'y est pas et le bouton de retour « Conseil » est en haut à gauche`, async ({ page }) => {
    await ouvrirLApp(page, chemin);

    await expect(titreVisible(page)).toHaveText(nom);
    await expect(retour(page)).toBeVisible();
    const boite = await retour(page).boundingBox();
    expect(boite!.x).toBeLessThan(100);
    expect(boite!.y).toBeLessThan(100);
    await expect(dock(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Ma sortie$/ })).toHaveCount(0);
  });
}

// Reprise de e2e/onglets.spec.ts (supprimé avec la barre d'onglets) : adresses directes et adresse inconnue.
test("US 294 extra : given une URL inconnue, when on l'ouvre, then l'écran Conseil s'affiche", async ({ page }) => {
  await ouvrirLApp(page, '/nimporte-quoi/du-tout');

  await expect(titreVisible(page)).toHaveText('Conseil');
  await expect(page).toHaveURL(/\/conseil$/);
  await expect(dock(page)).toBeVisible();
});

test("US 294 extra : given l'URL /conseil ouverte directement, when l'app s'affiche, then l'écran Conseil et son dock s'affichent", async ({ page }) => {
  await ouvrirLApp(page, '/conseil');

  await expect(titreVisible(page)).toHaveText('Conseil');
  await expect(dock(page)).toBeVisible();
});

// Reprise du critère 7 des onglets : les couleurs du dock sont celles des tokens, en thème clair et en thème sombre.
for (const [theme, scheme] of [['clair', 'dark'], ['sombre', 'light']] as const) {
  test(`US 294 couleurs (${theme}) : given le dock, when on l'affiche en thème ${theme}, then ses couleurs sont celles des tokens du thème ${theme}`, async ({ page }) => {
    const tokens = lireThemes()[theme];
    await page.emulateMedia({ colorScheme: scheme }); // le thème choisi l'emporte sur le réglage du téléphone
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), ['leurio.theme', theme]);
    await ouvrirLApp(page);
    await expect(dock(page)).toBeVisible();

    const couleur = (cible: ReturnType<Page['locator']>, prop: 'backgroundColor' | 'color' | 'borderTopColor') =>
      cible.evaluate((el, p) => getComputedStyle(el)[p], prop);
    const barre = dock(page).locator('xpath=..'); // la zone du dock : fond et filet du haut
    expect(await couleur(barre, 'backgroundColor')).toBe(rgb(tokens['--lr-surface']));
    expect(await couleur(barre, 'borderTopColor')).toBe(rgb(tokens['--lr-bordure']));
    expect(await couleur(lienBoite(page), 'color')).toBe(rgb(tokens['--lr-texte']));
    expect(await couleur(lienBoite(page), 'borderTopColor')).toBe(rgb(tokens['--lr-bordure']));
    expect(await couleur(boutonSortie(page), 'backgroundColor')).toBe(rgb(tokens['--lr-primaire']));
    expect(await couleur(boutonSortie(page), 'color')).toBe(rgb(tokens['--lr-sur-primaire']));
  });
}
