// US 43 : le contenu réel de lure-types.json (~20 types de leurres) respecte les critères.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const lire = (nom) => JSON.parse(readFileSync(join(ROOT, 'src/assets/data', nom), 'utf8'));
const types = () => lire('lure-types.json');
const codesEspeces = () => lire('species.json').map((e) => e.code);
const idsTechniques = () => lire('techniques.json').map((t) => t.id);
const texte = (v) => typeof v === 'string' && v.trim().length > 0;
const ZONES = ['surface', 'mi-eau', 'fond'];

function exigeVingtaine(liste) {
  assert.ok(liste.length >= 18 && liste.length <= 22, `18 à 22 types attendus, ${liste.length} trouvé(s)`);
}

test('critère 2 : given chaque type de leurre, when on le lit, then il cite au moins une espèce de species.json et une animation de techniques.json, et porte une zone de nage, interditFermetureBrochet, des sources et une dateVerif', () => {
  const liste = types();
  exigeVingtaine(liste);
  const especes = codesEspeces();
  const techniques = idsTechniques();
  for (const t of liste) {
    assert.ok(texte(t.id), 'id manquant');
    assert.ok(Array.isArray(t.especes) && t.especes.length > 0, `${t.id} : especes manquantes`);
    for (const code of t.especes) assert.ok(especes.includes(code), `${t.id} : espèce inconnue "${code}"`);
    assert.ok(Array.isArray(t.techniques) && t.techniques.length > 0, `${t.id} : techniques manquantes`);
    for (const id of t.techniques) assert.ok(techniques.includes(id), `${t.id} : animation inconnue "${id}"`);
    assert.ok(ZONES.includes(t.zoneNage), `${t.id} : zoneNage invalide "${t.zoneNage}"`);
    assert.equal(typeof t.interditFermetureBrochet, 'boolean', `${t.id} : interditFermetureBrochet doit être booléen`);
    assert.ok(Array.isArray(t.sources) && t.sources.length > 0 && t.sources.every(texte), `${t.id} : sources manquantes`);
    assert.match(String(t.dateVerif), /^\d{4}-\d{2}-\d{2}$/, `${t.id} : dateVerif invalide`);
  }
});

test('critère 3 : given chacune des 7 espèces, when on cherche les types qui la citent, then au moins un type la cite', () => {
  const liste = types();
  exigeVingtaine(liste);
  const codes = codesEspeces();
  assert.equal(codes.length, 7, `7 espèces attendues, ${codes.length} trouvée(s)`);
  for (const code of codes) {
    assert.ok(liste.some((t) => Array.isArray(t.especes) && t.especes.includes(code)), `${code} : aucun type ne la cite`);
  }
});

test('critère 4 : given le black-bass (BBG), when on cherche les types qui le citent, then au moins un type a la zone de nage surface', () => {
  const liste = types();
  exigeVingtaine(liste);
  assert.ok(
    liste.some((t) => Array.isArray(t.especes) && t.especes.includes('BBG') && t.zoneNage === 'surface'),
    'aucun type de surface ne cite BBG',
  );
});

test('critère 5 : given le sandre (SAN), when on cherche les types qui le citent, then au moins un est compatible avec la verticale ou la tirée-relâchée', () => {
  const liste = types();
  exigeVingtaine(liste);
  assert.ok(
    liste.some(
      (t) =>
        Array.isArray(t.especes) &&
        t.especes.includes('SAN') &&
        Array.isArray(t.techniques) &&
        (t.techniques.includes('verticale') || t.techniques.includes('tiree-relachee')),
    ),
    'aucun type citant SAN n’est compatible avec verticale ou tiree-relachee',
  );
});

test('critère 6 : given le contenu d’une vingtaine de types, when on lance npm run validate-data, then elle passe', () => {
  exigeVingtaine(types());
  const r = run('npm', ['run', 'validate-data'], 120_000);
  assert.equal(r.status, 0, r.output);
});
