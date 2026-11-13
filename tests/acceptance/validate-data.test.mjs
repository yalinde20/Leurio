import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, run, readPackageJson } from '../helpers/run.mjs';
import { readWorkflowText, parseSteps, simulate } from '../helpers/workflow.mjs';

const SCRIPT = 'scripts/validate-data.ts';
const FICHIERS = ['species', 'lure-types', 'techniques', 'starter-kit', 'federations', 'engine-weights', 'couleurs', 'lure-families'];
const POIDS = ['temperature', 'saison', 'clarte', 'luminosite', 'pression', 'lune', 'penaliteDifficulte'];
const uid = `${process.pid}-${Date.now()}`;

// ---------- jeu de données conforme, propre à ces tests (indépendant du contenu réel) ----------

const base = () => ({
  'species.json': [{
    code: 'SAN', nom: 'Sandre',
    tempEauC: { active: [12, 22], ralentie: [6, 12], quasiNulle: [0, 6] },
    postes: ['bordure', 'herbier'], proies: ['gardon'],
    tailleMinCm: 50, fermetureAvecBrochet: true, fermetureSpecifique: null, verifDepartementPrintemps: false,
    sources: ['https://exemple.fr/sandre'], dateVerif: '2026-10-28',
  }],
  'lure-types.json': [{
    id: 'shad', nom: 'Shad', article: 'un', famille: 'souples', especes: ['SAN'], zoneNage: 'mi-eau', interditFermetureBrochet: false,
    sources: ['https://exemple.fr/shad'], dateVerif: '2026-10-28',
  }],
  'techniques.json': [{
    id: 'ramener-lent', nom: 'Ramener lent', geste: 'Moulinet régulier', vitesse: 'lente', rythme: 'lent',
    erreurAEviter: 'Aller trop vite', difficulte: 1,
    videos: [
      { provider: 'youtube', id: 'abc123', start: 10, auteur: 'Auteur', lienAuteur: 'https://exemple.fr/a', dateVerif: '2026-10-28' },
      { provider: 'self', fichier: 'videos/ramener-lent.mp4', boucle: true, horsLigne: false, licence: 'CC-BY' },
    ],
    sources: ['https://exemple.fr/technique'], dateVerif: '2026-10-28',
  }],
  'starter-kit.json': [{ typeId: 'shad', raison: 'Polyvalent', sources: ['https://exemple.fr/kit'], dateVerif: '2026-10-28' }],
  'lure-families.json': [{ id: 'souples', nom: 'Souples', sources: ['https://exemple.fr/famille'], dateVerif: '2026-10-28' }],
  'couleurs.json': [
    { id: 'naturelle-a', nom: 'Naturelle A', classe: 'naturelle', sources: ['https://exemple.fr/couleur'], dateVerif: '2026-10-28' },
    { id: 'vive-a', nom: 'Vive A', classe: 'vive', sources: ['https://exemple.fr/couleur'], dateVerif: '2026-10-28' },
  ],
  'federations.json': [{ departement: '75', nom: 'Fédération de Paris', url: 'https://exemple.fr', sources: ['https://exemple.fr'], dateVerif: '2026-10-28' }],
  'engine-weights.json': { ...Object.fromEntries(POIDS.map((p, i) => [p, i + 1])), penaliteDifficulte: -1, seuilCielCouvert: 70, seuilPression: 5, phasesLuneBonus: ['Nouvelle lune', 'Pleine lune'] },
});

/** Dossier temporaire contenant le jeu conforme modifié par `mutate(donnees)`. Retourne { dir, nettoyer }. */
function dossier(mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), `validate-data-${uid}-`));
  const donnees = base();
  mutate(donnees);
  for (const [nom, contenu] of Object.entries(donnees)) {
    if (contenu === undefined) continue;
    writeFileSync(join(dir, nom), typeof contenu === 'string' ? contenu : JSON.stringify(contenu, null, 2));
  }
  return dir;
}

const valider = (dir) => run('node', [SCRIPT, dir], 60_000);

