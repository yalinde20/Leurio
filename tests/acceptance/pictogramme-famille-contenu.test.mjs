// US 293 : un pictogramme SVG par famille de leurres, lu depuis le contenu (PLAN §3, §7, §9 ; règle plan.md « Contenu »).
// Contrat imposé aux tests (le développeur reste libre du dossier des SVG) :
//  - chaque famille de lure-families.json porte un champ `pictogramme` : chemin du SVG relatif à `src/assets/`
//    (ex. « pictogrammes/souples.svg ») ;
//  - `validate-data` résout ce chemin depuis le dossier parent du dossier de données passé en argument
//    (src/assets/data -> src/assets), et échoue en nommant la famille si le champ manque ou si le fichier est absent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const ASSETS = join(ROOT, 'src/assets');
const familles = () => JSON.parse(readFileSync(join(ASSETS, 'data/lure-families.json'), 'utf8'));

/** Copie temporaire de assets/data (+ les SVG référencés qui existent), famille modifiée par `mutate`, puis validate-data. */
function valider(mutate) {
  const racine = mkdtempSync(join(tmpdir(), `pictogramme-${process.pid}-`));
  try {
    const data = join(racine, 'assets', 'data');
    mkdirSync(data, { recursive: true });
    for (const f of readdirSync(join(ASSETS, 'data'))) if (f.endsWith('.json')) cpSync(join(ASSETS, 'data', f), join(data, f));
    const liste = familles();
    for (const f of liste) {
      if (typeof f.pictogramme === 'string' && existsSync(join(ASSETS, f.pictogramme))) {
        mkdirSync(dirname(join(racine, 'assets', f.pictogramme)), { recursive: true });
        cpSync(join(ASSETS, f.pictogramme), join(racine, 'assets', f.pictogramme));
      }
    }
    mutate(liste, racine);
    writeFileSync(join(data, 'lure-families.json'), JSON.stringify(liste, null, 2));
    return run('node', ['scripts/validate-data.ts', data], 60_000);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

test('US 293 critère 0 : given lure-families.json, when on lance la validation du contenu, then chaque famille référence un pictogramme SVG qui existe dans les assets', () => {
  const liste = familles();
  assert.ok(liste.length >= 5, 'les familles existent');
  for (const f of liste) {
    assert.ok(typeof f.pictogramme === 'string' && f.pictogramme.endsWith('.svg'), `${f.id} : champ « pictogramme » (chemin .svg) manquant`);
    assert.ok(existsSync(join(ASSETS, f.pictogramme)), `${f.id} : ${f.pictogramme} est absent de src/assets`);
    assert.match(readFileSync(join(ASSETS, f.pictogramme), 'utf8'), /<svg[\s>]/, `${f.id} : ${f.pictogramme} n'est pas un SVG`);
  }
  const r = run('npm', ['run', '--silent', 'validate-data'], 60_000);
  assert.equal(r.status, 0, r.output);
});

test('US 293 critère 1 : given une famille sans pictogramme, when on lance la validation du contenu, then la validation échoue en nommant la famille', () => {
  assert.ok(familles().every((f) => typeof f.pictogramme === 'string'), 'précondition : le contenu réel référence un pictogramme par famille');
  const r = valider((liste) => delete liste.find((f) => f.id === 'surface').pictogramme);
  assert.notEqual(r.status, 0, r.output);
  assert.match(r.output, /surface/i, r.output);
  assert.match(r.output, /pictogramme/i, r.output);
});

test('US 293 critère 1 : given une famille dont le fichier de pictogramme est absent, when on lance la validation du contenu, then la validation échoue en nommant la famille et le fichier', () => {
  assert.ok(familles().every((f) => typeof f.pictogramme === 'string'), 'précondition : le contenu réel référence un pictogramme par famille');
  const r = valider((liste) => (liste.find((f) => f.id === 'durs').pictogramme = 'pictogrammes/inexistant-us293.svg'));
  assert.notEqual(r.status, 0, r.output);
  assert.match(r.output, /durs/i, r.output);
  assert.match(r.output, /inexistant-us293\.svg/, r.output);
});

test('US 293 critère 1 : given un pictogramme qui est un dossier ou un fichier sans <svg, when on lance la validation du contenu, then la validation échoue en nommant la famille et le fichier', () => {
  for (const [id, fichier, ecrire] of [
    ['durs', 'pictogrammes/dossier-us293.svg', (chemin) => mkdirSync(chemin, { recursive: true })],
    ['surface', 'pictogrammes/texte-us293.svg', (chemin) => (mkdirSync(dirname(chemin), { recursive: true }), writeFileSync(chemin, 'pas un dessin'))],
  ]) {
    const r = valider((liste, racine) => {
      liste.find((f) => f.id === id).pictogramme = fichier;
      ecrire(join(racine, 'assets', fichier));
    });
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, new RegExp(`${id}.*${fichier.replace('.', '\\.')}.*SVG`, 'is'), r.output);
  }
});
