// US 71 : taille (cm) ou poids (g) du leurre lus dans le contenu (PLAN §2.1, §8.3, §7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const lire = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));

/** Copie du contenu réel dans un dossier temporaire, modifié par `mutate(lure)`, puis validé. */
function valider(mutate) {
  const dir = mkdtempSync(join(tmpdir(), `taille-${process.pid}-`));
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

const gammeValide = (g) =>
  Array.isArray(g) && g.length === 2 && g.every((n) => typeof n === 'number' && n > 0) && g[0] < g[1];

test('US 71 critère 1 : given le contenu réel, when on lit les types de leurre, then chacun a exactement une gamme tailleCm ou poidsG avec 0 < min < max', () => {
  for (const t of lire('src/assets/data/lure-types.json')) {
    const a = t.tailleCm !== undefined;
    const b = t.poidsG !== undefined;
    assert.ok(a !== b, `${t.id} doit avoir exactement un champ parmi tailleCm et poidsG`);
    assert.ok(gammeValide(a ? t.tailleCm : t.poidsG), `${t.id} : gamme invalide`);
  }
});

test('US 71 schéma : given lure-types.schema.json, when on le lit, then tailleCm et poidsG sont déclarés, optionnels, de 2 nombres strictement positifs', () => {
  const s = lire('schemas/lure-types.schema.json').items;
  for (const champ of ['tailleCm', 'poidsG']) {
    const p = s.properties[champ];
    assert.ok(p, `${champ} doit être déclaré`);
    assert.equal(p.type, 'array');
    assert.equal(p.minItems, 2);
    assert.equal(p.maxItems, 2);
    const item = p.items;
    assert.equal(item.type, 'number');
    assert.ok(item.exclusiveMinimum === 0 || item.minimum > 0, `${champ} : les bornes doivent être > 0`);
    assert.ok(!s.required.includes(champ), `${champ} est optionnel`);
  }
});

test('US 71 schéma : given un type avec tailleCm seul, when on valide, then le contenu est accepté', () => {
  const s = lire('schemas/lure-types.schema.json').items.properties;
  assert.ok(s.tailleCm && s.poidsG, 'le schéma doit déclarer les deux champs');
  const r = valider((l) => {
    delete l[0].poidsG;
    delete l[0].tailleCm;
    l[0].tailleCm = [5, 10];
  });
  assert.equal(r.status, 0, r.output);
});

test('US 71 schéma : given un type avec poidsG seul, when on valide, then le contenu est accepté', () => {
  const s = lire('schemas/lure-types.schema.json').items.properties;
  assert.ok(s.tailleCm && s.poidsG, 'le schéma doit déclarer les deux champs');
  const r = valider((l) => {
    delete l[0].poidsG;
    delete l[0].tailleCm;
    l[0].poidsG = [5, 10];
  });
  assert.equal(r.status, 0, r.output);
});

test('US 71 schéma : given un type avec tailleCm et poidsG, when on valide, then l’échec nomme lure-types.json', () => {
  const r = valider((l) => { l[0].tailleCm = [5, 10]; l[0].poidsG = [5, 10]; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /lure-types\.json/);
});

for (const [nom, valeur] of [
  ['un seul nombre', [5]],
  ['trois nombres', [5, 8, 10]],
  ['un zéro', [0, 10]],
  ['un négatif', [-1, 10]],
  ['une chaîne', ['5', '10']],
]) {
  test(`US 71 schéma : given tailleCm avec ${nom}, when on valide, then l’échec nomme lure-types.json et tailleCm`, () => {
    const r = valider((l) => { delete l[0].poidsG; l[0].tailleCm = valeur; });
    assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
    assert.match(r.output, /lure-types\.json/);
    assert.match(r.output, /tailleCm/);
  });
}

test('US 71 schéma : given poidsG avec un zéro, when on valide, then l’échec nomme lure-types.json et poidsG', () => {
  const r = valider((l) => { delete l[0].tailleCm; l[0].poidsG = [0, 10]; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /lure-types\.json/);
  assert.match(r.output, /poidsG/);
});
