// US 46 : les poids initiaux du moteur (engine-weights.json, PLAN §8) respectent les critères.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const DATA = join(ROOT, 'src/assets/data');
const poids = () => JSON.parse(readFileSync(join(DATA, 'engine-weights.json'), 'utf8'));
const FACTEURS = ['temperature', 'saison', 'clarte', 'luminosite', 'pression', 'lune'];

/** Lance validate-data sur une copie du contenu dont engine-weights.json est modifié. */
function validerAvec(modif) {
  const dir = mkdtempSync(join(tmpdir(), `engine-weights-${process.pid}-${Math.random().toString(36).slice(2)}-`));
  try {
    cpSync(DATA, dir, { recursive: true });
    writeFileSync(join(dir, 'engine-weights.json'), JSON.stringify({ ...poids(), ...modif }));
    return run('node', ['scripts/validate-data.ts', dir], 120_000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('critère 1 : given engine-weights.json, when on compare les poids, then température est plus grand que saison et clarté, qui sont égaux', () => {
  const w = poids();
  assert.ok(w.temperature > w.saison, `temperature (${w.temperature}) doit dépasser saison (${w.saison})`);
  assert.equal(w.saison, w.clarte, `saison (${w.saison}) et clarte (${w.clarte}) doivent être égaux`);
  for (const f of FACTEURS) assert.ok(w[f] > 0, `${f} doit être strictement positif`);
});

test('critère 2 : given engine-weights.json, when on compare les poids, then saison est plus grand que luminosité et pression, qui sont égaux', () => {
  const w = poids();
  assert.ok(w.saison > w.luminosite, `saison (${w.saison}) doit dépasser luminosite (${w.luminosite})`);
  assert.equal(w.luminosite, w.pression, 'luminosite et pression doivent être égaux');
});

test('critère 3 : given engine-weights.json, when on lit le poids de la lune, then il est positif et sert de bonus seulement (petit, jamais négatif)', () => {
  const w = poids();
  assert.ok(w.lune > 0, `lune (${w.lune}) doit être strictement positif`);
  assert.ok(w.lune < w.luminosite && w.lune < w.pression, `lune (${w.lune}) doit être plus petit que les poids faibles`);
});

test('critère 3 : given un poids de lune nul ou négatif, when on lance validate-data, then elle échoue', () => {
  for (const lune of [0, -0.5]) {
    const r = validerAvec({ lune });
    assert.notEqual(r.status, 0, `lune = ${lune} devrait être refusé\n${r.output}`);
    assert.match(r.output, /lune/);
  }
});

test('critère 4 : given engine-weights.json, when on lit la pénalité de difficulté, then elle est définie et réduit le score (négative)', () => {
  const w = poids();
  assert.equal(typeof w.penaliteDifficulte, 'number', 'penaliteDifficulte doit être définie');
  assert.ok(w.penaliteDifficulte < 0, `penaliteDifficulte (${w.penaliteDifficulte}) doit être strictement négative`);
});

test('critère 4 : given une pénalité de difficulté nulle ou positive, when on lance validate-data, then elle échoue', () => {
  for (const penaliteDifficulte of [0, 1]) {
    const r = validerAvec({ penaliteDifficulte });
    assert.notEqual(r.status, 0, `penaliteDifficulte = ${penaliteDifficulte} devrait être refusée\n${r.output}`);
    assert.match(r.output, /penaliteDifficulte/);
  }
});

test('critère 5 : given le contenu, when on lance npm run validate-data, then elle passe', () => {
  const r = run('npm', ['run', 'validate-data'], 120_000);
  assert.equal(r.status, 0, r.output);
});
