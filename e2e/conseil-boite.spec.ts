// US 105 : le leurre de ma boîte sur les cartes et le détail du conseil, sur les émulateurs (PLAN §2.1, §4, §8.5).
// US 295 : le coup 01 dit « Dans ta boîte » ou « Il te manque » ; la ligne complète (« Libellé : texte ») est dans le détail.
// Contrat du DOM : voir src/app/features/conseil/conseil.page.boite.spec.ts et
// src/app/features/boite/boite.page.ajout.spec.ts (formulaire d'ajout = [role="dialog"]).
// Aucun service réel : position simulée, Hub'Eau répond par un faux relevé, Open-Meteo et tout hôte non local sont coupés.
// Le moment est fixé au 9 novembre 2026 à 13 h (Paris), dans les heures légales d'Angers.
import { test, expect, type Page } from '@playwright/test';
import { attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';
import { ouvrirEcran } from './dock-helpers';
import { conseilAffiche, coupUn, ouvrirDetailDuCoup } from './conseil-helpers';

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
  await conseilAffiche(page);
}

const LIGNE_MANQUE = /Il te manque\s*:/;
/** Le type du coup 01 : son nom, avant l'animation (« Shad · tirée-relâchée »). */
const nomDuType = async (page: Page): Promise<string> =>
  (((await coupUn(page).locator('.nom').textContent()) ?? '').split('·')[0] ?? '').trim();
const echapper = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ajoute dans l'onglet « Boîte » un leurre du type donné (10 cm, 12 g, perche), puis revient sur « Conseil ». */
async function ajouterUnLeurre(page: Page, nomType: string): Promise<void> {
  await ouvrirEcran(page, 'Boîte');
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  const f = page.locator('[role="dialog"]');
  await f.getByLabel('Type').selectOption({ label: nomType });
  await f.getByLabel('Taille (cm)').fill('10');
  await f.getByLabel('Poids (g)').fill('12');
  await f.getByLabel('Couleur').fill('perche');
  await f.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(f).toHaveCount(0);
  await expect(page.locator('li').first()).toContainText(nomType);
  await ouvrirEcran(page, 'Conseil');
}

test("critère 3 : given ma boîte est vide, when j'ouvre l'écran Conseil, then le coup 01 affiche « Il te manque » et pas « Dans ta boîte », et le détail de chacun des 3 coups la ligne « Il te manque : » avec un article et une couleur", async ({
  page,
}) => {
  await ouvrirConseil(page);

  await expect(coupUn(page)).toContainText('Il te manque');
  await expect(coupUn(page)).not.toContainText('Dans ta boîte');
  for (let rang = 1; rang <= 3; rang++) {
    await ouvrirDetailDuCoup(page, rang);
    await expect(page.getByText(/Il te manque\s*:\s*une?\s+\S.*couleur\s+\S+/)).toBeVisible();
    await expect(page.getByText('Dans ta boîte')).toHaveCount(0);
    await page.goBack();
    await conseilAffiche(page);
  }
});

test("critère 5 : given le conseil affichait « Il te manque », when j'ajoute un leurre de ce type dans l'onglet Boîte et je reviens sur « Conseil », then le coup 01 affiche « Dans ta boîte » et son détail la ligne avec ce leurre", async ({
  page,
}) => {
  await ouvrirConseil(page);
  await expect(coupUn(page)).toContainText('Il te manque');
  const type = await nomDuType(page);

  await ajouterUnLeurre(page, type);

  await expect(coupUn(page)).toContainText('Dans ta boîte');
  await expect(coupUn(page)).not.toContainText('Il te manque');
  await ouvrirDetailDuCoup(page, 1);
  await expect(page.getByText(new RegExp(`Dans ta boîte\\s*:\\s*${echapper(type)}\\s+(10 cm|12 g)\\s+perche`))).toBeVisible();
  await expect(page.getByText(LIGNE_MANQUE)).toHaveCount(0);
});

test("critère 4 : given le coup 01 affiche un leurre de ma boîte, when j'ouvre son détail, then le détail affiche la ligne « Dans ta boîte : » avec ce leurre", async ({
  page,
}) => {
  await ouvrirConseil(page);
  const type = await nomDuType(page);
  await ajouterUnLeurre(page, type);
  const motif = new RegExp(`Dans ta boîte\\s*:\\s*${echapper(type)}\\s+(10 cm|12 g)\\s+perche`);
  await expect(coupUn(page)).toContainText('Dans ta boîte');

  await coupUn(page).click();

  await expect(page.getByText('Détail du conseil')).toBeVisible();
  await expect(page.getByText(motif)).toBeVisible();
});

test("critère 4 : given le coup 01 affiche « Il te manque », when j'ouvre son détail, then le détail affiche la ligne « Il te manque : »", async ({
  page,
}) => {
  await ouvrirConseil(page);
  await expect(coupUn(page)).toContainText('Il te manque');

  await coupUn(page).click();

  await expect(page.getByText('Détail du conseil')).toBeVisible();
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
  await expect(coupUn(page)).toContainText('Dans ta boîte');
  // Le code du détail est chargé à la demande : on l'ouvre une fois en ligne, pour qu'il soit là sans réseau.
  await ouvrirDetailDuCoup(page, 2);
  await page.goBack();
  await conseilAffiche(page);

  await context.setOffline(true);
  await ouvrirEcran(page, 'Boîte');
  await expect(page.locator('li').first()).toContainText(type);
  await ouvrirEcran(page, 'Conseil');

  await conseilAffiche(page);
  await expect(coupUn(page)).toContainText('Dans ta boîte');
  await ouvrirDetailDuCoup(page, 2);
  await expect(page.getByText(/(Dans ta boîte|À la place, dans ta boîte|Il te manque)\s*:/)).toBeVisible();
});
