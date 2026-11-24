// US 12 : l'app, le contenu et les boucles vidéo sont disponibles hors ligne (PLAN §4, §10 phase 5, §11 PWA).
// Les vidéos tierces ne sont jamais mises en cache (§9 bis). Le critère 2 (fiche animation) est reporté.
// Build de production servi sur le port 4300 (voir playwright.config.ts) ; le critère 5 sert sa propre copie.
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

test.use({ viewport: { width: 390, height: 844 } });

interface ElementKit {
  typeId: string;
  raison: string;
}
interface TypeLeurre {
  id: string;
  nom: string;
}
const lire = <T>(f: string) => JSON.parse(readFileSync(join(process.cwd(), 'src/assets/data', `${f}.json`), 'utf8')) as T;
const DIST = join(process.cwd(), 'dist/leurio/browser');

const titreVisible = (page: Page) => page.locator('ion-toolbar ion-title:visible');

/** Aucun service réel : seules les adresses locales passent (le mode avion coupe ensuite le local aussi). */
async function bloquerLeReseauExterne(context: BrowserContext): Promise<void> {
  await context.route((url) => !estLocal(url.toString()), (route) => route.abort());
}

/**
 * L'utilisateur ouvre l'app une première fois avec du réseau, sur l'écran « Conseil » (sans visiter les écrans testés) :
 * le service worker s'active, contrôle la page (après un rechargement) et remplit son cache.
 */
