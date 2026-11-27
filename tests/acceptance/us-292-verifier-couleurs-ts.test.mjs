import { test } from 'node:test';
import assert from 'node:assert/strict';
import { couleursEnDur } from '../../scripts/verifier-couleurs-ts.mjs';

// Tests du script de lint des couleurs en dur dans les `styles:` des composants (US 292, critère 4).
const comp = (css) => `@Component({ selector: 'x', template: '', styles: \`${css}\` }) class X {}`;

test('given des styles avec hex, rgb(), hsl() ou nom de couleur, when on les vérifie, then chaque couleur est signalée', () => {
  assert.deepEqual(couleursEnDur(comp('.a { color: #fff; }')), ['#fff']);
  assert.deepEqual(couleursEnDur(comp('.a { color: rgb(0 0 0 / 5%); }')), ['rgb(']);
  assert.deepEqual(couleursEnDur(comp('.a { background: hsla(1, 2%, 3%, 1); }')), ['hsla(']);
  assert.deepEqual(couleursEnDur(comp('.a { border: 1px solid red; }')), ['red']);
});

test('given des styles qui n\'utilisent que des tokens, when on les vérifie, then rien n\'est signalé', () => {
  assert.deepEqual(couleursEnDur(comp('.red, .blue-box { color: var(--lr-texte); border: 1px solid var(--lr-bordure); background: transparent; }')), []);
  assert.deepEqual(couleursEnDur(comp('.a { color: var(--lr-texte, red); }')), []);
});

test('given une couleur hors de styles:, when on vérifie, then elle est ignorée', () => {
  assert.deepEqual(couleursEnDur("const c = '#ff0000'; @Component({ template: '<p>red</p>' })"), []);
});
