import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';
import { lireThemes, contraste } from '../helpers/contrast.mjs';

// US 292, critère 2 : les valeurs sont lues dans src/theme/tokens.scss, jamais écrites ici.
const TEXTE_COURANT = [
  ['--lr-texte', '--lr-fond'], ['--lr-texte', '--lr-surface'],
  ['--lr-texte-secondaire', '--lr-fond'], ['--lr-texte-secondaire', '--lr-surface'],
  ['--lr-primaire', '--lr-fond'], ['--lr-primaire', '--lr-surface'],
  ['--lr-ok', '--lr-fond'], ['--lr-ok', '--lr-surface'],
  ['--lr-attention', '--lr-fond'], ['--lr-attention', '--lr-surface'],
  ['--lr-danger', '--lr-fond'], ['--lr-danger', '--lr-surface'],
  ['--lr-sur-primaire', '--lr-primaire'],
  ['--lr-sur-accent', '--lr-accent'],
  ['--lr-sur-bandeau', '--lr-bandeau'],
];
// Grands chiffres et icônes : 3:1.
// --lr-accent est décoratif (jamais une icône ni un texte) : la couleur d'action --lr-primaire porte les icônes.
const GRANDS_ELEMENTS = [['--lr-trait', '--lr-fond'], ['--lr-trait', '--lr-surface'], ['--lr-primaire', '--lr-fond'], ['--lr-primaire', '--lr-surface']];

for (const theme of ['clair', 'sombre']) {
  test(`US 292 critère 2 : given chaque couple texte/fond de texte courant, when on calcule leur contraste en thème ${theme}, then il est d'au moins 4,5:1`, () => {
    const t = lireThemes()[theme];
    const echecs = [];
    for (const [avant, fond] of TEXTE_COURANT) {
      if (!t[avant] || !t[fond]) { echecs.push(`${avant} sur ${fond} : token absent du thème ${theme}`); continue; }
      const c = contraste(t[avant], t[fond]);
      if (c < 4.5) echecs.push(`${avant} ${t[avant]} sur ${fond} ${t[fond]} : ${c.toFixed(2)}:1 < 4,5:1`);
    }
    assert.deepEqual(echecs, []);
  });

  test(`US 292 critère 2 : given les couples des grands chiffres et des icônes, when on calcule leur contraste en thème ${theme}, then il est d'au moins 3:1`, () => {
    const t = lireThemes()[theme];
    const echecs = [];
    for (const [avant, fond] of GRANDS_ELEMENTS) {
      if (!t[avant] || !t[fond]) { echecs.push(`${avant} sur ${fond} : token absent du thème ${theme}`); continue; }
      const c = contraste(t[avant], t[fond]);
      if (c < 3) echecs.push(`${avant} ${t[avant]} sur ${fond} ${t[fond]} : ${c.toFixed(2)}:1 < 3:1`);
    }
    assert.deepEqual(echecs, []);
  });
}

test('US 292 critères 0 et 1 : given tokens.scss, when on le compile, then les tokens --lr-trait, --lr-ok, --lr-attention existent dans les deux thèmes', () => {
  const { clair, sombre } = lireThemes();
  for (const n of ['--lr-trait', '--lr-ok', '--lr-attention']) {
    assert.ok(clair[n], `${n} absent du thème clair`);
    assert.ok(sombre[n], `${n} absent du thème sombre`);
  }
});

function sources(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = join(dossier, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|html|scss)$/.test(e.name) && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
}

// Décision du propriétaire du 27/11/2026 (US 293) : l'accent est réservé au point des pictogrammes de famille.
// Seule exception : la règle `fill: var(--lr-accent)` dont le sélecteur cible `[data-point]`, dans ce composant.
const COMPOSANT_PICTOGRAMME = 'src/app/shared/pictogramme-famille/pictogramme-famille.component.ts';

/** Utilisations de --lr-accent en color, stroke ou fill dans `src`, hors l'exception du point des pictogrammes. */
function usagesAccentInterdits(src, chemin) {
  const fautifs = [];
  for (const m of src.matchAll(/(?:^|[;{\s])(color|stroke|fill)\s*:\s*[^;}]*var\(\s*--lr-accent\b/g)) {
    const avant = src.slice(0, m.index + m[0].indexOf(m[1]));
    const ouverture = avant.lastIndexOf('{');
    const debut = Math.max(avant.lastIndexOf('}', ouverture), avant.lastIndexOf('{', ouverture - 1), avant.lastIndexOf('`', ouverture)) + 1;
    const selecteur = avant.slice(debut, ouverture);
    if (chemin === COMPOSANT_PICTOGRAMME && m[1] === 'fill' && selecteur.includes('[data-point]')) continue;
    fautifs.push(`${chemin} : ${m[1]}`);
  }
  return fautifs;
}

test('US 292 critère 2 : given le code de l\'app, when on cherche --lr-accent, then il n\'est jamais utilisé pour une couleur de texte, d\'icône (color, stroke, fill)', () => {
  const fautifs = [];
  for (const f of sources(join(ROOT, 'src/app'))) fautifs.push(...usagesAccentInterdits(readFileSync(f, 'utf8'), f.slice(ROOT.length + 1)));
  assert.deepEqual(fautifs, []);
});

test('US 292 critère 2 : given l\'exception du point des pictogrammes, when on cherche --lr-accent, then elle reste étroite', () => {
  const point = 'svg [data-point] {\n  fill: var(--lr-accent);\n  stroke: none;\n}';
  assert.deepEqual(usagesAccentInterdits(point, COMPOSANT_PICTOGRAMME), []);
  assert.deepEqual(usagesAccentInterdits(point, 'src/app/autre.ts'), ['src/app/autre.ts : fill']);
  assert.deepEqual(usagesAccentInterdits(`${point}\n.titre {\n  color: var(--lr-accent);\n}`, COMPOSANT_PICTOGRAMME), [`${COMPOSANT_PICTOGRAMME} : color`]);
  assert.deepEqual(usagesAccentInterdits('svg {\n  fill: var(--lr-accent);\n}', COMPOSANT_PICTOGRAMME), [`${COMPOSANT_PICTOGRAMME} : fill`]);
  assert.deepEqual(usagesAccentInterdits('svg [data-point] {\n  stroke: var(--lr-accent);\n}', COMPOSANT_PICTOGRAMME), [`${COMPOSANT_PICTOGRAMME} : stroke`]);
});
