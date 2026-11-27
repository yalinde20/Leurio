// US 69 : la faible lumière et le seuil de ciel couvert sont lus dans le contenu (PLAN §8.3, §7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';
import { creerDossierDonnees, supprimerDossierDonnees } from '../helpers/dossier-donnees.mjs';

const lire = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const SURFACE = ['stickbait', 'popper', 'frog', 'insecte-surface'];

/** Copie du contenu réel dans un dossier temporaire, modifié par `mutate(fichiers)`, puis validé. */
function valider(mutate) {
  const dir = creerDossierDonnees(`luminosite-${process.pid}-`);
  try {
    const src = join(ROOT, 'src/assets/data');
    for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(join(src, f), join(dir, f));
    const fichiers = {
      lure: lire('src/assets/data/lure-types.json'),
      poids: lire('src/assets/data/engine-weights.json'),
    };
    mutate(fichiers);
    writeFileSync(join(dir, 'lure-types.json'), JSON.stringify(fichiers.lure, null, 2));
    writeFileSync(join(dir, 'engine-weights.json'), JSON.stringify(fichiers.poids, null, 2));
    return run('node', ['scripts/validate-data.ts', dir], 60_000);
  } finally {
    supprimerDossierDonnees(dir);
  }
}

test('US 69 critère 1 : given le contenu réel, when on lit les types de surface, then ils sont adaptés à la faible lumière et eux seuls', () => {
  const types = lire('src/assets/data/lure-types.json');
  for (const id of SURFACE) {
    const t = types.find((x) => x.id === id);
    assert.ok(t, `${id} absent de lure-types.json`);
    assert.equal(t.faibleLumiere, true, `${id} doit avoir faibleLumiere: true`);
  }
  for (const t of types.filter((x) => !SURFACE.includes(x.id))) {
    assert.notEqual(t.faibleLumiere, true, `${t.id} ne doit pas être adapté à la faible lumière`);
  }
});

test('US 69 critère 2 : given le contenu réel, when on lit engine-weights.json, then seuilCielCouvert vaut 70', () => {
  assert.equal(lire('src/assets/data/engine-weights.json').seuilCielCouvert, 70);
});

test('US 69 schéma : given lure-types.schema.json, when on le lit, then faibleLumiere est un booléen optionnel', () => {
  const s = lire('schemas/lure-types.schema.json').items;
  assert.equal(s.properties.faibleLumiere?.type, 'boolean');
  assert.ok(!s.required.includes('faibleLumiere'), 'faibleLumiere est optionnel');
});

test('US 69 schéma : given engine-weights.schema.json, when on le lit, then seuilCielCouvert est un nombre de 0 à 100', () => {
  const p = lire('schemas/engine-weights.schema.json').properties.seuilCielCouvert;
  assert.ok(p, 'seuilCielCouvert doit être déclaré');
  assert.equal(p.type, 'number');
  assert.equal(p.minimum, 0);
  assert.equal(p.maximum, 100);
});

test('US 69 schéma : given un seuil de 101, when on valide, then l’échec nomme engine-weights.json et seuilCielCouvert', () => {
  const r = valider((f) => { f.poids.seuilCielCouvert = 101; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /engine-weights\.json/);
  assert.match(r.output, /seuilCielCouvert/);
});

test('US 69 schéma : given un seuil de -1, when on valide, then l’échec nomme engine-weights.json et seuilCielCouvert', () => {
  const r = valider((f) => { f.poids.seuilCielCouvert = -1; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /engine-weights\.json/);
  assert.match(r.output, /seuilCielCouvert/);
});

test('US 69 schéma : given faibleLumiere valant "oui", when on valide, then l’échec nomme lure-types.json et faibleLumiere', () => {
  const r = valider((f) => { f.lure[0].faibleLumiere = 'oui'; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /lure-types\.json/);
  assert.match(r.output, /faibleLumiere/);
});
