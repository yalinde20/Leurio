// US 105 : le leurre de ma boîte sur les cartes et le détail du conseil, sur les émulateurs (PLAN §2.1, §4, §8.5).
// Contrat du DOM : voir src/app/features/conseil/conseil.page.boite.spec.ts (ligne « Libellé : texte » dans la carte) et
// src/app/features/boite/boite.page.ajout.spec.ts (formulaire d'ajout = [role="dialog"]).
// Aucun service réel : position simulée, Hub'Eau répond par un faux relevé, Open-Meteo et tout hôte non local sont coupés.
// Le moment est fixé au 9 novembre 2026 à 13 h (Paris), dans les heures légales d'Angers.
import { test, expect, type Page } from '@playwright/test';
import { attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

test.beforeEach(async ({ page }) => onboardingTermine(page));

const MAINTENANT = new Date('2026-11-09T12:00:00Z');

async function ouvrirConseil(page: Page): Promise<void> {
  await page.clock.setFixedTime(MAINTENANT);
  await page.route(
    (url) => !estLocal(url.toString()),
    (route) => {
      if (
        route.request().url().startsWith('https://hubeau.eaufrance.fr/') &&
        route.request().url().includes('/temperature/chronique')
      ) {
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
      }
      return route.abort();
    },
  );
  await page.goto('/');
  await attendreFirebase(page);
  // Le compte anonyme est créé par l'app (US 90) : on attend son uid pour que la boîte soit lisible.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                leurioFirebase: { auth: { currentUser?: { uid: string } | null } };
              }
            ).leurioFirebase.auth.currentUser?.uid ?? null,
        ),
      { timeout: 20_000 },
    )
    .not.toBeNull();
  await expect(cartesConseil(page)).toHaveCount(3);
}

const cartesConseil = (page: Page) =>
  page
    .locator('section, article, ion-card')
    .filter({ hasText: /Animation\s*:/ })
    .filter({ hasNot: page.locator('section, article, ion-card') });

const LIGNE_MANQUE = /Il te manque\s*:/;
const nomDuType = async (page: Page): Promise<string> =>
  (
    (await cartesConseil(page).first().locator('h1, h2, h3, h4').first().textContent()) ?? ''
  ).trim();
const echapper = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ajoute dans l'onglet « Boîte » un leurre du type donné (10 cm, 12 g, perche), puis revient sur « Conseil ». */
async function ajouterUnLeurre(page: Page, nomType: string): Promise<void> {
  await page.getByRole('tab', { name: 'Boîte', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  const f = page.locator('[role="dialog"]');
  await f.getByLabel('Type').selectOption({ label: nomType });
  await f.getByLabel('Taille (cm)').fill('10');
  await f.getByLabel('Poids (g)').fill('12');
  await f.getByLabel('Couleur').fill('perche');
  await f.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(f).toHaveCount(0);
  await expect(page.locator('li').first()).toContainText(nomType);
  await page.getByRole('tab', { name: 'Conseil', exact: true }).click();
}

test("critère 3 : given ma boîte est vide, when j'ouvre l'écran Conseil, then chacune des 3 cartes affiche une ligne « Il te manque : » avec un article, une couleur et pas de « Dans ta boîte »", async ({
  page,
}) => {
  await ouvrirConseil(page);

  for (let i = 0; i < 3; i++) {
    const carte = cartesConseil(page).nth(i);
    await expect(carte).toContainText(/Il te manque\s*:\s*une?\s+\S.*couleur\s+\S+/);
    await expect(carte).not.toContainText('Dans ta boîte');
  }
});

test("critère 5 : given le conseil affichait « Il te manque », when j'ajoute un leurre de ce type dans l'onglet Boîte et je reviens sur « Conseil », then la première carte affiche « Dans ta boîte : » avec ce leurre", async ({
  page,
}) => {
  await ouvrirConseil(page);
  await expect(cartesConseil(page).first()).toContainText(LIGNE_MANQUE);
  const type = await nomDuType(page);

  await ajouterUnLeurre(page, type);

  const carte = cartesConseil(page).first();
  await expect(carte).toContainText(
    new RegExp(`Dans ta boîte\\s*:\\s*${echapper(type)}\\s+(10 cm|12 g)\\s+perche`),
  );
  await expect(carte).not.toContainText(LIGNE_MANQUE);
});

test("critère 4 : given une carte affiche un leurre de ma boîte, when j'ouvre son détail, then le détail affiche la même ligne", async ({
  page,
}) => {
  await ouvrirConseil(page);
  const type = await nomDuType(page);
  await ajouterUnLeurre(page, type);
  const motif = new RegExp(`Dans ta boîte\\s*:\\s*${echapper(type)}\\s+(10 cm|12 g)\\s+perche`);
  await expect(cartesConseil(page).first()).toContainText(motif);

  await cartesConseil(page).first().getByText('Voir le détail').click();

  await expect(page.getByText('Détail du conseil')).toBeVisible();
  await expect(page.getByText(motif)).toBeVisible();
});

test("critère 4 : given une carte affiche « Il te manque », when j'ouvre son détail, then le détail affiche la même ligne", async ({
  page,
}) => {
  await ouvrirConseil(page);
  const ligne = (
    (await cartesConseil(page).first().getByText(LIGNE_MANQUE).first().textContent()) ?? ''
  ).trim();

  await cartesConseil(page).first().getByText('Voir le détail').click();

  await expect(page.getByText('Détail du conseil')).toBeVisible();
  await expect(page.getByText(ligne, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(LIGNE_MANQUE)).toHaveCount(1);
});

test("critère 6 : given je n'ai pas de réseau après avoir lu ma boîte, when je reviens sur l'écran Conseil, then les lignes « Dans ta boîte » et « Il te manque » sont calculées depuis la boîte en cache", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await ouvrirConseil(page);
  const type = await nomDuType(page);
  await ajouterUnLeurre(page, type);
  const motif = new RegExp(`Dans ta boîte\\s*:\\s*${echapper(type)}\\s+(10 cm|12 g)\\s+perche`);
  await expect(cartesConseil(page).first()).toContainText(motif);

  await context.setOffline(true);
  await page.getByRole('tab', { name: 'Boîte', exact: true }).click();
  await expect(page.locator('li').first()).toContainText(type);
  await page.getByRole('tab', { name: 'Conseil', exact: true }).click();

  await expect(cartesConseil(page)).toHaveCount(3);
  await expect(cartesConseil(page).first()).toContainText(motif);
  await expect(cartesConseil(page).nth(1)).toContainText(
    /(Dans ta boîte|À la place, dans ta boîte|Il te manque)\s*:/,
  );
  await expect(page.getByText(/Il te manque|Dans ta boîte/).first()).toBeVisible();
});
