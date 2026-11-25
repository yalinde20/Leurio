import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../helpers/run.mjs';

const WORKFLOW = join(ROOT, '.github/workflows/check-videos.yml');
const SCRIPT = join(ROOT, 'scripts/signaler-videos.ts');
const REPO = 'proprio/leurio';
const TITRE = 'Vidéos disparues';

function lireWorkflow() {
  assert.ok(existsSync(WORKFLOW), '.github/workflows/check-videos.yml doit exister');
  return readFileSync(WORKFLOW, 'utf8');
}

async function charger() {
  const module = await import(pathToFileURL(SCRIPT).href);
  assert.equal(typeof module.signalerVideosDisparues, 'function', 'scripts/signaler-videos.ts doit exporter signalerVideosDisparues');
  return module.signalerVideosDisparues;
}

const json = (corps, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });

/** Double de l'API GitHub : `ouvertes` est la liste rendue par GET /issues. */
function doubleGithub(ouvertes = []) {
  const appels = [];
  const fetch = async (url, init = {}) => {
    const methode = (init.method ?? 'GET').toUpperCase();
    appels.push({ url: String(url), methode, init, corps: init.body ? JSON.parse(init.body) : undefined });
    if (methode === 'GET') return json(ouvertes);
    if (methode === 'POST') return json({ number: 99 }, 201);
    return json({ number: Number(String(url).split('/').pop()) });
  };
  return { fetch, appels };
}

const DISPARUES = [
  { animation: 'twitching', provider: 'youtube', id: 'MORTE000002' },
  { animation: 'lineaire', provider: 'vimeo', id: '12345' },
  { animation: 'stop-and-go', provider: 'self', fichier: 'videos/absente.mp4' },
];

async function lancer(disparues, ouvertes = []) {
  const signaler = await charger();
  const { fetch, appels } = doubleGithub(ouvertes);
  const resultat = await signaler({ disparues, repo: REPO, token: 'jeton-de-test', fetch });
  return { resultat, appels, ecritures: appels.filter((a) => a.methode !== 'GET') };
}

