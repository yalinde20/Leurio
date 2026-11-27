// US 67 : les saisons favorables sont lues dans le contenu (PLAN §8.3, §7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';
import { creerDossierDonnees, supprimerDossierDonnees } from '../helpers/dossier-donnees.mjs';

const lire = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const SAISONS = ['hiver', 'printemps', 'été', 'automne'];

/** Copie du contenu réel dans un dossier temporaire, modifié par `mutate(fichiers)`, puis validé. */
function valider(mutate) {
  const dir = creerDossierDonnees(`saison-${process.pid}-`);
  try {
    const src = join(ROOT, 'src/assets/data');
    for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(join(src, f), join(dir, f));
    const fichiers = {
      lure: lire('src/assets/data/lure-types.json'),
      tech: lire('src/assets/data/techniques.json'),
    };
    mutate(fichiers);
    writeFileSync(join(dir, 'lure-types.json'), JSON.stringify(fichiers.lure, null, 2));
    writeFileSync(join(dir, 'techniques.json'), JSON.stringify(fichiers.tech, null, 2));
    return run('node', ['scripts/validate-data.ts', dir], 60_000);
  } finally {
    supprimerDossierDonnees(dir);
  }
}

test('US 67 critère 1 : given le contenu réel, when on lit verticale et tiree-relachee, then elles sont favorables à l’hiver', () => {
  const tech = lire('src/assets/data/techniques.json');
  for (const id of ['verticale', 'tiree-relachee']) {
    const a = tech.find((x) => x.id === id);
    assert.ok(a, `${id} absente de techniques.json`);
    assert.ok(Array.isArray(a.saisons) && a.saisons.includes('hiver'), `${id} doit lister "hiver" dans saisons`);
  }
});

test('US 67 contenu : given le contenu réel, when on lit les saisons, then elles sont toutes valides et sans doublon', () => {
  const tout = [...lire('src/assets/data/techniques.json'), ...lire('src/assets/data/lure-types.json')];
  for (const f of tout) {
    if (f.saisons === undefined) continue;
    assert.ok(f.saisons.every((s) => SAISONS.includes(s)), `${f.id} : saison inconnue`);
    assert.equal(new Set(f.saisons).size, f.saisons.length, `${f.id} : saison en double`);
  }
});

for (const [fichier, cle] of [['schemas/techniques.schema.json', 'tech'], ['schemas/lure-types.schema.json', 'lure']]) {
  test(`US 67 schéma : given ${fichier}, when on le lit, then il déclare saisons (tableau unique des quatre saisons)`, () => {
    const s = lire(fichier).items.properties.saisons;
    assert.ok(s, 'saisons doit être déclaré');
    assert.equal(s.type, 'array');
    assert.equal(s.uniqueItems, true);
    assert.deepEqual([...s.items.enum].sort(), [...SAISONS].sort());
    assert.ok(!lire(fichier).items.required.includes('saisons'), 'saisons est optionnel');
    assert.ok(cle);
  });
}

test('US 67 schéma : given un type de leurre et une animation avec des saisons valides, when on valide, then c’est accepté', () => {
  const r = valider((f) => {
    f.lure[0].saisons = ['hiver', 'automne'];
    f.tech[0].saisons = ['printemps'];
  });
  assert.equal(r.status, 0, r.output);
});

test('US 67 schéma : given une animation avec la saison "mousson", when on valide, then l’échec nomme techniques.json et saisons', () => {
  const r = valider((f) => { f.tech[0].saisons = ['mousson']; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /techniques\.json/);
  assert.match(r.output, /saisons/);
});

test('US 67 schéma : given un type de leurre avec la saison "mousson", when on valide, then l’échec nomme lure-types.json et saisons', () => {
  const r = valider((f) => { f.lure[0].saisons = ['mousson']; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /lure-types\.json/);
  assert.match(r.output, /saisons/);
});

test('US 67 schéma : given un type de leurre avec une saison en double, when on valide, then l’échec nomme lure-types.json et saisons', () => {
  const r = valider((f) => { f.lure[0].saisons = ['hiver', 'hiver']; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /lure-types\.json/);
  assert.match(r.output, /saisons/);
});
