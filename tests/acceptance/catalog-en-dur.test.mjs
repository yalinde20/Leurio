// US 40, critère 5 : aucune espèce ni aucun type de leurre en dur dans le code de src/app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';

const CODES = ['BRO', 'SAN', 'PER', 'BBG', 'CHE', 'ASP', 'SIL'];

function fichiers(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return fichiers(p);
    return /\.(ts|html|scss)$/.test(e.name) && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
}
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('critère 5 : given le code de src/app, when on cherche un code d\'espèce ou un nom de type de leurre, then aucun n\'apparaît hors des fichiers de contenu et des données de test', () => {
  const types = JSON.parse(readFileSync(join(ROOT, 'src/assets/data/lure-types.json'), 'utf8'));
  const motifs = [
    ...CODES.map((c) => new RegExp(`\\b${c}\\b`)),
    ...types.flatMap((t) => [t.nom, t.id]).map((m) => new RegExp(`(?<![\\p{L}\\p{N}-])${echapper(m)}(?![\\p{L}\\p{N}-])`, 'iu')),
  ];
  const trouves = [];
  for (const f of fichiers(join(ROOT, 'src/app'))) {
    readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
      if (motifs.some((m) => m.test(ligne))) trouves.push(`${f.replace(ROOT, '')}:${i + 1}: ${ligne.trim()}`);
    });
  }
  assert.deepEqual(trouves, [], `Contenu en dur :\n${trouves.join('\n')}`);
});