/** Le jeu conforme passe (sinon le test ne prouve rien), puis le jeu modifié échoue. */
function refuse(mutate, motifs, { fichier } = {}) {
  assert.ok(existsSync(join(ROOT, SCRIPT)), `${SCRIPT} n'existe pas`);
  const bon = dossier();
  const ok = valider(bon);
  rmSync(bon, { recursive: true, force: true });
  assert.equal(ok.status, 0, `le jeu conforme devrait réussir :\n${ok.output}`);
  const dir = dossier(mutate);
  try {
    const r = valider(dir);
    assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
    for (const m of [].concat(motifs)) {
      assert.match(r.output, m instanceof RegExp ? m : new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `le message devrait contenir ${m} :\n${r.output}`);
    }
    if (fichier) assert.ok(r.output.includes(fichier), `le message devrait nommer ${fichier} :\n${r.output}`);
    return r;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function accepte(mutate) {
  assert.ok(existsSync(join(ROOT, SCRIPT)), `${SCRIPT} n'existe pas`);
  const dir = dossier(mutate);
  try {
    const r = valider(dir);
    assert.equal(r.status, 0, `la validation aurait dû réussir :\n${r.output}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const sans = (obj, champ) => { delete obj[champ]; };

// ---------- critère 0 ----------

test('critère 0 : given les six fichiers conformes, when on lance la validation du contenu, then elle se termine avec succès', () => {
  accepte(() => {});
});

test('critère 0 : given le contenu réel de src/assets/data, when on lance la validation, then elle réussit', () => {
  for (const f of FICHIERS) assert.ok(existsSync(join(ROOT, 'src/assets/data', `${f}.json`)), `src/assets/data/${f}.json est absent`);
  const r = run('node', [SCRIPT], 60_000);
  assert.equal(r.status, 0, r.output);
});

test('critère 0 : given le projet, when on lance npm run validate-data, then la commande réussit', () => {
  assert.ok(readPackageJson().scripts?.['validate-data'], 'le script npm "validate-data" n\'existe pas');
  const r = run('npm', ['run', 'validate-data'], 120_000);
  assert.equal(r.status, 0, r.output);
});

test('critère 0 : given le dossier schemas, when on le liste, then il y a un schéma par fichier de contenu', () => {
  for (const f of FICHIERS) assert.ok(existsSync(join(ROOT, 'schemas', `${f}.schema.json`)), `schemas/${f}.schema.json est absent`);
});

// ---------- critère 1 : espèce ----------

for (const champ of ['code', 'nom', 'tempEauC', 'postes', 'proies', 'tailleMinCm', 'fermetureAvecBrochet', 'verifDepartementPrintemps', 'sources', 'dateVerif']) {
  test(`critère 1 : given une espèce sans ${champ}, when on valide, then l'échec nomme species.json, l'espèce et ${champ}`, () => {
    // sans code, l'espèce est identifiée par son nom ou sa position
    refuse((d) => sans(d['species.json'][0], champ), [champ, champ === 'code' ? /espèce (Sandre|n° 1)/ : 'SAN'], { fichier: 'species.json' });
  });
}

test('critère 1 : given une espèce sans sources, when on valide, then un tableau sources vide est aussi refusé', () => {
  refuse((d) => { d['species.json'][0].sources = []; }, 'sources', { fichier: 'species.json' });
});

test('critère 1 : given une espèce avec tailleMinCm null et fermetureSpecifique absent, when on valide, then c\'est accepté', () => {
  accepte((d) => { d['species.json'][0].tailleMinCm = null; sans(d['species.json'][0], 'fermetureSpecifique'); });
});

// ---------- critère 2 : tempEauC ----------

for (const plage of ['active', 'ralentie', 'quasiNulle']) {
  test(`critère 2 : given une espèce dont tempEauC n'a pas la plage ${plage}, when on valide, then l'échec nomme species.json, SAN et ${plage}`, () => {
    refuse((d) => sans(d['species.json'][0].tempEauC, plage), [plage, 'SAN'], { fichier: 'species.json' });
  });
  test(`critère 2 : given une plage ${plage} d'un seul nombre, when on valide, then l'échec nomme ${plage}`, () => {
    refuse((d) => { d['species.json'][0].tempEauC[plage] = [10]; }, [plage, 'SAN'], { fichier: 'species.json' });
  });
  test(`critère 2 : given une plage ${plage} contenant du texte, when on valide, then l'échec nomme ${plage}`, () => {
    refuse((d) => { d['species.json'][0].tempEauC[plage] = [5, 'chaud']; }, [plage, 'SAN'], { fichier: 'species.json' });
  });
}

// ---------- critère 3 : type de leurre ----------

for (const champ of ['article', 'especes', 'zoneNage', 'interditFermetureBrochet', 'sources', 'dateVerif']) {
  test(`critère 3 : given un type de leurre sans ${champ}, when on valide, then l'échec nomme lure-types.json, shad et ${champ}`, () => {
    refuse((d) => sans(d['lure-types.json'][0], champ), [champ, 'shad'], { fichier: 'lure-types.json' });
  });
}

// ---------- critère 4 : zone de nage ----------

test('critère 4 : given une zone de nage "profondeur", when on valide, then l\'échec nomme lure-types.json et zoneNage', () => {
  refuse((d) => { d['lure-types.json'][0].zoneNage = 'profondeur'; }, ['zoneNage', 'shad'], { fichier: 'lure-types.json' });
});

for (const zone of ['surface', 'mi-eau', 'fond']) {
  test(`critère 4 : given la zone de nage "${zone}", when on valide, then elle est acceptée`, () => {
    accepte((d) => { d['lure-types.json'][0].zoneNage = zone; });
  });
}

// ---------- critère 5 : animation ----------

for (const champ of ['geste', 'vitesse', 'erreurAEviter', 'difficulte', 'videos', 'sources', 'dateVerif']) {
  test(`critère 5 : given une animation sans ${champ}, when on valide, then l'échec nomme techniques.json, ramener-lent et ${champ}`, () => {
    refuse((d) => sans(d['techniques.json'][0], champ), [champ, 'ramener-lent'], { fichier: 'techniques.json' });
  });
}

// ---------- critère 6 : difficulté ----------

for (const v of [0, 4, 1.5, '2']) {
  test(`critère 6 : given une difficulté ${JSON.stringify(v)}, when on valide, then l'échec nomme techniques.json et difficulte`, () => {
    refuse((d) => { d['techniques.json'][0].difficulte = v; }, ['difficulte', 'ramener-lent'], { fichier: 'techniques.json' });
  });
}

for (const v of [1, 2, 3]) {
  test(`critère 6 : given une difficulté ${v}, when on valide, then elle est acceptée`, () => {
    accepte((d) => { d['techniques.json'][0].difficulte = v; });
  });
}

// ---------- critère 7 : provider ----------

for (const p of ['tiktok', 'YouTube', '']) {
  test(`critère 7 : given une vidéo de provider "${p}", when on valide, then l'échec nomme techniques.json et provider`, () => {
    refuse((d) => { d['techniques.json'][0].videos[0].provider = p; }, ['provider', 'ramener-lent'], { fichier: 'techniques.json' });
  });
}

for (const p of ['youtube', 'vimeo', 'dailymotion']) {
  test(`critère 7 : given une vidéo de provider "${p}" avec un id, when on valide, then elle est acceptée`, () => {
    accepte((d) => { d['techniques.json'][0].videos = [{ provider: p, id: 'x1' }]; });
  });
}

// ---------- critère 8 : youtube, vimeo, dailymotion ----------

for (const p of ['youtube', 'vimeo', 'dailymotion']) {
  test(`critère 8 : given une vidéo ${p} sans id, when on valide, then l'échec nomme techniques.json et id`, () => {
    refuse((d) => { d['techniques.json'][0].videos = [{ provider: p }]; }, [/\bid\b/, 'ramener-lent'], { fichier: 'techniques.json' });
  });
  test(`critère 8 : given une vidéo ${p} avec un id vide, when on valide, then l'échec nomme id`, () => {
    refuse((d) => { d['techniques.json'][0].videos = [{ provider: p, id: '' }]; }, [/\bid\b/, 'ramener-lent'], { fichier: 'techniques.json' });
  });
  test(`critère 8 : given une vidéo ${p} avec un start négatif, when on valide, then l'échec nomme start`, () => {
    refuse((d) => { d['techniques.json'][0].videos = [{ provider: p, id: 'x1', start: -1 }]; }, ['start', 'ramener-lent'], { fichier: 'techniques.json' });
  });
}

// ---------- critère 9 : self ----------

test('critère 9 : given une vidéo self sans fichier, when on valide, then l\'échec nomme techniques.json et fichier', () => {
  refuse((d) => { d['techniques.json'][0].videos = [{ provider: 'self', boucle: true }]; }, ['fichier', 'ramener-lent'], { fichier: 'techniques.json' });
});

// ---------- critère 10 : dateVerif ----------

const FICHES = {
  'species.json': (d) => d['species.json'][0],
  'lure-types.json': (d) => d['lure-types.json'][0],
  'techniques.json': (d) => d['techniques.json'][0],
  'starter-kit.json': (d) => d['starter-kit.json'][0],
  'federations.json': (d) => d['federations.json'][0],
};
for (const [fichier, fiche] of Object.entries(FICHES)) {
  for (const date of ['28/10/2026', '2026-13-01', '2026-10-28T10:00:00Z']) {
    test(`critère 10 : given ${fichier} dont dateVerif vaut "${date}", when on valide, then l'échec nomme le fichier et dateVerif`, () => {
      refuse((d) => { fiche(d).dateVerif = date; }, 'dateVerif', { fichier });
    });
  }
}

test('critère 10 : given une dateVerif AAAA-MM-JJ valide, when on valide, then elle est acceptée', () => {
  accepte((d) => { for (const f of Object.values(FICHES)) f(d).dateVerif = '2026-02-28'; });
});

// ---------- critère 11 : fédérations ----------

for (const url of ['http://federation.exemple.fr', 'federation.exemple.fr', 'ftp://federation.exemple.fr']) {
  test(`critère 11 : given une fédération dont l'url vaut "${url}", when on valide, then l'échec nomme federations.json et url`, () => {
    refuse((d) => { d['federations.json'][0].url = url; }, ['url', '75'], { fichier: 'federations.json' });
  });
}

// ---------- critère 12 : poids du moteur ----------

for (const poids of POIDS) {
  test(`critère 12 : given engine-weights.json sans le poids ${poids}, when on valide, then l'échec nomme engine-weights.json et ${poids}`, () => {
    refuse((d) => sans(d['engine-weights.json'], poids), [poids], { fichier: 'engine-weights.json' });
  });
}

test('critère 12 : given un poids qui n\'est pas un nombre, when on valide, then l\'échec nomme le poids', () => {
  refuse((d) => { d['engine-weights.json'].lune = 'fort'; }, ['lune'], { fichier: 'engine-weights.json' });
});

// ---------- critère 13 : JSON invalide ou fichier absent ----------

for (const f of FICHIERS) {
  test(`critère 13 : given ${f}.json qui n'est pas du JSON valide, when on valide, then l'échec nomme ${f}.json`, () => {
    refuse((d) => { d[`${f}.json`] = '{ ceci n\'est pas du JSON'; }, [], { fichier: `${f}.json` });
  });
  test(`critère 13 : given ${f}.json absent, when on valide, then l'échec nomme ${f}.json`, () => {
    refuse((d) => { d[`${f}.json`] = undefined; }, [], { fichier: `${f}.json` });
  });
}

// ---------- critère 14 : CI ----------

const VALIDATION = 'npm run validate-data';

test('critère 14 : given le workflow CI, when on le lit, then l\'étape npm run validate-data est après l\'installation, avant le build et sans échappatoire', () => {
  const steps = parseSteps(readWorkflowText());
  const i = steps.findIndex((s) => s.run?.trim() === VALIDATION);
  assert.notEqual(i, -1, `aucune étape ne lance « ${VALIDATION} »`);
  const install = steps.findIndex((s) => s.run?.trim() === 'npm ci');
  const build = steps.findIndex((s) => s.run?.trim() === 'npm run build:emulateurs');
  assert.ok(install !== -1 && install < i && i < build, `ordre attendu : installation (${install}) < validation (${i}) < build (${build})`);
  assert.equal(steps[i]['continue-on-error'], undefined, 'continue-on-error ferait passer un échec');
  assert.equal(steps[i].if, undefined, 'une condition pourrait sauter l\'étape');
});

test('critère 14 : given une PR contenant un fichier de contenu mal formé, when le CI tourne, then le CI échoue à l\'étape de validation du contenu', () => {
  const steps = parseSteps(readWorkflowText());
  const etape = steps.find((s) => s.run?.trim() === VALIDATION);
  assert.ok(etape, `aucune étape ne lance « ${VALIDATION} »`);
  const rel = 'src/assets/data/species.json';
  const p = join(ROOT, rel);
  const ancien = existsSync(p) ? readFileSync(p, 'utf8') : null;
  try {
    writeFileSync(p, '[ { "code": "SAN" } ]');
    // seule l'étape de validation est exécutée : les autres étapes ont leurs propres tests
    const r = simulate([etape]);
    assert.equal(r.ok, false, 'le CI aurait dû échouer');
    assert.equal(r.failed.command.trim(), VALIDATION);
    assert.match(r.failed.output, /species\.json/);
  } finally {
    if (ancien === null) rmSync(p, { force: true });
    else writeFileSync(p, ancien);
  }
});

// ---------- critère 15 : CLAUDE.md ----------

test('critère 15 : given CLAUDE.md, when on lit « ## Commands », then elle donne la commande de validation du contenu', () => {
  const md = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const section = md.split(/^## /m).find((s) => s.startsWith('Commands')) ?? '';
  assert.match(section, /^- .*`npm run validate-data`/m, 'la section Commands ne donne pas `npm run validate-data`');
  assert.ok(readPackageJson().scripts?.['validate-data'], 'le script npm "validate-data" n\'existe pas');
  assert.match(readPackageJson().scripts['validate-data'], /scripts\/validate-data\.ts/);
});
