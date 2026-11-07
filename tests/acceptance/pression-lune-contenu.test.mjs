// US 70 : seuil de pression et phases de lune viennent du contenu (PLAN §8.3, §7, §9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const FICHIER = 'src/assets/data/engine-weights.json';
const PHASES = [
  'Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Gibbeuse croissante',
  'Pleine lune', 'Gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant',
];
const lire = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));

/** Copie du contenu réel dans un dossier temporaire, poids modifiés par `mutate(poids)`, puis validée. */
function valider(mutate) {
  // Le rejet doit venir d'une propriété déclarée dans le schéma, pas du simple « additionalProperties: number ».
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas/engine-weights.schema.json'), 'utf8'));
  assert.ok(schema.properties?.seuilPression && schema.properties?.phasesLuneBonus, 'le schéma ne déclare pas seuilPression et phasesLuneBonus');
  const dir = mkdtempSync(join(tmpdir(), `poids-${process.pid}-`));
  try {
    const src = join(ROOT, 'src/assets/data');
    for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(join(src, f), join(dir, f));
    const poids = lire(FICHIER);
    mutate(poids);
    writeFileSync(join(dir, 'engine-weights.json'), JSON.stringify(poids, null, 2));
    return run('node', ['scripts/validate-data.ts', dir], 60_000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('US 70 contenu : given engine-weights.json, when on le lit, then seuilPression vaut 5 hPa', () => {
  assert.equal(lire(FICHIER).seuilPression, 5);
});

test('US 70 contenu : given engine-weights.json, when on le lit, then phasesLuneBonus vaut Nouvelle lune et Pleine lune', () => {
  assert.deepEqual(lire(FICHIER).phasesLuneBonus, ['Nouvelle lune', 'Pleine lune']);
});

test('US 70 schéma : given engine-weights.schema.json, when on le lit, then seuilPression (nombre > 0) et phasesLuneBonus (tableau des 8 phases) sont des propriétés explicites', () => {
  const s = JSON.parse(readFileSync(join(ROOT, 'schemas/engine-weights.schema.json'), 'utf8'));
  const seuil = s.properties?.seuilPression;
  assert.ok(seuil, 'seuilPression absent des properties du schéma');
  assert.equal(seuil.type, 'number');
  assert.ok(seuil.exclusiveMinimum === 0 || seuil.minimum > 0, 'seuilPression doit être > 0');
  const phases = s.properties?.phasesLuneBonus;
  assert.ok(phases, 'phasesLuneBonus absent des properties du schéma');
  assert.equal(phases.type, 'array');
  assert.deepEqual([...(phases.items?.enum ?? [])].sort(), [...PHASES].sort());
});

test('US 70 validate-data : given le contenu réel, when on valide, then c’est accepté', () => {
  const r = valider(() => {});
  assert.equal(r.status, 0, r.output);
});

test('US 70 validate-data : given un seuilPression de 0, when on valide, then l’échec nomme engine-weights.json et seuilPression', () => {
  const r = valider((p) => { p.seuilPression = 0; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /engine-weights\.json/);
  assert.match(r.output, /seuilPression/);
});

test('US 70 validate-data : given un seuilPression qui n’est pas un nombre, when on valide, then l’échec nomme engine-weights.json et seuilPression', () => {
  const r = valider((p) => { p.seuilPression = 'cinq'; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /engine-weights\.json/);
  assert.match(r.output, /seuilPression/);
});

test('US 70 validate-data : given une phase de lune inconnue dans phasesLuneBonus, when on valide, then l’échec nomme engine-weights.json et phasesLuneBonus', () => {
  const r = valider((p) => { p.phasesLuneBonus = ['Lune rousse']; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /engine-weights\.json/);
  assert.match(r.output, /phasesLuneBonus/);
});

test('US 70 validate-data : given un phasesLuneBonus qui n’est pas un tableau, when on valide, then l’échec nomme engine-weights.json et phasesLuneBonus', () => {
  const r = valider((p) => { p.phasesLuneBonus = 'Pleine lune'; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /engine-weights\.json/);
  assert.match(r.output, /phasesLuneBonus/);
});
