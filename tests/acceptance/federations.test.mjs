// US 45 : le contenu réel de federations.json (la fédération de chaque département de métropole) respecte les critères.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const federations = () => JSON.parse(readFileSync(join(ROOT, 'src/assets/data/federations.json'), 'utf8'));
const texte = (v) => typeof v === 'string' && v.trim().length > 0;

// 01..19, 2A, 2B, 21..95 : 96 codes, pas de « 20 ».
const CODES = [
  ...Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, '0')),
  '2A',
  '2B',
  ...Array.from({ length: 75 }, (_, i) => String(i + 21)),
];

function exigeCouverture(liste) {
  assert.equal(CODES.length, 96);
  assert.equal(liste.length, 96, `96 fédérations attendues, ${liste.length} trouvée(s)`);
}

const urlDe = (liste, code) => liste.find((f) => f.departement === code)?.url;

test('critère 1 : given federations.json, when on lit les départements, then les 96 codes de métropole ont chacun une entrée unique avec une url https, sans département d\'outre-mer', () => {
  const liste = federations();
  exigeCouverture(liste);
  const codes = liste.map((f) => f.departement);
  assert.deepEqual([...codes].sort(), [...CODES].sort(), 'les codes doivent être exactement ceux de la métropole (sans 20 ni 971-976)');
  assert.equal(new Set(codes).size, 96, 'un département ne doit apparaître qu\'une fois');
  for (const f of liste) {
    assert.match(String(f.url), /^https:\/\//, `${f.departement} : url https attendue`);
    assert.ok(texte(f.nom), `${f.departement} : nom manquant`);
  }
});

test('critère 1 : given les départements servis par une fédération interdépartementale, when on lit leurs URL, then Paris et la petite couronne pointent vers la même URL, et la Corse aussi', () => {
  const liste = federations();
  exigeCouverture(liste);
  assert.equal(new Set(['75', '92', '93', '94'].map((c) => urlDe(liste, c))).size, 1, '75, 92, 93 et 94 doivent partager une URL');
  assert.equal(urlDe(liste, '2A'), urlDe(liste, '2B'), '2A et 2B doivent partager une URL');
});

test('critère 2 : given chaque entrée de federations.json, when on la lit, then elle porte des sources (non provisoires) et une dateVerif', () => {
  const liste = federations();
  exigeCouverture(liste);
  for (const f of liste) {
    assert.ok(Array.isArray(f.sources) && f.sources.length > 0 && f.sources.every(texte), `${f.departement} : sources manquantes`);
    assert.ok(
      f.sources.every((s) => !/provisoire/i.test(s)),
      `${f.departement} : source provisoire à remplacer`,
    );
    assert.match(String(f.dateVerif), /^\d{4}-\d{2}-\d{2}$/, `${f.departement} : dateVerif invalide`);
  }
});

test('critère 3 : given le contenu de federations.json, when on lance npm run validate-data, then elle passe', () => {
  exigeCouverture(federations());
  const r = run('npm', ['run', 'validate-data'], 120_000);
  assert.equal(r.status, 0, r.output);
});
