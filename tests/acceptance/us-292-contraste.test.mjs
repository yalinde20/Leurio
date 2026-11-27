import { test } from 'node:test';
import assert from 'node:assert/strict';
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
const GRANDS_ELEMENTS = [['--lr-trait', '--lr-fond'], ['--lr-trait', '--lr-surface'], ['--lr-accent', '--lr-fond']];

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