async function ouvrirUneFoisEnLigne(page: Page, base = ''): Promise<void> {
  await page.goto(`${base}/`);
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

test.beforeEach(async ({ page, context }) => {
  await onboardingTermine(page);
  await bloquerLeReseauExterne(context);
});

test('US 12 critère 1 : given l\'app ouverte une fois avec du réseau, when l\'utilisateur la rouvre en mode avion, then elle s\'affiche avec ses 4 onglets « Conseil », « Boîte », « Spots » et « Compte »', async ({ page, context }) => {
  await ouvrirUneFoisEnLigne(page);

  await context.setOffline(true);
  await page.goto('/');

  await expect(titreVisible(page)).toHaveText('Conseil');
  for (const nom of ['Conseil', 'Boîte', 'Spots', 'Compte']) {
    await expect(page.getByRole('tab', { name: nom, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('tab')).toHaveCount(4);
});

test('US 12 critère 3 : given l\'app ouverte une fois avec du réseau sans avoir visité la boîte, when l\'utilisateur ouvre en mode avion le kit de départ et la liste des types de leurres, then leur contenu s\'affiche', async ({ page, context }) => {
  const kit = lire<ElementKit[]>('starter-kit');
  const types = lire<TypeLeurre[]>('lure-types');
  const noms = new Map(types.map((t) => [t.id, t.nom]));

  // Première ouverture en ligne : Conseil seulement (jamais la Boîte), compte anonyme créé.
  await page.goto('/');
  await attendreFirebase(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lireUid = () => page.evaluate(() => (((window as any).leurioFirebase.auth.currentUser?.uid ?? null) as string | null));
  await expect.poll(lireUid, { timeout: 20_000 }).not.toBeNull();
  await ouvrirUneFoisEnLigne(page);
  // L'utilisateur laisse au service worker le temps de tout garder ; s'il manque quelque chose, l'assertion hors ligne échouera.
  await page
    .waitForFunction(
      async () => {
        const cles: string[] = [];
        for (const nom of await caches.keys()) for (const r of await (await caches.open(nom)).keys()) cles.push(new URL(r.url).pathname);
        return cles.some((c) => c.endsWith('/assets/data/lure-types.json')) && cles.some((c) => c.endsWith('/assets/data/starter-kit.json'));
      },
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => undefined);

  await context.setOffline(true);
  await page.goto('/boite');
  await expect(titreVisible(page)).toHaveText('Boîte');

  // Kit de départ.
  await page.getByRole('button', { name: 'Kit de départ conseillé', exact: true }).click();
  const feuille = page.locator('[role="dialog"]');
  await expect(feuille).toBeVisible();
  const lignes = feuille.locator('li');
  await expect(lignes).toHaveCount(kit.length);
  for (const [i, element] of kit.entries()) {
    await expect(lignes.nth(i)).toContainText(noms.get(element.typeId)!);
    await expect(lignes.nth(i)).toContainText(element.raison);
  }
  await feuille.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(feuille).toHaveCount(0);

  // Liste des types de leurres (choix « Type » du formulaire d'ajout).
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  await expect(feuille).toBeVisible();
  const proposes = await feuille.getByLabel('Type').locator('option').allTextContents();
  for (const type of types) expect(proposes.map((p) => p.trim())).toContain(type.nom);
});

test('US 12 critère 4 : given l\'app de production, when on lance l\'audit d\'installabilité de Lighthouse (via Chrome), then il indique une app installable avec un service worker actif', async ({ page }) => {
  await page.goto('/');
  await expect(titreVisible(page)).toHaveText('Conseil');
  const actif = await page.evaluate(async () => {
    const prete = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 25_000))]);
    if (!prete) return null;
    const fin = Date.now() + 25_000;
    while (prete.active && prete.active.state !== 'activated' && Date.now() < fin) await new Promise((r) => setTimeout(r, 100));
    return prete.active?.state ?? null;
  });
  expect(actif).toBe('activated');

  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});

// ---- Critère 5 : une nouvelle version déployée est utilisée au plus tard à l'ouverture suivante. ----

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** « Déploie » une version : balise de version dans index.html, puis ngsw.json recalculé (hash SHA-1 + horodatage). */
function deployer(racine: string, version: string): void {
  const chemin = join(racine, 'index.html');
  const html = readFileSync(chemin, 'utf8').replace(/<meta name="leurio-version"[^>]*>/, '').replace('</head>', `<meta name="leurio-version" content="${version}"></head>`);
  writeFileSync(chemin, html);
  const ngsw = JSON.parse(readFileSync(join(racine, 'ngsw.json'), 'utf8')) as { timestamp: number; hashTable: Record<string, string> };
  ngsw.hashTable['/index.html'] = createHash('sha1').update(readFileSync(chemin)).digest('hex');
  ngsw.timestamp = Date.now();
  writeFileSync(join(racine, 'ngsw.json'), JSON.stringify(ngsw));
}

test('US 12 critère 5 : given une nouvelle version de l\'app déployée, when l\'utilisateur rouvre l\'app avec du réseau, then la nouvelle version est utilisée au plus tard à l\'ouverture suivante', async ({ page, context }) => {
  const racine = mkdtempSync(join(tmpdir(), 'leurio-deploiement-'));
  cpSync(DIST, racine, { recursive: true });
  deployer(racine, 'v1');

  const journal: string[] = [];
  const serveur: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let fichier = join(racine, decodeURIComponent(url.pathname));
    try {
      if (!extname(url.pathname)) fichier = join(racine, 'index.html');
      const contenu = readFileSync(fichier);
      res.on('finish', () => journal.push(req.url ?? ''));
      res.writeHead(200, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }).end(contenu);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  });
  await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
  const base = `http://localhost:${(serveur.address() as AddressInfo).port}`;
  const version = (p: Page) => p.locator('meta[name="leurio-version"]').getAttribute('content');

  try {
    // Première ouverture, version v1 installée par le service worker.
    await ouvrirUneFoisEnLigne(page, base);
    expect(await version(page)).toBe('v1');

    // Nouvelle version déployée sur le serveur.
    deployer(racine, 'v2');
    journal.length = 0;

    // L'utilisateur rouvre l'app avec du réseau : le service worker voit la nouvelle version et la télécharge.
    const rouverte = await context.newPage();
    await rouverte.goto(`${base}/`);
    await expect(titreVisible(rouverte)).toHaveText('Conseil');
    await expect.poll(() => journal.includes('/index.html'), { timeout: 30_000 }).toBe(true);

    // Ouverture suivante : la nouvelle version est servie.
    const suivante = await context.newPage();
    await suivante.goto(`${base}/`);
    await expect(titreVisible(suivante)).toHaveText('Conseil');
    expect(await version(suivante)).toBe('v2');
  } finally {
    await new Promise((ok) => serveur.close(ok));
    rmSync(racine, { recursive: true, force: true });
  }
});
