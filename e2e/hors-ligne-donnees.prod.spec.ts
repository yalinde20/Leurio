// US 16 : la boîte et les spots restent accessibles hors ligne, même après avoir fermé et rouvert l'app (PLAN §4, §10 phase 5, §11).
// Build de production (service worker) servi sur le port 4300, Firestore sur l'émulateur ; fermer l'app = fermer la page,
// la rouvrir = ouvrir une nouvelle page du même contexte (le cache IndexedDB de Firestore est conservé).
import { test, expect, type Page } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';
import {
  ajouterLeurre, ajouterSpot, attendreCompte, bloquerLeReseauExterne, leurresSurEmulateur, ligneLeurre, ligneSpot, modeAvion,
  onglet, ouvrirOnglet, spotsSurEmulateur, titreVisible,
} from './hors-ligne-donnees-helpers';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page, context }) => {
  await onboardingTermine(page);
  await bloquerLeReseauExterne(context);
});

/** Première ouverture avec du réseau : le service worker s'active, contrôle la page et remplit son cache. */
async function installerLApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(titreVisible(page)).toHaveText('Conseil');
  await page.evaluate(async () => {
    const prete = await navigator.serviceWorker.ready;
    const fin = Date.now() + 25_000;
    while (prete.active && prete.active.state !== 'activated' && Date.now() < fin) await new Promise((r) => setTimeout(r, 100));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller), { timeout: 30_000 }).toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          for (const nom of await caches.keys()) {
            const requetes = await (await caches.open(nom)).keys();
            if (requetes.some((r) => new URL(r.url).pathname === '/index.html')) return true;
          }
          return false;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

test('critère 1 : given la boîte et les spots chargés une fois avec du réseau, when l\'utilisateur ouvre « Boîte » puis « Spots » en mode avion, même après avoir fermé et rouvert l\'app, then ses leurres et ses spots s\'affichent', async ({ page, context }) => {
  test.setTimeout(120_000);
  await installerLApp(page);
  const uid = await attendreCompte(page);
  await ouvrirOnglet(page, 'Boîte');
  await ajouterLeurre(page, 'gardon');
  await ouvrirOnglet(page, 'Spots');
  await ajouterSpot(page, 'Pont de Cé');
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length + (await spotsSurEmulateur(uid)).length, { timeout: 20_000 }).toBe(2);
  // La boîte et les spots ont été chargés avec du réseau ; on revient sur « Conseil » avant de fermer l'app.
  await onglet(page, 'Conseil');

  await page.close();
  await context.setOffline(true);
  const rouverte = await context.newPage();
  await rouverte.goto('/');
  await expect(titreVisible(rouverte)).toHaveText('Conseil');

  await ouvrirOnglet(rouverte, 'Boîte');
  await expect(ligneLeurre(rouverte, 'gardon')).toHaveCount(1);
  await ouvrirOnglet(rouverte, 'Spots');
  await expect(ligneSpot(rouverte, 'Pont de Cé')).toHaveCount(1);
});

test('critère 2 : given l\'appareil en mode avion, when l\'utilisateur ajoute un spot puis ferme et rouvre l\'app, then le spot s\'affiche toujours et au retour du réseau il est enregistré sur son compte', async ({ page, context }) => {
  test.setTimeout(120_000);
  await installerLApp(page);
  const uid = await attendreCompte(page);
  await ouvrirOnglet(page, 'Spots');

  await modeAvion(page, true);
  await ajouterSpot(page, 'Mode avion');
  await expect(ligneSpot(page, 'Mode avion')).toContainText('Pas encore synchronisé : il le sera au retour du réseau.');
  await page.close();

  const rouverte = await context.newPage();
  await rouverte.goto('/');
  await ouvrirOnglet(rouverte, 'Spots');
  await expect(ligneSpot(rouverte, 'Mode avion')).toContainText('Pas encore synchronisé : il le sera au retour du réseau.');
  expect(await spotsSurEmulateur(uid)).toHaveLength(0);

  await modeAvion(rouverte, false);
  await expect.poll(async () => (await spotsSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(1);
  await expect(ligneSpot(rouverte, 'Mode avion')).not.toContainText('Pas encore synchronisé');
});

test('critère 3 : given l\'appareil en mode avion, when l\'utilisateur ajoute un leurre puis ferme et rouvre l\'app, then le leurre s\'affiche toujours et au retour du réseau il est enregistré sur son compte', async ({ page, context }) => {
  test.setTimeout(120_000);
  await installerLApp(page);
  const uid = await attendreCompte(page);
  await ouvrirOnglet(page, 'Boîte');

  await modeAvion(page, true);
  await ajouterLeurre(page, 'perche');
  await expect(ligneLeurre(page, 'perche')).toContainText('Pas encore synchronisé : il le sera au retour du réseau.');
  await page.close();

  const rouverte = await context.newPage();
  await rouverte.goto('/');
  await ouvrirOnglet(rouverte, 'Boîte');
  await expect(ligneLeurre(rouverte, 'perche')).toContainText('Pas encore synchronisé : il le sera au retour du réseau.');

  await modeAvion(rouverte, false);
  await expect.poll(async () => (await leurresSurEmulateur(uid)).length, { timeout: 30_000 }).toBe(1);
  await expect(ligneLeurre(rouverte, 'perche')).not.toContainText('Pas encore synchronisé');
});
