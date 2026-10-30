import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireThemes, contraste, luminance } from '../helpers/contrast.mjs';

test('critère 3 : given la liste des tokens de couleur, when on compare le thème clair et le thème sombre, then chaque token est défini dans les deux thèmes, y compris carte et graphiques', () => {
  const { clair, sombre } = lireThemes();
  const nomsClair = Object.keys(clair).sort();
  const nomsSombre = Object.keys(sombre).sort();
  assert.ok(nomsClair.length > 0, 'aucun token --lr-* dans le thème clair');
  assert.deepEqual(nomsSombre, nomsClair, 'les deux thèmes ne définissent pas les mêmes tokens');
  assert.ok(nomsClair.some((n) => n.startsWith('--lr-carte-')), 'aucun token --lr-carte-*');
  assert.ok(nomsClair.some((n) => n.startsWith('--lr-graphique-')), 'aucun token --lr-graphique-*');
});

test('critère 4 : given le thème clair, when on mesure le contraste du texte principal sur le fond, then il est d\'au moins 7:1', () => {
  const { clair } = lireThemes();
  assert.ok(clair['--lr-texte'] && clair['--lr-fond'], 'tokens --lr-texte et --lr-fond absents du thème clair');
  const c = contraste(clair['--lr-texte'], clair['--lr-fond']);
  assert.ok(c >= 7, `contraste ${c.toFixed(2)}:1 < 7:1`);
});

test('critère 5 : given le thème sombre, when on mesure le contraste du texte principal sur le fond, then il est d\'au moins 4,5:1 et le fond est plus sombre que le texte', () => {
  const { sombre } = lireThemes();
  assert.ok(sombre['--lr-texte'] && sombre['--lr-fond'], 'tokens --lr-texte et --lr-fond absents du thème sombre');
  const c = contraste(sombre['--lr-texte'], sombre['--lr-fond']);
  assert.ok(c >= 4.5, `contraste ${c.toFixed(2)}:1 < 4,5:1`);
  assert.ok(luminance(sombre['--lr-fond']) < luminance(sombre['--lr-texte']), 'le fond doit être plus sombre que le texte');
});

for (const theme of ['clair', 'sombre']) {
  test(`critère 6 : given le thème ${theme}, when on mesure le contraste du texte d'un bouton d'action sur la couleur d'accent, then il est d'au moins 4,5:1`, () => {
    const t = lireThemes()[theme];
    assert.ok(t['--lr-sur-accent'] && t['--lr-accent'], `tokens --lr-sur-accent et --lr-accent absents du thème ${theme}`);
    const c = contraste(t['--lr-sur-accent'], t['--lr-accent']);
    assert.ok(c >= 4.5, `contraste ${c.toFixed(2)}:1 < 4,5:1`);
  });
}
