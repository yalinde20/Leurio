import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';

// US 9 : la boucle courte (provider « self ») est lue dans la fiche animation, même hors ligne.
// Les vrais fichiers src/assets/videos/*.mp4 n'existent pas encore (décision du propriétaire) : un petit clip de test,
// qui reste dans e2e/fixtures et n'entre jamais dans le build, est servi à leur place par page.route.
// Le clip est un WebM/VP9 (Chromium de Playwright ne décode pas toujours H.264), servi sous l'URL en .mp4.
// Limite : le clip passe par page.route, donc « hors ligne » prouve que la lecture ne demande rien au réseau,
// pas que le fichier est dans le paquet de l'app (ce que le build ne peut pas vérifier tant que les .mp4 manquent).

test.beforeEach(async ({ page }) => onboardingTermine(page));
test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const CLIP = readFileSync(join(__dirname, 'fixtures', 'boucle-test.webm'));
const MAINTENANT = new Date('2026-11-09T12:00:00Z');

async function ouvrirLaFiche(page: Page, options: { clip: boolean }): Promise<string[]> {
  const demandes: string[] = [];
  await page.clock.setFixedTime(MAINTENANT);
  await page.route('https://hubeau.eaufrance.fr/**', (route) => {
    if (!route.request().url().includes('/temperature/chronique')) return route.abort();
    return route.fulfill({
      json: {
        data: [
          { code_station: '04101000', libelle_station: 'La Maine à Angers', longitude: -0.5, latitude: 47.5, date_mesure_temp: '2026-11-09', heure_mesure_temp: '06:00:00', resultat: 11.5 },
        ],
      },
    });
  });
  await page.route(/open-meteo\.com/, (route) => route.abort());
  await page.route('**/assets/videos/*.mp4', (route) => {
    demandes.push(route.request().url());
    return options.clip ? route.fulfill({ status: 200, contentType: 'video/webm', body: CLIP }) : route.fulfill({ status: 404, body: '' });
  });
  await page.goto('/');
  await page.locator('section, article, ion-card').filter({ hasText: /Animation\s*:/ }).filter({ hasNot: page.locator('section, article, ion-card') }).first().getByText('Voir le détail').click();
  await page.getByRole('button', { name: "Voir l'animation" }).click();
  await expect(page.getByText('Le geste', { exact: true })).toBeVisible();
  return demandes;
}

const enLecture = (page: Page) =>
  page.locator('video').evaluate((v: HTMLVideoElement) => !v.paused && v.readyState >= 2 && v.muted && v.loop && !v.controls);

async function verifierLecture(page: Page): Promise<void> {
  await expect(page.locator('video')).toHaveCount(1);
  await expect.poll(() => enLecture(page), { timeout: 10_000 }).toBe(true);
  await expect(page.getByText('Boucle · sans son')).toBeVisible();
  await expect(page.getByText("La vidéo de l'animation arrive bientôt.")).toHaveCount(0);
  // La boucle repart : la lecture dépasse la durée du clip (1 s) sans jamais s'arrêter.
  const duree = await page.locator('video').evaluate((v: HTMLVideoElement) => v.duration);
  expect(duree).toBeGreaterThan(0);
  await page.waitForTimeout(Math.ceil(duree * 1000) + 700);
  expect(await enLecture(page)).toBe(true);
}

test('US 9 critère 1 : given une animation avec une vidéo « self », when j\'ouvre sa fiche, then la boucle est lue d\'elle-même, muette, sans commandes, et repart à la fin', async ({ page }) => {
  await ouvrirLaFiche(page, { clip: true });
  await verifierLecture(page);
  expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.hasAttribute('playsinline') || v.playsInline)).toBe(true);
});

test('US 9 critère 2 : given l\'appareil en mode avion, when j\'ouvre la fiche d\'une animation avec une vidéo « self », then la boucle est lue', async ({ page, context }: { page: Page; context: BrowserContext }) => {
  // L'app est chargée en ligne puis le réseau est coupé ; la fiche s'ouvre ensuite hors ligne.
  await page.clock.setFixedTime(MAINTENANT);
  await page.route('https://hubeau.eaufrance.fr/**', (route) => route.abort());
  await page.route(/open-meteo\.com/, (route) => route.abort());
  await page.route('**/assets/videos/*.mp4', (route) => route.fulfill({ status: 200, contentType: 'video/webm', body: CLIP }));
  await page.goto('/');
  const carte = page.locator('section, article, ion-card').filter({ hasText: /Animation\s*:/ }).filter({ hasNot: page.locator('section, article, ion-card') }).first();
  await carte.getByText('Voir le détail').click();
  await expect(page.getByText('Détail du conseil')).toBeVisible();
  // Une première ouverture en ligne charge le code de la page (chargement différé du serveur de dev) ; on revient au détail.
  await page.getByRole('button', { name: "Voir l'animation" }).click();
  await expect(page.getByText('Le geste', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Détail du conseil')).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: "Voir l'animation" }).click();
  await expect(page.getByText('Le geste', { exact: true })).toBeVisible();

  await verifierLecture(page);
});

test('US 9 critère 3 : given un fichier vidéo absent, when j\'ouvre la fiche, then textes seuls, sans zone vidéo, sans encadré « arrive bientôt » et sans erreur', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await ouvrirLaFiche(page, { clip: false });

  await expect(page.getByText('Vitesse', { exact: true })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByText("La vidéo de l'animation arrive bientôt.")).toHaveCount(0);
  await expect(page.getByText('Boucle · sans son')).toHaveCount(0);
  expect(erreurs).toEqual([]);
});
