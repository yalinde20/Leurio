import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const SCRIPT = 'scripts/validate-data.ts';
const POIDS = ['temperature', 'saison', 'clarte', 'luminosite', 'pression', 'lune', 'penaliteDifficulte'];
const uid = `${process.pid}-${Date.now()}`;
const DATE = '2026-10-28';

// ---------- jeu de données conforme à plusieurs entrées, propre à ces tests ----------

const espece = (code, nom) => ({
  code, nom,
  tempEauC: { active: [12, 22], ralentie: [6, 12], quasiNulle: [0, 6] },
  postes: ['bordure'], proies: ['gardon'],
  tailleMinCm: 50, fermetureAvecBrochet: true, fermetureSpecifique: null,
  sources: ['https://exemple.fr/espece'], dateVerif: DATE,
});

const technique = (id, nom) => ({
  id, nom, geste: 'Moulinet régulier', vitesse: 'lente', rythme: 'lent', erreurAEviter: 'Aller trop vite', difficulte: 1,
  videos: [{ provider: 'youtube', id: 'abc123', start: 10, auteur: 'Auteur', lienAuteur: 'https://exemple.fr/a', dateVerif: DATE }],
  sources: ['https://exemple.fr/technique'], dateVerif: DATE,
});

const leurre = (id, nom, especes, extra = {}) => ({
  id, nom, especes, zoneNage: 'mi-eau', interditFermetureBrochet: false,
  sources: ['https://exemple.fr/leurre'], dateVerif: DATE, ...extra,
});

const kit = (typeId) => ({ typeId, raison: 'Polyvalent', sources: ['https://exemple.fr/kit'], dateVerif: DATE });

const base = () => ({
  'species.json': [espece('SAN', 'Sandre'), espece('BRO', 'Brochet')],
  'lure-types.json': [
    leurre('shad', 'Shad', ['SAN', 'BRO'], { techniques: ['tiree-relachee'] }),
    leurre('spinnerbait', 'Spinnerbait', ['BRO']),
  ],
  'techniques.json': [technique('tiree-relachee', 'Tirée-relâchée'), technique('lineaire', 'Linéaire')],
  'starter-kit.json': [kit('shad'), kit('spinnerbait')],
  'federations.json': [{ departement: '75', nom: 'Fédération de Paris', url: 'https://exemple.fr', sources: ['https://exemple.fr'], dateVerif: DATE }],
  'engine-weights.json': { ...Object.fromEntries(POIDS.map((p, i) => [p, i + 1])), penaliteDifficulte: -1, seuilCielCouvert: 70 },
});

function dossier(mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), `validate-refs-${uid}-`));
  const donnees = base();
  mutate(donnees);
  for (const [nom, contenu] of Object.entries(donnees)) {
    writeFileSync(join(dir, nom), JSON.stringify(contenu, null, 2));
  }
  return dir;
}

const valider = (dir) => run('node', [SCRIPT, dir], 60_000);

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

/** Le jeu conforme passe, puis le jeu modifié échoue en nommant chaque motif. */
function refuse(mutate, motifs, fichier) {
  accepte(() => {});
  const dir = dossier(mutate);
  try {
    const r = valider(dir);
    assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
    for (const m of motifs) assert.ok(r.output.includes(m), `le message devrait contenir « ${m} » :\n${r.output}`);
    if (fichier) assert.ok(r.output.includes(fichier), `le message devrait nommer ${fichier} :\n${r.output}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- critère 0 : code d'espèce inconnu ----------

test('critère 0 : given un type de leurre dont especes cite un code absent de species.json, when on lance la validation, then elle échoue en nommant le type de leurre et le code inconnu', () => {
  refuse((d) => { d['lure-types.json'][0].especes = ['SAN', 'ZZZ']; }, ['shad', 'ZZZ'], 'lure-types.json');
});

test('critère 0 : given un second type de leurre dont especes cite un code inconnu, when on lance la validation, then le message nomme ce type', () => {
  refuse((d) => { d['lure-types.json'][1].especes = ['QQQ']; }, ['spinnerbait', 'QQQ'], 'lure-types.json');
});

// ---------- critère 1 : animation inconnue ----------

test('critère 1 : given un type de leurre qui cite dans techniques une animation absente de techniques.json, when on lance la validation, then elle échoue en nommant le type de leurre et l\'animation inconnue', () => {
  refuse((d) => { d['lure-types.json'][0].techniques = ['tiree-relachee', 'animation-fantome']; }, ['shad', 'animation-fantome'], 'lure-types.json');
});

// ---------- critère 2 : type de leurre inconnu dans le kit ----------

test('critère 2 : given une entrée de starter-kit.json dont typeId est absent de lure-types.json, when on lance la validation, then elle échoue en nommant le type inconnu', () => {
  refuse((d) => { d['starter-kit.json'].push(kit('leurre-fantome')); }, ['leurre-fantome'], 'starter-kit.json');
});

// ---------- critère 3 : doublons ----------

test('critère 3 : given deux espèces de même code, when on lance la validation, then elle échoue en nommant le code en double et species.json', () => {
  refuse((d) => { d['species.json'].push(espece('SAN', 'Autre sandre')); }, ['doublon', '« SAN »'], 'species.json');
});

test('critère 3 : given deux types de leurres de même identifiant, when on lance la validation, then elle échoue en nommant l\'identifiant en double et lure-types.json', () => {
  refuse((d) => { d['lure-types.json'].push(leurre('spinnerbait', 'Autre spinnerbait', ['SAN'])); }, ['doublon', '« spinnerbait »'], 'lure-types.json');
});

test('critère 3 : given deux animations de même identifiant, when on lance la validation, then elle échoue en nommant l\'identifiant en double et techniques.json', () => {
  refuse((d) => { d['techniques.json'].push(technique('lineaire', 'Autre linéaire')); }, ['doublon', '« lineaire »'], 'techniques.json');
});

// ---------- critère 4 : références valides ----------

test('critère 4 : given un contenu à plusieurs entrées dont toutes les références existent, when on lance la validation, then elle réussit', () => {
  accepte(() => {});
});

test('critère 4 : given un type de leurre sans le champ techniques, when on lance la validation, then il est accepté', () => {
  accepte((d) => { delete d['lure-types.json'][0].techniques; });
});

test('critère 4 : given un type de leurre dont techniques est vide, when on lance la validation, then il est accepté', () => {
  accepte((d) => { d['lure-types.json'][0].techniques = []; });
});

test('critère 4 : given le contenu réel de src/assets/data, when on lance la validation, then elle réussit', () => {
  const r = run('node', [SCRIPT], 60_000);
  assert.equal(r.status, 0, r.output);
});
