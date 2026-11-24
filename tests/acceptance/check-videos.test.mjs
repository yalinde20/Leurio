import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ROOT, readPackageJson } from '../helpers/run.mjs';

const SCRIPT = join(ROOT, 'scripts/check-videos.ts');
const GARDE = join(ROOT, 'tests/helpers/no-network.mjs');
const uid = `${process.pid}-${Date.now()}`;

/** Charge le script à tester ; échoue clairement s'il n'existe pas encore. */
async function charger() {
  const module = await import(pathToFileURL(SCRIPT).href);
  assert.equal(typeof module.checkVideos, 'function', 'scripts/check-videos.ts doit exporter checkVideos');
  return module.checkVideos;
}

/** Double de fetch : enregistre chaque requête, répond via `repondre(url)` (Response, ou lève pour une erreur réseau). */
function doubleFetch(repondre) {
  const appels = [];
  const fetch = async (url) => {
    appels.push(String(url));
    return repondre(String(url));
  };
  return { fetch, appels };
}
const json = (corps, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const youtubeAvec = (...ids) => json({ items: ids.map((id) => ({ id })) });

const technique = (id, videos) => ({ id, nom: id, videos });
const dossierVide = () => mkdtempSync(join(tmpdir(), `check-videos-${uid}-`));

async function lancer(techniques, repondre, options = {}) {
  const checkVideos = await charger();
  const { fetch, appels } = doubleFetch(repondre);
  const resultat = await checkVideos({ techniques, fetch, apiKey: 'cle-de-test', baseDir: dossierVide(), ...options });
  return { resultat, appels };
}

test('given le projet, when on lit package.json, then le script npm "check-videos" lance scripts/check-videos.ts', () => {
  assert.match(readPackageJson().scripts?.['check-videos'] ?? '', /scripts\/check-videos\.ts/);
});

test('critère 1 : given une vidéo youtube dont l\'id est rendu par la réponse simulée de videos.list, when on lance le script, then elle n\'est pas signalée', async () => {
  const { resultat, appels } = await lancer(
    [technique('lineaire', [{ provider: 'youtube', id: 'AAAAAAAAAAA' }])],
    () => youtubeAvec('AAAAAAAAAAA'),
  );
  assert.deepEqual(resultat.disparues, []);
  assert.deepEqual(resultat.nonVerifiees, []);
  assert.equal(appels.length, 1);
  assert.match(appels[0], /^https:\/\/www\.googleapis\.com\/youtube\/v3\/videos\?/);
  assert.match(appels[0], /AAAAAAAAAAA/);
  assert.match(appels[0], /key=cle-de-test/);
});

test('critère 2 : given une vidéo youtube dont l\'id est absent de la réponse simulée de videos.list, when on lance le script, then elle est signalée disparue avec l\'animation, le provider et l\'id', async () => {
  const { resultat } = await lancer(
    [technique('twitching', [{ provider: 'youtube', id: 'PRESENTE0001' }, { provider: 'youtube', id: 'MORTE000002' }])],
    () => youtubeAvec('PRESENTE0001'),
  );
  assert.deepEqual(resultat.disparues, [{ animation: 'twitching', provider: 'youtube', id: 'MORTE000002' }]);
});

test('critère 2 bis : given plus de 50 vidéos youtube, when on lance le script, then les ids sont envoyés par lots de 50 au plus', async () => {
  const ids = Array.from({ length: 120 }, (_, i) => `vid${String(i).padStart(8, '0')}`);
  const { resultat, appels } = await lancer(
    [technique('lineaire', ids.map((id) => ({ provider: 'youtube', id })))],
    (url) => youtubeAvec(...new URL(url).searchParams.get('id').split(',')),
  );
  assert.equal(appels.length, 3);
  for (const url of appels) assert.ok(new URL(url).searchParams.get('id').split(',').length <= 50);
  assert.deepEqual(resultat.disparues, []);
});

for (const [provider, debut] of [['vimeo', 'https://vimeo.com/api/oembed.json'], ['dailymotion', 'https://www.dailymotion.com/services/oembed']]) {
  test(`critère ${provider === 'vimeo' ? 3 : 4} : given une vidéo ${provider} dont la réponse oEmbed simulée est 404, then elle est signalée disparue`, async () => {
    const { resultat, appels } = await lancer(
      [technique('verticale', [{ provider, id: '12345' }])],
      () => new Response('', { status: 404 }),
    );
    assert.deepEqual(resultat.disparues, [{ animation: 'verticale', provider, id: '12345' }]);
    assert.ok(appels[0].startsWith(debut), `requête inattendue : ${appels[0]}`);
    assert.ok(appels[0].includes('12345'));
  });

  for (const status of [401, 403]) {
    test(`critère ${provider === 'vimeo' ? 3 : 4} (choix du propriétaire) : given une vidéo ${provider} dont la réponse oEmbed simulée est ${status}, then elle est signalée disparue`, async () => {
      const { resultat } = await lancer(
        [technique('verticale', [{ provider, id: '12345' }])],
        () => new Response('', { status }),
      );
      assert.deepEqual(resultat.disparues, [{ animation: 'verticale', provider, id: '12345' }]);
      assert.deepEqual(resultat.nonVerifiees, []);
    });
  }

  test(`critère 5 : given une vidéo ${provider} dont la réponse oEmbed simulée est 200, then elle n'est pas signalée`, async () => {
    const { resultat } = await lancer(
      [technique('verticale', [{ provider, id: '12345' }])],
      () => json({ title: 'ok' }),
    );
    assert.deepEqual(resultat.disparues, []);
    assert.deepEqual(resultat.nonVerifiees, []);
  });
}

test('critère 6 : given une entrée self dont le fichier est absent, then elle est signalée disparue avec le chemin du fichier', async () => {
  const baseDir = dossierVide();
  const { resultat, appels } = await lancer(
    [technique('stop-and-go', [{ provider: 'self', fichier: 'videos/absente.mp4' }])],
    () => { throw new Error('aucune requête attendue'); },
    { baseDir },
  );
  assert.deepEqual(resultat.disparues, [{ animation: 'stop-and-go', provider: 'self', fichier: 'videos/absente.mp4' }]);
  assert.equal(appels.length, 0);
});

test('critère 7 : given une entrée self dont le fichier est présent, then elle n\'est pas signalée', async () => {
  const baseDir = dossierVide();
  mkdirSync(join(baseDir, 'videos'));
  writeFileSync(join(baseDir, 'videos/presente.mp4'), 'x');
  const { resultat } = await lancer(
    [technique('stop-and-go', [{ provider: 'self', fichier: 'videos/presente.mp4' }])],
    () => { throw new Error('aucune requête attendue'); },
    { baseDir },
  );
  assert.deepEqual(resultat.disparues, []);
  assert.deepEqual(resultat.nonVerifiees, []);
});

const PANNES = [
  ['erreur réseau', () => { throw new TypeError('fetch failed'); }],
  ['réponse 500', () => new Response('', { status: 500 })],
  ['réponse 503', () => new Response('', { status: 503 })],
];
for (const [nom, repondre] of PANNES) {
  test(`critère 8 : given une réponse simulée en ${nom}, then la vidéo est signalée « non vérifiée », pas disparue (youtube, vimeo, dailymotion)`, async () => {
    const { resultat } = await lancer(
      [technique('walking-the-dog', [
        { provider: 'youtube', id: 'YT000000001' },
        { provider: 'vimeo', id: '111' },
        { provider: 'dailymotion', id: 'x222' },
      ])],
      repondre,
    );
    assert.deepEqual(resultat.disparues, []);
    assert.deepEqual(
      resultat.nonVerifiees.map(({ animation, provider, id }) => ({ animation, provider, id })).sort((a, b) => a.provider.localeCompare(b.provider)),
      [
        { animation: 'walking-the-dog', provider: 'dailymotion', id: 'x222' },
        { animation: 'walking-the-dog', provider: 'vimeo', id: '111' },
        { animation: 'walking-the-dog', provider: 'youtube', id: 'YT000000001' },
      ],
    );
    for (const v of resultat.nonVerifiees) assert.ok(v.raison && typeof v.raison === 'string', 'une raison est donnée');
  });
}

test('critère 9 : given aucune clé YouTube dans l\'environnement, then il échoue avec un message qui nomme la variable manquante', () => {
  const env = { ...process.env, NODE_OPTIONS: `--import ${GARDE}` };
  delete env.YOUTUBE_API_KEY;
  const r = spawnSync('node', [SCRIPT], { cwd: ROOT, encoding: 'utf8', env, timeout: 60_000 });
  assert.notEqual(r.status, 0);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /YOUTUBE_API_KEY/);
  assert.doesNotMatch(`${r.stdout}${r.stderr}`, /REQUETE_REELLE_INTERDITE/);
});

