// US 75 : le champ verifDepartementPrintemps des fiches espèces (PLAN §6, §7). Vrai pour le black-bass seul.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const lire = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));

/** Copie du contenu réel dans un dossier temporaire, avec species.json modifié par `mutate`, puis validé. */
function valider(mutate) {
  const dir = mkdtempSync(join(tmpdir(), `verif-dep-${process.pid}-`));
  try {
    const src = join(ROOT, 'src/assets/data');
    for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(join(src, f), join(dir, f));
    const especes = lire('src/assets/data/species.json');
    mutate(especes);
    writeFileSync(join(dir, 'species.json'), JSON.stringify(especes, null, 2));
    return run('node', ['scripts/validate-data.ts', dir], 60_000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('given le schéma des espèces, when on lit ses champs, then verifDepartementPrintemps est un booléen obligatoire', () => {
  const item = lire('schemas/species.schema.json').items;
  assert.equal(item.properties.verifDepartementPrintemps?.type, 'boolean');
  assert.ok(item.required.includes('verifDepartementPrintemps'));
});

test('given species.json, when on lit verifDepartementPrintemps, then il vaut vrai pour BBG seul et faux pour les 6 autres espèces', () => {
  const especes = lire('src/assets/data/species.json');
  assert.equal(especes.length, 7);
  for (const e of especes) {
    assert.equal(e.verifDepartementPrintemps, e.code === 'BBG', `verifDepartementPrintemps de ${e.code}`);
  }
});

test('given le texte libre fermetureSpecifique du black-bass, when on lit sa fiche, then il reste renseigné', () => {
  const bbg = lire('src/assets/data/species.json').find((e) => e.code === 'BBG');
  assert.equal(typeof bbg.fermetureSpecifique, 'string');
  assert.ok(bbg.fermetureSpecifique.length > 0);
});

test('given une espèce sans verifDepartementPrintemps, when on lance la validation, then elle échoue', () => {
  const r = valider((especes) => { delete especes[0].verifDepartementPrintemps; });
  assert.notEqual(r.status, 0, r.output);
});

test('given une espèce avec verifDepartementPrintemps non booléen, when on lance la validation, then elle échoue', () => {
  const r = valider((especes) => { especes[0].verifDepartementPrintemps = 'oui'; });
  assert.notEqual(r.status, 0, r.output);
});
