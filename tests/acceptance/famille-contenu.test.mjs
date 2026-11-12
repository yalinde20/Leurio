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
  Souples: ['shad', 'ver-finesse', 'creature', 'swimbait', 'shad-silure', 'micro-leurre-souple'],
  Durs: ['crankbait', 'jerkbait-minnow', 'lipless', 'micro-crankbait'],
  Surface: ['stickbait', 'popper', 'frog', 'insecte-surface'],
  Métalliques: ['cuillere-tournante', 'cuillere-ondulante', 'micro-cuillere', 'tailspinner', 'jig-metal'],
  'À jupe': ['jig', 'spinnerbait', 'chatterbait'],
};

test('US 100 contenu : given lure-types.json, when on lit les types, then chacun a une `famille` texte non vide', () => {
  for (const t of lire('src/assets/data/lure-types.json')) {
    assert.ok(typeof t.famille === 'string' && t.famille.trim() !== '', `${t.id} : famille manquante ou vide`);
  }
});

test('US 100 contenu : given lure-types.json, when on lit les familles, then elles suivent l\'affectation validée, dans l\'ordre de première apparition', () => {
  const types = lire('src/assets/data/lure-types.json');
  for (const [famille, ids] of Object.entries(FAMILLES)) {
    for (const id of ids) assert.equal(types.find((t) => t.id === id)?.famille, famille, `${id} doit être « ${famille} »`);
  }
  assert.deepEqual([...new Set(types.map((t) => t.famille))], Object.keys(FAMILLES));
});

test('US 100 schéma : given lure-types.schema.json, when on le lit, then `famille` est une chaîne non vide et obligatoire', () => {
  const s = lire('schemas/lure-types.schema.json').items;
  assert.equal(s.properties?.famille?.type, 'string');
  assert.ok(s.properties?.famille?.minLength >= 1);
  assert.ok(s.required.includes('famille'));
});

test('US 100 validation : given un type sans `famille`, when on valide le contenu, then la validation échoue', () => {
  const r = valider((l) => delete l[0].famille);
  assert.notEqual(r.status, 0);
});
