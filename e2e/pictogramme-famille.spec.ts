// US 293 : le pictogramme de la famille d'un leurre sans photo, dans l'écran Boîte (maquette docs/maquettes/us-293-pictogrammes-familles.html).
// Contrat du DOM imposé aux tests : le pictogramme d'une famille est un SVG en ligne `role="img"` dont `aria-label` = nom de la famille ;
// son tracé (premier élément de forme path/line/circle/rect/polyline/polygon/ellipse sans `data-point`) porte le trait (`stroke` calculé) ;
// le point coloré est un élément portant l'attribut `data-point` (`fill` calculé).
import { test, expect, type Page } from '@playwright/test';
import { lireThemes } from './tokens';
import { attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await onboardingTermine(page);
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
});

const rgb = (hex: string | undefined): string => {
  if (!hex) throw new Error('token introuvable dans src/theme/tokens.scss');
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const formulaire = (page: Page) => page.locator('[role="dialog"]').filter({ has: page.getByLabel('Couleur') });

async function boiteAvecShad(page: Page): Promise<void> {
  await page.goto('/');
  await attendreFirebase(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lireUid = () => page.evaluate(() => (((window as any).leurioFirebase.auth.currentUser?.uid ?? null) as string | null));
  await expect.poll(lireUid, { timeout: 20_000 }).not.toBeNull();
  await page.getByRole('tab', { name: 'Boîte', exact: true }).click();
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Boîte');
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await formulaire(page).getByLabel('Type').selectOption({ label: 'Shad' });
  await formulaire(page).getByLabel('Taille (cm)').fill('10');
  await formulaire(page).getByLabel('Poids (g)').fill('12');
  await formulaire(page).getByLabel('Couleur').fill('gardon');
  await formulaire(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(formulaire(page)).toHaveCount(0);
}

const pictogramme = (page: Page) => page.locator('li [role="img"][aria-label="Souples"]');

test('US 293 critère 2 : given un leurre de la famille « Souples » sans photo dans la boîte, when on affiche l\'écran Boîte, then le pictogramme des souples apparaît avec le nom accessible « Souples »', async ({ page }) => {
  await boiteAvecShad(page);
  await expect(page.locator('li img[alt="Photo du leurre"]')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Souples', exact: true })).toBeVisible();
  await expect(pictogramme(page)).toHaveCount(1);
  await expect(pictogramme(page).locator('path, line, circle, rect, polyline, polygon, ellipse').first()).toBeAttached();
});

test('US 293 critère 3 : given un pictogramme affiché, when on passe du thème clair au thème sombre, then son trait prend --lr-trait et son point --lr-accent du thème', async ({ page }) => {
  const themes = lireThemes();
  await page.emulateMedia({ colorScheme: 'light' });
  await boiteAvecShad(page);
  await expect(pictogramme(page)).toBeVisible();

  const couleurs = () =>
    pictogramme(page).evaluate((svg) => {
      const forme = [...svg.querySelectorAll('path, line, circle, rect, polyline, polygon, ellipse')].find((e) => !e.hasAttribute('data-point'));
      const point = svg.querySelector('[data-point]');
      return {
        trait: forme ? getComputedStyle(forme).stroke : null,
        point: point ? getComputedStyle(point).fill : null,
      };
    });

  expect(await couleurs()).toEqual({ trait: rgb(themes.clair['--lr-trait']), point: rgb(themes.clair['--lr-accent']) });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(couleurs).toEqual({ trait: rgb(themes.sombre['--lr-trait']), point: rgb(themes.sombre['--lr-accent']) });
  expect(themes.clair['--lr-trait']).not.toBe(themes.sombre['--lr-trait']);
});
