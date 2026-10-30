import { test, expect, type Page } from '@playwright/test';
import { lireThemes } from './tokens';

const ONGLETS = ['Conseil', 'Boîte', 'Spots', 'Compte'];
const CLE = 'leurio.theme';

const onglet = (page: Page, nom: string) => page.getByRole('tab', { name: nom, exact: true });
const titreVisible = (page: Page) => page.locator('ion-toolbar ion-title:visible');
// Ionic garde les pages précédentes dans le DOM, cachées : on ne regarde que la page visible.
const ecranAffiche = async (page: Page, nom: string) => {
  await expect(titreVisible(page)).toHaveText(nom);
  await expect(onglet(page, nom)).toHaveAttribute('aria-selected', 'true');
};

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

test.use({ viewport: { width: 390, height: 844 } });

test('critère 0 : given l\'app fermée, when on l\'ouvre, then l\'écran Conseil s\'affiche sans aucun tap et l\'onglet « Conseil » est sélectionné', async ({ page }) => {
  await page.goto('/');
  await ecranAffiche(page, 'Conseil');
  await expect(page).toHaveURL(/\/conseil$/);
});

test('critère 1 : given l\'app ouverte, when on regarde la barre d\'onglets, then elle montre 4 onglets dans cet ordre : « Conseil », « Boîte », « Spots », « Compte », chacun avec une icône', async ({ page }) => {
  await page.goto('/');
  const onglets = page.getByRole('tab');
  await expect(onglets).toHaveCount(4);
  await expect(onglets).toHaveText(ONGLETS);
  for (let i = 0; i < 4; i++) await expect(onglets.nth(i).locator('ion-icon')).toHaveCount(1);
});

test('critère 2 : given l\'écran Conseil affiché, when on touche l\'onglet « Boîte », then l\'écran Boîte s\'affiche avec le titre « Boîte » et l\'onglet « Boîte » est sélectionné', async ({ page }) => {
  await page.goto('/');
  await ecranAffiche(page, 'Conseil');
  await onglet(page, 'Boîte').click();
  await ecranAffiche(page, 'Boîte');
});

test('critère 3 : given l\'écran Conseil affiché, when on touche l\'onglet « Spots », then l\'écran Spots s\'affiche avec le titre « Spots »', async ({ page }) => {
  await page.goto('/');
  await ecranAffiche(page, 'Conseil');
  await onglet(page, 'Spots').click();
  await ecranAffiche(page, 'Spots');
});

test('critère 4 : given l\'écran Conseil affiché, when on touche l\'onglet « Compte », then l\'écran Compte s\'affiche avec le titre « Compte »', async ({ page }) => {
  await page.goto('/');
  await ecranAffiche(page, 'Conseil');
  await onglet(page, 'Compte').click();
  await ecranAffiche(page, 'Compte');
});

test('critère 5 : given l\'écran Compte affiché, when on touche l\'onglet « Conseil », then l\'écran Conseil s\'affiche avec le titre « Conseil »', async ({ page }) => {
  await page.goto('/');
  await onglet(page, 'Compte').click();
  await ecranAffiche(page, 'Compte');
  await onglet(page, 'Conseil').click();
  await ecranAffiche(page, 'Conseil');
});

test('critère 6 : given la barre d\'onglets sur un écran de téléphone (390 px), when on mesure chaque onglet, then sa zone tactile fait au moins 48 px de haut et 48 px de large', async ({ page }) => {
  await page.goto('/');
  const onglets = page.getByRole('tab');
  await expect(onglets).toHaveCount(4);
  for (const nom of ONGLETS) {
    const boite = await onglet(page, nom).boundingBox();
    expect(boite, nom).not.toBeNull();
    expect(boite!.height, `hauteur de ${nom}`).toBeGreaterThanOrEqual(48);
    expect(boite!.width, `largeur de ${nom}`).toBeGreaterThanOrEqual(48);
  }
});

for (const [theme, scheme] of [['clair', 'dark'], ['sombre', 'light']] as const) {
  test(`critère 7 (${theme}) : given la barre d'onglets, when on l'affiche en thème ${theme}, then ses couleurs sont celles des tokens du thème ${theme}`, async ({ page }) => {
    const tokens = lireThemes()[theme];
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLE, theme]);
    await page.goto('/');
    await expect(page.getByRole('tab')).toHaveCount(4);
    const couleur = (loc: ReturnType<Page['locator']>, prop: 'backgroundColor' | 'color') =>
      loc.evaluate((el, p) => getComputedStyle(el)[p], prop);
    expect(await couleur(page.locator('ion-tab-bar'), 'backgroundColor')).toBe(rgb(tokens['--lr-surface']));
    expect(await couleur(onglet(page, 'Conseil'), 'color')).toBe(rgb(tokens['--lr-primaire']));
    expect(await couleur(onglet(page, 'Boîte'), 'color')).toBe(rgb(tokens['--lr-texte-secondaire']));
    const bordure = await page.locator('ion-tab-bar').evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(bordure).toBe(rgb(tokens['--lr-bordure']));
  });
}

test('extra : given une URL inconnue, when on l\'ouvre, then l\'écran Conseil s\'affiche', async ({ page }) => {
  await page.goto('/nimporte-quoi/du-tout');
  await ecranAffiche(page, 'Conseil');
});

for (const [chemin, nom] of [['/conseil', 'Conseil'], ['/boite', 'Boîte'], ['/spots', 'Spots'], ['/compte', 'Compte']]) {
  test(`extra : given l'URL ${chemin} ouverte directement, when l'app s'affiche, then l'onglet « ${nom} » est affiché`, async ({ page }) => {
    await page.goto(chemin);
    await ecranAffiche(page, nom);
  });
}
