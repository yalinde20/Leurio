// US 44 : le contenu réel de starter-kit.json (les 5 leurres à acheter en premier) respecte les critères.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const lire = (nom) => JSON.parse(readFileSync(join(ROOT, 'src/assets/data', nom), 'utf8'));
const kit = () => lire('starter-kit.json');
const idsTypes = () => lire('lure-types.json').map((t) => t.id);
const texte = (v) => typeof v === 'string' && v.trim().length > 0;

function exigeCinq(liste) {
  assert.equal(liste.length, 5, `5 leurres attendus, ${liste.length} trouvé(s)`);
}

test('critère 1 : given starter-kit.json, when on le lit, then il contient exactement 5 leurres distincts', () => {
  const liste = kit();
  exigeCinq(liste);
  assert.equal(new Set(liste.map((l) => l.typeId)).size, 5, 'les 5 typeId doivent être distincts');
});

test('critère 2 : given chaque leurre du kit, when on le lit, then il cite un type de lure-types.json et porte des sources et une dateVerif', () => {
  const liste = kit();
  exigeCinq(liste);
  const ids = idsTypes();
  for (const l of liste) {
    assert.ok(texte(l.typeId) && ids.includes(l.typeId), `typeId inconnu "${l.typeId}"`);
    assert.ok(Array.isArray(l.sources) && l.sources.length > 0 && l.sources.every(texte), `${l.typeId} : sources manquantes`);
    assert.ok(
      l.sources.every((s) => !/provisoire/i.test(s)),
      `${l.typeId} : source provisoire à remplacer`,
    );
    assert.match(String(l.dateVerif), /^\d{4}-\d{2}-\d{2}$/, `${l.typeId} : dateVerif invalide`);
  }
});

test('critère 3 : given le contenu du kit de départ, when on lance npm run validate-data, then elle passe', () => {
  exigeCinq(kit());
  const r = run('npm', ['run', 'validate-data'], 120_000);
  assert.equal(r.status, 0, r.output);
});
