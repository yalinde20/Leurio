// US 86 : poids de tête (poidsTeteG) des leurres souples montés sur tête plombée, lu dans le contenu (PLAN §3, §8.3, §7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';
import { creerDossierDonnees, supprimerDossierDonnees } from '../helpers/dossier-donnees.mjs';

const lire = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const AVEC_TETE = ['shad', 'creature', 'shad-silure', 'micro-leurre-souple', 'ver-finesse'];

/** Copie du contenu réel dans un dossier temporaire, modifié par `mutate(lures)`, puis validé. */
function valider(mutate) {
  const dir = creerDossierDonnees(`poids-tete-${process.pid}-`);
  try {
    const src = join(ROOT, 'src/assets/data');
    for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(join(src, f), join(dir, f));
    const lures = lire('src/assets/data/lure-types.json');
    mutate(lures);
    writeFileSync(join(dir, 'lure-types.json'), JSON.stringify(lures, null, 2));
    return run('node', ['scripts/validate-data.ts', dir], 60_000);
  } finally {
    supprimerDossierDonnees(dir);
  }
}

test('US 86 contenu : given le contenu réel, when on lit les types de leurre, then seuls shad, creature, shad-silure, micro-leurre-souple et ver-finesse ont un poidsTeteG [min, max] avec 0 < min < max', () => {
  for (const t of lire('src/assets/data/lure-types.json')) {
    if (AVEC_TETE.includes(t.id)) {
      assert.ok(
        Array.isArray(t.poidsTeteG) && t.poidsTeteG.length === 2 && t.poidsTeteG.every((n) => typeof n === 'number' && n > 0) && t.poidsTeteG[0] < t.poidsTeteG[1],
        `${t.id} doit avoir un poidsTeteG valide`,
      );
    } else {
      assert.equal(t.poidsTeteG, undefined, `${t.id} ne doit pas avoir de poidsTeteG`);
    }
  }
});

test('US 86 schéma : given lure-types.schema.json, when on le lit, then poidsTeteG est déclaré, optionnel, de 2 nombres strictement positifs', () => {
  const s = lire('schemas/lure-types.schema.json').items;
  const p = s.properties.poidsTeteG;
  assert.ok(p, 'poidsTeteG doit être déclaré');
  assert.equal(p.type, 'array');
  assert.equal(p.minItems, 2);
  assert.equal(p.maxItems, 2);
  assert.equal(p.items.type, 'number');
  assert.ok(p.items.exclusiveMinimum === 0 || p.items.minimum > 0, 'bornes > 0');
  assert.ok(!s.required.includes('poidsTeteG'), 'poidsTeteG est optionnel');
});

test('US 86 schéma : given le contenu réel, when on lance validate-data, then il passe', () => {
  const r = valider(() => undefined);
  assert.equal(r.status, 0, r.output);
});

test('US 86 schéma : given un type avec tailleCm et poidsTeteG, when on valide, then le contenu est accepté', () => {
  assert.ok(lire('schemas/lure-types.schema.json').items.properties.poidsTeteG, 'poidsTeteG doit être déclaré');
  const r = valider((l) => {
    const shad = l.find((t) => t.id === 'shad');
    shad.poidsTeteG = [3, 12];
  });
  assert.equal(r.status, 0, r.output);
});

for (const [nom, valeur] of [
  ['un seul nombre', [5]],
  ['trois nombres', [5, 8, 10]],
  ['un zéro', [0, 10]],
  ['un négatif', [-1, 10]],
  ['une chaîne', ['5', '10']],
]) {
  test(`US 86 schéma : given poidsTeteG avec ${nom}, when on valide, then l’échec nomme lure-types.json et poidsTeteG`, () => {
    assert.ok(lire('schemas/lure-types.schema.json').items.properties.poidsTeteG, 'poidsTeteG doit être déclaré');
    const r = valider((l) => { l.find((t) => t.id === 'shad').poidsTeteG = valeur; });
    assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
    assert.match(r.output, /lure-types\.json/);
    assert.match(r.output, /poidsTeteG/);
  });
}

test('US 86 schéma : given un poidsTeteG dont le minimum n’est pas inférieur au maximum, when on valide, then l’échec nomme lure-types.json et poidsTeteG', () => {
  for (const valeur of [[10, 5], [8, 8]]) {
    const r = valider((l) => { l.find((t) => t.id === 'shad').poidsTeteG = valeur; });
    assert.notEqual(r.status, 0, `la validation de ${JSON.stringify(valeur)} aurait dû échouer`);
    assert.match(r.output, /lure-types\.json/);
    assert.match(r.output, /poidsTeteG/);
  }
});