test('critère 9 bis : given aucune clé YouTube, when on appelle checkVideos, then elle rejette avec un message qui nomme YOUTUBE_API_KEY, sans requête', async () => {
  const checkVideos = await charger();
  const { fetch, appels } = doubleFetch(() => youtubeAvec());
  await assert.rejects(
    checkVideos({ techniques: [technique('lineaire', [{ provider: 'youtube', id: 'AAAAAAAAAAA' }])], fetch, apiKey: undefined, baseDir: dossierVide() }),
    /YOUTUBE_API_KEY/,
  );
  assert.equal(appels.length, 0);
});

test('critère 10 : given toutes les vidéos trouvées, then il se termine avec succès et ne signale rien', async () => {
  const baseDir = dossierVide();
  mkdirSync(join(baseDir, 'videos'));
  writeFileSync(join(baseDir, 'videos/a.mp4'), 'x');
  const { resultat } = await lancer(
    [technique('lineaire', [
      { provider: 'youtube', id: 'AAAAAAAAAAA' },
      { provider: 'vimeo', id: '1' },
      { provider: 'dailymotion', id: 'x2' },
      { provider: 'self', fichier: 'videos/a.mp4' },
    ])],
    (url) => (url.includes('googleapis') ? youtubeAvec('AAAAAAAAAAA') : json({})),
    { baseDir },
  );
  assert.deepEqual(resultat, { disparues: [], nonVerifiees: [] });
});

