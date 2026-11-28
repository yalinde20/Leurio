// US 12 : l'app, le contenu et les boucles vidéo sont disponibles hors ligne (PLAN §4, §10 phase 5, §11 PWA).
// Les vidéos tierces ne sont jamais mises en cache (§9 bis).
// Build de production servi sur le port 4300 (voir playwright.config.ts) ; les critères 2 et 5 servent chacun leur propre copie du build.
import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { attendreFirebase, EMULATEURS, PROJET, profil } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';
import { bloquerLeReseauExterne, ouvrirUneFoisEnLigne, titreVisible } from './hors-ligne-donnees-helpers';
import { ecranConseil } from './conseil-helpers';
import { coupUn } from './conseil-helpers';

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

/** Plateformes vidéo tierces : aucune requête vers elles hors ligne (§9 bis). */
const PLATEFORMES_VIDEO = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|vimeo\.com|vimeocdn\.com|dailymotion\.com|dai\.ly)$/;

test.beforeEach(async ({ page, context }) => {
  await onboardingTermine(page);
  await bloquerLeReseauExterne(context);
});

test('US 12 critère 1 : given l\'app ouverte une fois avec du réseau, when l\'utilisateur la rouvre en mode avion, then elle s\'affiche avec son dock « Boîte », « Ma sortie », « Spots » et son avatar « Compte »', async ({ page, context }) => {
  await ouvrirUneFoisEnLigne(page);

  await context.setOffline(true);
  await page.goto('/');

  await ecranConseil(page);
  const dock = page.getByRole('navigation', { name: 'Navigation' });
  await expect(dock.getByRole('link', { name: 'Boîte', exact: true })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Ma sortie', exact: true })).toBeVisible();
  await expect(dock.getByRole('link', { name: 'Spots', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compte', exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
});

test('US 12 critère 2 : given l\'app ouverte une fois avec du réseau, sans avoir visité de fiche animation, when l\'utilisateur ouvre une fiche animation en mode avion, then le geste, la vitesse, l\'erreur à éviter et la boucle courte « self » s\'affichent', async ({ page, context }) => {
  // Décision du propriétaire : aucune vidéo n'est livrée ; tout fichier de src/assets/videos doit être préchargé à l'installation.
  // Le clip de test n'existe que dans la copie du build, déclaré dans ngsw.json comme le ferait le build.
  const racine = mkdtempSync(join(tmpdir(), 'leurio-videos-'));
  cpSync(DIST, racine, { recursive: true });
  const techniques = lire<{ animations?: unknown }[] | { animations: { videos: { provider: string; fichier?: string }[] }[] }>('techniques');
  const fichiers = [...new Set(JSON.stringify(techniques).match(/"fichier":\s*"(videos\/[^"]+)"/g)?.map((m) => `assets/${/"(videos\/[^"]+)"/.exec(m)![1]}`) ?? [])];
  expect(fichiers.length).toBeGreaterThan(0);
  ajouterVideos(racine, fichiers, readFileSync(join(__dirname, 'fixtures', 'boucle-test.webm')));

  const journal: string[] = [];
  const serveur = await servir(racine, journal);
  const base = `http://localhost:${(serveur.address() as AddressInfo).port}`;
  try {
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 47.47, longitude: -0.55 });
    await context.route('https://hubeau.eaufrance.fr/**', (route) => {
      if (!route.request().url().includes('/temperature/chronique')) return route.abort();
      return route.fulfill({
        json: {
          data: [{ code_station: '04101000', libelle_station: 'La Maine à Angers', longitude: -0.5, latitude: 47.5, date_mesure_temp: '2026-11-09', heure_mesure_temp: '06:00:00', resultat: 11.5 }],
        },
      });
    });
    const externes: string[] = [];
    page.on('request', (r) => {
      if (PLATEFORMES_VIDEO.test(new URL(r.url()).hostname)) externes.push(r.url());
    });

    // Première ouverture avec du réseau : profil sans consentement vidéo (seule la boucle est attendue), jamais de fiche.
    await page.goto(`${base}/`);
    await attendreFirebase(page);
    await page.waitForFunction(() => !!localStorage.getItem('leurio.compte'), undefined, { timeout: 30_000 });
    const uid = await page.evaluate(() => localStorage.getItem('leurio.compte') as string);
    const profilRest = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          niveau: { stringValue: 'debutant' },
          especesFavorites: { arrayValue: { values: [{ stringValue: 'SAN' }, { stringValue: 'BRO' }] } },
          consentements: { mapValue: { fields: { analytics: { booleanValue: false }, video: { booleanValue: false } } } },
          createdAt: { integerValue: String(profil.createdAt) },
          plan: { stringValue: 'free' },
        },
      }),
    });
    expect(profilRest.status).toBe(200);
    await ouvrirUneFoisEnLigne(page, base);
    const carte = () => coupUn(page);
    await expect(carte()).toBeVisible();
    // Le service worker a précaché le clip, et rien d'un autre hôte (aucune vidéo tierce en cache, §9 bis).
    const cacheVideos = () =>
      page.evaluate(async () => {
        const urls: string[] = [];
        for (const nom of await caches.keys()) for (const r of await (await caches.open(nom)).keys()) urls.push(r.url);
        return { clip: urls.some((u) => new URL(u).pathname.startsWith('/assets/videos/')), autresHotes: urls.filter((u) => new URL(u).origin !== location.origin) };
      });
    await expect.poll(async () => (await cacheVideos()).clip, { message: 'clip précaché par le service worker', timeout: 20_000 }).toBe(true);
    expect((await cacheVideos()).autresHotes).toEqual([]);

    // Mode avion, nouvelle ouverture, puis la fiche d'une animation (jamais visitée en ligne).
    await context.setOffline(true);
    externes.length = 0;
    await page.goto(`${base}/`);
    await expect(carte()).toBeVisible();
    await carte().click();
    await page.getByRole('button', { name: "Voir l'animation" }).click();

    await expect(page.getByText('Le geste', { exact: true })).toBeVisible();
    await expect(page.getByText('Vitesse', { exact: true })).toBeVisible();
    await expect(page.getByText('Erreur à éviter', { exact: true })).toBeVisible();
    await expect(page.locator('video')).toHaveCount(1);
    await expect(page.getByText('Boucle · sans son')).toBeVisible();
    await expect
      .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.error === null && v.readyState >= 2 && /\/assets\/videos\/[^/]+\.mp4$/.test(v.currentSrc)), { timeout: 15_000 })
      .toBe(true);
    expect(externes).toEqual([]);
  } finally {
    await new Promise((ok) => serveur.close(ok));
    rmSync(racine, { recursive: true, force: true });
  }
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
  await ecranConseil(page);
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
  // Le clip de test est un WebM servi sous les noms .mp4 de techniques.json (Chromium le lit ; Safari n'est pas couvert ici).
  '.mp4': 'video/webm',
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