test('critère 1 : given le workflow, when on lit son déclenchement, then il tourne une fois par semaine', () => {
  const texte = lireWorkflow();
  const crons = [...texte.matchAll(/^\s*-?\s*cron:\s*['"]?([^'"\n#]+?)['"]?\s*(?:#.*)?$/gm)].map((m) => m[1]);
  assert.equal(crons.length, 1, 'un seul cron');
  assert.match(texte, /^on:\s*\n\s+schedule:/m);
  const champs = crons[0].trim().split(/\s+/);
  assert.equal(champs.length, 5, 'cron à 5 champs');
  const [minute, heure, jourMois, mois, jourSemaine] = champs;
  assert.match(minute, /^\d+$/);
  assert.match(heure, /^\d+$/);
  assert.equal(jourMois, '*');
  assert.equal(mois, '*');
  assert.match(jourSemaine, /^([0-7]|MON|TUE|WED|THU|FRI|SAT|SUN)$/i, 'un seul jour de la semaine');
});

test('critère 1 bis : given le workflow, when on le lit, then il installe, lance scripts/signaler-videos.ts et peut écrire des issues', () => {
  const texte = lireWorkflow();
  assert.match(texte, /npm ci/);
  assert.match(texte, /node scripts\/signaler-videos\.ts/);
  assert.match(texte, /permissions:[\s\S]*?issues:\s*write/);
  assert.match(texte, /GITHUB_TOKEN:\s*\$\{\{\s*(secrets\.GITHUB_TOKEN|github\.token)\s*\}\}/);
});

test('critère 2 : given des vidéos disparues et aucune issue ouverte, when le workflow tourne, then une issue « Vidéos disparues » est ouverte listant animation, provider et id ou fichier', async () => {
  const { resultat, appels, ecritures } = await lancer(DISPARUES, []);
  assert.equal(appels[0].methode, 'GET');
  assert.ok(appels[0].url.startsWith(`https://api.github.com/repos/${REPO}/issues?`), appels[0].url);
  assert.match(appels[0].url, /state=open/);
  assert.equal(ecritures.length, 1);
  const [post] = ecritures;
  assert.equal(post.methode, 'POST');
  assert.equal(post.url, `https://api.github.com/repos/${REPO}/issues`);
  assert.equal(post.corps.title, TITRE);
  const lignes = post.corps.body.split('\n');
  for (const [animation, provider, ref] of [['twitching', 'youtube', 'MORTE000002'], ['lineaire', 'vimeo', '12345'], ['stop-and-go', 'self', 'videos/absente.mp4']]) {
    const ligne = lignes.find((l) => l.includes(ref));
    assert.ok(ligne, `une ligne pour ${ref}`);
    assert.ok(ligne.includes(animation) && ligne.includes(provider), `la ligne « ${ligne} » donne animation et provider`);
  }
  assert.equal(post.init.headers.Authorization ?? post.init.headers.authorization, 'Bearer jeton-de-test');
  assert.deepEqual(resultat, { action: 'ouverte', numero: 99 });
});

test('critère 2 bis : given une pull request nommée « Vidéos disparues » parmi les éléments ouverts, when le workflow tourne, then elle est ignorée et une issue est ouverte', async () => {
  const { resultat, ecritures } = await lancer(DISPARUES, [{ number: 5, title: TITRE, pull_request: {} }]);
  assert.equal(ecritures.length, 1);
  assert.equal(ecritures[0].methode, 'POST');
  assert.equal(resultat.action, 'ouverte');
});

test('critère 3 : given des vidéos disparues et une issue « Vidéos disparues » déjà ouverte, when le workflow tourne, then aucune issue n\'est ouverte et l\'existante est mise à jour avec la liste courante', async () => {
  const ouvertes = [
    { number: 3, title: 'Autre sujet' },
    { number: 12, title: TITRE, body: 'ancienne liste : vieille-animation OLDVIDEO0001' },
  ];
  const { resultat, ecritures } = await lancer(DISPARUES, ouvertes);
  assert.equal(ecritures.length, 1);
  assert.ok(!ecritures.some((e) => e.methode === 'POST'), 'aucun POST');
  const [patch] = ecritures;
  assert.equal(patch.methode, 'PATCH');
  assert.equal(patch.url, `https://api.github.com/repos/${REPO}/issues/12`);
  assert.match(patch.corps.body, /MORTE000002/);
  assert.match(patch.corps.body, /12345/);
  assert.match(patch.corps.body, /videos\/absente\.mp4/);
  assert.doesNotMatch(patch.corps.body, /OLDVIDEO0001/, 'le corps est remplacé, pas complété');
  assert.equal(patch.init.headers.Authorization ?? patch.init.headers.authorization, 'Bearer jeton-de-test');
  assert.deepEqual(resultat, { action: 'mise-a-jour', numero: 12 });
});

test('critère 4 : given aucune vidéo disparue, when le workflow tourne, then aucune issue n\'est ouverte ni modifiée', async () => {
  for (const ouvertes of [[], [{ number: 12, title: TITRE, body: 'x' }]]) {
    const { resultat, ecritures } = await lancer([], ouvertes);
    assert.equal(ecritures.length, 0);
    assert.equal(resultat.action, 'aucune');
  }
});

test('critère 5 : given le fichier du workflow, when on le lit, then la clé YouTube vient d\'un secret GitHub et aucune valeur de clé n\'y figure', () => {
  const texte = lireWorkflow();
  assert.match(texte, /YOUTUBE_API_KEY:\s*\$\{\{\s*secrets\.YOUTUBE_API_KEY\s*\}\}/);
  assert.doesNotMatch(texte, /AIza[0-9A-Za-z_-]{35}/);
  assert.doesNotMatch(texte, /key=[^\s$]/i);
  for (const m of texte.matchAll(/YOUTUBE_API_KEY\s*[:=]\s*(\S+)/g)) {
    assert.match(m[1], /^\$\{\{/, `YOUTUBE_API_KEY ne doit pas recevoir de valeur littérale : ${m[1]}`);
  }
});

test('critère 6 : given les tests de l\'ouverture d\'issue, when ils tournent, then ils utilisent une API GitHub simulée et le fetch global n\'est jamais appelé', async () => {
  const vraiFetch = globalThis.fetch;
  const reelles = [];
  globalThis.fetch = async (url) => { reelles.push(String(url)); throw new Error('requête réelle interdite'); };
  try {
    const { appels } = await lancer(DISPARUES, []);
    assert.ok(appels.length >= 2, 'toutes les requêtes passent par le double');
    assert.ok(appels.every((a) => a.url.startsWith('https://api.github.com/')));
    assert.deepEqual(reelles, []);
  } finally {
    globalThis.fetch = vraiFetch;
  }
});