// ---------- ligne de commande (sans réseau : seules des entrées self, garde anti-réseau préchargée) ----------

function lancerCli(techniques, fichiersPresents, args = []) {
  const dir = dossierVide();
  const data = join(dir, 'techniques.json');
  writeFileSync(data, JSON.stringify(techniques));
  const assets = join(dir, 'assets');
  mkdirSync(join(assets, 'videos'), { recursive: true });
  for (const f of fichiersPresents) writeFileSync(join(assets, f), 'x');
  const r = spawnSync('node', [SCRIPT, '--data', data, '--assets', assets, ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, YOUTUBE_API_KEY: 'cle-de-test', NODE_OPTIONS: `--import ${GARDE}` },
  });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

test('critère 10 bis : given toutes les vidéos trouvées, when on lance la commande, then le code de sortie est 0 et rien n\'est signalé', () => {
  const r = lancerCli([technique('lineaire', [{ provider: 'self', fichier: 'videos/a.mp4' }])], ['videos/a.mp4']);
  assert.equal(r.status, 0, r.err);
  assert.doesNotMatch(r.out, /DISPARUE/);
});

test('critère 6 bis : given une entrée self absente, when on lance la commande, then la ligne DISPARUE donne animation, provider et chemin, et le code de sortie est 1', () => {
  const r = lancerCli([technique('twitching', [{ provider: 'self', fichier: 'videos/absente.mp4' }])], []);
  assert.equal(r.status, 1);
  assert.match(r.out, /DISPARUE\s+twitching\s+self\s+videos\/absente\.mp4/);
});

test('critère 6 ter : given une entrée self absente, when on lance la commande avec --json, then la sortie est le JSON {disparues, nonVerifiees}', () => {
  const r = lancerCli([technique('twitching', [{ provider: 'self', fichier: 'videos/absente.mp4' }])], [], ['--json']);
  assert.equal(r.status, 1);
  assert.deepEqual(JSON.parse(r.out), {
    disparues: [{ animation: 'twitching', provider: 'self', fichier: 'videos/absente.mp4' }],
    nonVerifiees: [],
  });
});

test('critère 11 : given les tests du script, when ils tournent, then aucune requête ne part vers YouTube, Vimeo ou Dailymotion', async () => {
  const vraiFetch = globalThis.fetch;
  const reelles = [];
  globalThis.fetch = async (url) => { reelles.push(String(url)); throw new Error('requête réelle interdite'); };
  try {
    const { resultat, appels } = await lancer(
      [technique('lineaire', [
        { provider: 'youtube', id: 'AAAAAAAAAAA' },
        { provider: 'vimeo', id: '1' },
        { provider: 'dailymotion', id: 'x2' },
      ])],
      (url) => (url.includes('googleapis') ? youtubeAvec('AAAAAAAAAAA') : json({})),
    );
    assert.deepEqual(resultat.disparues, []);
    assert.equal(appels.length, 3, 'toutes les requêtes passent par le double');
    assert.deepEqual(reelles, [], 'le fetch global ne doit jamais être appelé');
  } finally {
    globalThis.fetch = vraiFetch;
  }
});

test('given un fichier de données illisible, when on lance la commande, then elle échoue avec le code 3, distinct d\'une vidéo disparue', () => {
  const dir = dossierVide();
  const data = join(dir, 'techniques.json');
  writeFileSync(data, '{ pas du json');
  const r = spawnSync('node', [SCRIPT, '--data', data, '--assets', dir], {
    cwd: ROOT, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, YOUTUBE_API_KEY: 'cle-de-test', NODE_OPTIONS: `--import ${GARDE}` },
  });
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /vérification impossible/);
});

test('given une entrée self qui désigne un dossier, when on lance la commande, then elle est signalée disparue', () => {
  const r = lancerCli([technique('twitching', [{ provider: 'self', fichier: 'videos' }])], []);
  assert.equal(r.status, 1);
  assert.match(r.out, /DISPARUE\s+twitching\s+self\s+videos/);
});
