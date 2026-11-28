// US 91 : « À propos et sources », « Confidentialité » et cartedepeche.fr depuis l'onglet Compte (PLAN §3, §6, §9).
// Maquette : docs/maquettes/us-91-a-propos-confidentialite.html. Contenu réel ; tout service externe est coupé.
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';
import { ouvrirEcran } from './dock-helpers';
import { estLocal } from './firebase-helpers';

test.use({ viewport: { width: 390, height: 844 } });

const CARTE_DE_PECHE = /^https:\/\/www\.cartedepeche\.fr\/?$/;

/** Aucun service réel : tout ce qui n'est pas local est coupé (Hub'Eau, Open-Meteo, cartedepeche.fr…). */
async function couperLeReel(page: Page): Promise<string[]> {
  const demandes: string[] = [];
  await page.route(
    (url) => !estLocal(url.toString()),
    (route) => {
      demandes.push(route.request().url());
      return route.abort();
    },
  );
  return demandes;
}

test.beforeEach(async ({ page }) => {
  await onboardingTermine(page);
});

async function ouvrirCompte(page: Page): Promise<void> {
  await page.goto('/');
  await ouvrirEcran(page, 'Compte');
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Compte');
}

/** Une source du fichier de contenu : la première chaîne de `sources` de species.json, lue sur le disque. */
function sourcesDeEspeces(): string[] {
  const trouvees: string[] = [];
  const parcourir = (x: unknown): void => {
    if (Array.isArray(x)) x.forEach(parcourir);
    else if (x && typeof x === 'object') {
      for (const [k, v] of Object.entries(x)) {
        if (k === 'sources' && Array.isArray(v)) trouvees.push(...v.filter((s): s is string => typeof s === 'string'));
        else parcourir(v);
      }
    }
  };
  parcourir(JSON.parse(readFileSync('src/assets/data/species.json', 'utf8')));
  return [...new Set(trouvees)];
}

test("critère 1 : given j'ouvre l'onglet « Compte », when je le regarde, then il propose « À propos et sources », « Confidentialité » et le lien « cartedepeche.fr »", async ({ page }) => {
  await couperLeReel(page);
  await ouvrirCompte(page);

  await expect(page.getByText('Informations', { exact: true })).toBeVisible();
  await expect(page.getByText('À propos et sources').first()).toBeVisible();
  await expect(page.getByText('Confidentialité').first()).toBeVisible();
  await expect(page.getByText('Réglementation', { exact: true })).toBeVisible();
  const carte = page.getByRole('link', { name: /cartedepeche\.fr/ });
  await expect(carte).toBeVisible();
  await expect(carte).toHaveAttribute('href', CARTE_DE_PECHE);
  await expect(carte).toHaveAttribute('target', '_blank');
  await expect(carte).toHaveAttribute('rel', /noopener/);
});

test("critère 2 : given l'onglet « Compte » affiché, when je touche « À propos et sources », then la page cite Hub'Eau, Open-Meteo, OpenStreetMap et les sources des fichiers de contenu", async ({ page }) => {
  await couperLeReel(page);
  await ouvrirCompte(page);
  await page.getByText('À propos et sources').first().click();

  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('À propos et sources');
  await expect(page.getByText('Hub’Eau').first()).toBeVisible();
  await expect(page.getByText('Open-Meteo').first()).toBeVisible();
  await expect(page.getByText('OpenStreetMap').first()).toBeVisible();

  // Les sources du contenu réel : groupe « Espèces » replié, puis déplié avec une vraie source de species.json.
  const reelle = sourcesDeEspeces()[0];
  expect(reelle, 'species.json doit avoir au moins une source').toBeTruthy();
  const groupe = page.locator('details, [aria-expanded]').filter({ hasText: 'Espèces' }).first();
  await expect(groupe).toBeVisible();
  await expect(page.getByText(reelle, { exact: false }).first()).toBeHidden();
  await groupe.getByText(/source/).first().click();
  await expect(page.getByText(reelle, { exact: false }).first()).toBeVisible();
});

test("critère 3 : given l'onglet « Compte » affiché, when je touche « Confidentialité », then la page de confidentialité s'affiche, et le retour ramène à « Compte »", async ({ page }) => {
  await couperLeReel(page);
  await ouvrirCompte(page);
  await page.getByText('Confidentialité').first().click();

  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Confidentialité');
  await expect(page.getByRole('heading', { name: 'Qui s’occupe de tes données' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ton identifiant de compte' })).toBeAttached();
  await expect(page.getByRole('link', { name: /yoyoalinde@gmail\.com/ }).first()).toHaveAttribute('href', 'mailto:yoyoalinde@gmail.com');
  await expect(page).toHaveURL(/\/compte\/confidentialite$/);

  await page.getByRole('button', { name: /Compte/ }).first().click();
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Compte');
  await expect(page.getByText('À propos et sources').first()).toBeVisible();
});

test("critère 4 : given l'onglet « Compte » affiché, when je touche « cartedepeche.fr », then le site https://www.cartedepeche.fr s'ouvre dans un nouvel onglet", async ({ page, context }) => {
  const demandes = await couperLeReel(page);
  // Le nouvel onglet : sa requête est coupée aussi (aucun appel réel), mais son URL est vérifiée.
  await context.route(
    (url) => !estLocal(url.toString()),
    (route) => {
      demandes.push(route.request().url());
      return route.abort();
    },
  );
  await ouvrirCompte(page);

  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('link', { name: /cartedepeche\.fr/ }).click(),
  ]);
  await expect.poll(() => demandes.find((u) => CARTE_DE_PECHE.test(u)) ?? popup.url()).toMatch(CARTE_DE_PECHE);
});
