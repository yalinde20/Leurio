// US 68 : le classement des couleurs de leurre vient du contenu (PLAN §8.3, §7, §9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const FICHIER = 'src/assets/data/couleurs.json';
const lire = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));

/** Copie du contenu réel dans un dossier temporaire, couleurs modifiées par `mutate(couleurs)` (ou fichier retiré), puis validée. */
function valider(mutate, { retirer = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), `couleurs-${process.pid}-`));
  try {
    const src = join(ROOT, 'src/assets/data');
    for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(join(src, f), join(dir, f));
    if (retirer) rmSync(join(dir, 'couleurs.json'), { force: true });
    else {
      const couleurs = lire(FICHIER);
      mutate(couleurs);
      writeFileSync(join(dir, 'couleurs.json'), JSON.stringify(couleurs, null, 2));
    }
    return run('node', ['scripts/validate-data.ts', dir], 60_000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('US 68 contenu : given le contenu réel, when on lit couleurs.json, then il a au moins une couleur vive et une naturelle', () => {
  assert.ok(existsSync(join(ROOT, FICHIER)), `${FICHIER} est absent`);
  const couleurs = lire(FICHIER);
  assert.ok(couleurs.some((c) => c.classe === 'vive'), 'aucune couleur vive');
  assert.ok(couleurs.some((c) => c.classe === 'naturelle'), 'aucune couleur naturelle');
});

test('US 68 contenu : given le contenu réel, when on lit couleurs.json, then chaque couleur a id, nom, classe valide, sources et dateVerif, et les id sont uniques', () => {
  assert.ok(existsSync(join(ROOT, FICHIER)), `${FICHIER} est absent`);
  const couleurs = lire(FICHIER);
  for (const c of couleurs) {
    assert.ok(c.id && c.nom, 'id et nom requis');
    assert.ok(['vive', 'naturelle'].includes(c.classe), `${c.id} : classe invalide`);
    assert.ok(Array.isArray(c.sources) && c.sources.length > 0, `${c.id} : sources manquantes`);
    assert.match(c.dateVerif ?? '', /^\d{4}-\d{2}-\d{2}$/, `${c.id} : dateVerif manquante`);
  }
  assert.equal(new Set(couleurs.map((c) => c.id)).size, couleurs.length, 'id en double');
});

test('US 68 contenu : given le contenu réel, when on lit la première couleur, then c’est une couleur naturelle (couleur par défaut)', () => {
  assert.ok(existsSync(join(ROOT, FICHIER)), `${FICHIER} est absent`);
  assert.equal(lire(FICHIER)[0].classe, 'naturelle');
});

test('US 68 schéma : given schemas/couleurs.schema.json, when on le lit, then il existe et limite classe à vive ou naturelle', () => {
  const chemin = join(ROOT, 'schemas/couleurs.schema.json');
  assert.ok(existsSync(chemin), 'schemas/couleurs.schema.json est absent');
  const s = JSON.parse(readFileSync(chemin, 'utf8'));
  assert.deepEqual([...s.items.properties.classe.enum].sort(), ['naturelle', 'vive']);
});

test('US 68 validate-data : given le contenu réel, when on valide, then c’est accepté', () => {
  assert.ok(existsSync(join(ROOT, FICHIER)), `${FICHIER} est absent`);
  const r = valider(() => {});
  assert.equal(r.status, 0, r.output);
});

test('US 68 validate-data : given couleurs.json absent, when on valide, then l’échec nomme couleurs.json', () => {
  const r = valider(() => {}, { retirer: true });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /couleurs\.json/);
});

test('US 68 validate-data : given une classe "fluo", when on valide, then l’échec nomme couleurs.json et classe', () => {
  assert.ok(existsSync(join(ROOT, FICHIER)), `${FICHIER} est absent`);
  const r = valider((c) => { c[0].classe = 'fluo'; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /couleurs\.json/);
  assert.match(r.output, /classe/);
});

test('US 68 validate-data : given deux couleurs de même id, when on valide, then l’échec nomme couleurs.json, doublon et l’id', () => {
  assert.ok(existsSync(join(ROOT, FICHIER)), `${FICHIER} est absent`);
  let id;
  const r = valider((c) => { id = c[0].id; c.push({ ...c[0], nom: 'Autre nom' }); });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /couleurs\.json/);
  assert.match(r.output, /doublon/);
  assert.ok(r.output.includes(id), `l’id ${id} devrait être nommé :\n${r.output}`);
});

test('US 68 validate-data : given une couleur sans sources, when on valide, then l’échec nomme couleurs.json et sources', () => {
  assert.ok(existsSync(join(ROOT, FICHIER)), `${FICHIER} est absent`);
  const r = valider((c) => { delete c[0].sources; });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /couleurs\.json/);
  assert.match(r.output, /sources/);
});

test('US 68 validate-data : given un couleurs.json sans couleur vive, when on valide, then l’échec nomme couleurs.json et vive', () => {
  const r = valider((c) => { c.splice(0, c.length, ...c.filter((x) => x.classe !== 'vive')); });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /couleurs\.json/);
  assert.match(r.output, /vive/);
});

test('US 68 validate-data : given un couleurs.json sans couleur naturelle, when on valide, then l’échec nomme couleurs.json et naturelle', () => {
  const r = valider((c) => { c.splice(0, c.length, ...c.filter((x) => x.classe !== 'naturelle')); });
  assert.notEqual(r.status, 0, 'la validation aurait dû échouer');
  assert.match(r.output, /couleurs\.json/);
  assert.match(r.output, /naturelle/);
});