/** Serveur statique de la copie, comme un hébergeur : types vidéo et requêtes Range (206) pris en charge, requêtes journalisées. */
async function servir(racine: string, journal: string[]): Promise<Server> {
  const serveur = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let fichier = join(racine, decodeURIComponent(url.pathname));
    try {
      if (!extname(url.pathname)) fichier = join(racine, 'index.html');
      const contenu = readFileSync(fichier);
      res.on('finish', () => journal.push(req.url ?? ''));
      const entetes = { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream', 'cache-control': 'no-cache', 'accept-ranges': 'bytes' };
      const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      if (plage) {
        const debut = plage[1] === '' ? Math.max(0, contenu.length - Number(plage[2])) : Number(plage[1]);
        const fin = plage[1] === '' || plage[2] === '' ? contenu.length - 1 : Math.min(Number(plage[2]), contenu.length - 1);
        res.writeHead(206, { ...entetes, 'content-range': `bytes ${debut}-${fin}/${contenu.length}`, 'content-length': fin - debut + 1 }).end(contenu.subarray(debut, fin + 1));
      } else {
        res.writeHead(200, { ...entetes, 'content-length': contenu.length }).end(contenu);
      }
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  });
  await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
  return serveur;
}

/** Comme le build le ferait pour un fichier de src/assets/videos : le fichier est dans la copie et dans la table de hachage de ngsw.json. */
function ajouterVideos(racine: string, chemins: string[], clip: Buffer): void {
  const ngsw = JSON.parse(readFileSync(join(racine, 'ngsw.json'), 'utf8')) as {
    timestamp: number;
    hashTable: Record<string, string>;
    assetGroups: { name: string; urls: string[] }[];
  };
  const groupe = ngsw.assetGroups.find((g) => g.name === 'videos');
  if (!groupe) throw new Error('groupe « videos » absent de ngsw.json');
  mkdirSync(join(racine, 'assets/videos'), { recursive: true });
  for (const chemin of chemins) {
    writeFileSync(join(racine, chemin), clip);
    ngsw.hashTable[`/${chemin}`] = createHash('sha1').update(clip).digest('hex');
    groupe.urls.push(`/${chemin}`);
  }
  ngsw.timestamp = Date.now();
  writeFileSync(join(racine, 'ngsw.json'), JSON.stringify(ngsw));
}

test('US 12 critère 5 : given une nouvelle version de l\'app déployée, when l\'utilisateur rouvre l\'app avec du réseau, then la nouvelle version est utilisée au plus tard à l\'ouverture suivante', async ({ page, context }) => {
  const racine = mkdtempSync(join(tmpdir(), 'leurio-deploiement-'));
  cpSync(DIST, racine, { recursive: true });
  deployer(racine, 'v1');

  const journal: string[] = [];
  const serveur = await servir(racine, journal);
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
    await ecranConseil(rouverte);
    await expect.poll(() => journal.includes('/index.html'), { timeout: 30_000 }).toBe(true);
    // La nouvelle version est prête quand le cache du service worker tient l'index.html v2.
    await expect
      .poll(
        () =>
          rouverte.evaluate(async () => {
            for (const nom of await caches.keys()) {
              const cache = await caches.open(nom);
              for (const r of await cache.keys()) {
                if (new URL(r.url).pathname !== '/index.html') continue;
                if ((await (await cache.match(r))?.text())?.includes('content="v2"')) return true;
              }
            }
            return false;
          }),
        { timeout: 30_000 },
      )
      .toBe(true);

    // Ouverture suivante : la nouvelle version est servie.
    const suivante = await context.newPage();
    await suivante.goto(`${base}/`);
    await ecranConseil(suivante);
    expect(await version(suivante)).toBe('v2');
  } finally {
    await new Promise((ok) => serveur.close(ok));
    rmSync(racine, { recursive: true, force: true });
  }
});
