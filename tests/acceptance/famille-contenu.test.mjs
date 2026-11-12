// US 100 : famille de chaque type de leurre, lue dans le contenu (PLAN §3 Boîte, §7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const lire = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));

function valider(mutate) {
  const dir = mkdtempSync(join(tmpdir(), `famille-${process.pid}-`));
  try {
    const src = join(ROOT, 'src/assets/data');
    for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(join(src, f), join(dir, f));
    const lure = lire('src/assets/data/lure-types.json');
    mutate(lure);
    writeFileSync(join(dir, 'lure-types.json'), JSON.stringify(lure, null, 2));
    return run('node', ['scripts/validate-data.ts', dir], 60_000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const FAMILLES = {
  souples: ['shad', 'ver-finesse', 'creature', 'swimbait', 'shad-silure', 'micro-leurre-souple'],
  durs: ['crankbait', 'jerkbait-minnow', 'lipless', 'micro-crankbait'],
  surface: ['stickbait', 'popper', 'frog', 'insecte-surface'],
  metalliques: ['cuillere-tournante', 'cuillere-ondulante', 'micro-cuillere', 'tailspinner', 'jig-metal'],
  'a-jupe': ['jig', 'spinnerbait', 'chatterbait'],
};
const NOMS = ['Souples', 'Durs', 'Surface', 'Métalliques', 'À jupe'];
// Ordre de lure-types.json sur main (c36ea06) : il départage les égalités du moteur, il ne doit pas bouger.
const ORDRE_TYPES = [
  'shad', 'ver-finesse', 'creature', 'jig', 'spinnerbait', 'chatterbait', 'cuillere-tournante', 'cuillere-ondulante', 'crankbait',
  'jerkbait-minnow', 'lipless', 'stickbait', 'popper', 'frog', 'swimbait', 'tailspinner', 'jig-metal', 'shad-silure',
  'micro-leurre-souple', 'micro-cuillere', 'micro-crankbait', 'insecte-surface',
];

test('US 100 contenu : given lure-types.json, when on lit les types, then chacun a une `famille` texte non vide', () => {
  for (const t of lire('src/assets/data/lure-types.json')) {
    assert.ok(typeof t.famille === 'string' && t.famille.trim() !== '', `${t.id} : famille manquante ou vide`);
  }
});

test('US 100 contenu : given lure-types.json, when on lit les familles, then chacune est l\'id de l\'affectation validée', () => {
  const types = lire('src/assets/data/lure-types.json');
  for (const [famille, ids] of Object.entries(FAMILLES)) {
    for (const id of ids) assert.equal(types.find((t) => t.id === id)?.famille, famille, `${id} doit être « ${famille} »`);
  }
});

test('US 100 contenu : given lure-types.json, when on lit les ids, then l\'ordre d\'origine est conservé', () => {
  assert.deepEqual(lire('src/assets/data/lure-types.json').map((t) => t.id), ORDRE_TYPES);
});

test('US 100 contenu : given lure-families.json, when on le lit, then il contient les 5 familles dans l\'ordre validé, avec sources et dateVerif', () => {
  const f = lire('src/assets/data/lure-families.json');
  assert.deepEqual(f.map((x) => [x.id, x.nom]), Object.keys(FAMILLES).map((id, i) => [id, NOMS[i]]));
  for (const x of f) {
    assert.ok(Array.isArray(x.sources) && x.sources.length > 0, `${x.id} : sources`);
    assert.match(x.dateVerif, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('US 100 schéma : given les schémas, when on les lit, then `famille` est une chaîne non vide obligatoire et lure-families a id, nom, sources, dateVerif obligatoires', () => {
  const s = lire('schemas/lure-types.schema.json').items;
  assert.equal(s.properties?.famille?.type, 'string');
  assert.ok(s.properties?.famille?.minLength >= 1);
  assert.ok(s.required.includes('famille'));
  const f = lire('schemas/lure-families.schema.json').items;
  for (const champ of ['id', 'nom', 'sources', 'dateVerif']) assert.ok(f.required.includes(champ), `${champ} obligatoire`);
});

test('US 100 validation : given un type sans `famille`, when on valide le contenu, then la validation échoue', () => {
  const r = valider((l) => delete l[0].famille);
  assert.notEqual(r.status, 0);
});

test('US 100 références : given un type dont la famille n\'est pas un id de lure-families.json, when on valide le contenu, then la validation échoue', () => {
  const r = valider((l) => (l[0].famille = 'inconnue'));
  assert.notEqual(r.status, 0);
  assert.match(r.output, /inconnue/);
});

test('US 100 références : given le contenu réel, when on le valide, then la validation réussit', () => {
  assert.equal(valider(() => {}).status, 0);
});
