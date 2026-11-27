import { test } from 'node:test';
import assert from 'node:assert/strict';
import { couleursEnDur } from '../../scripts/verifier-couleurs-ts.mjs';

// Tests du script de lint des couleurs en dur dans les `styles:` des composants (US 292, critère 4).
const comp = (css) => `@Component({ selector: 'x', template: '', styles: \`${css}\` }) class X {}`;
const nb = async (src) => (await couleursEnDur(src)).length;

test('given des styles avec hex, rgb(), hsl() ou nom de couleur, when on les vérifie, then chaque couleur est signalée', async () => {
  assert.equal(await nb(comp('.a { color: #fff; }')), 1);
  assert.equal(await nb(comp('.a { color: rgb(0 0 0 / 5%); }')), 1);
  assert.equal(await nb(comp('.a { background: hsla(1, 2%, 3%, 1); }')), 1);
  assert.equal(await nb(comp('.a { border: 1px solid red; }')), 1);
});

test('given un nom de couleur hors de la liste usuelle, when on vérifie, then il est signalé', async () => {
  for (const nom of ['darkorange', 'whitesmoke', 'rebeccapurple']) assert.equal(await nb(comp(`.a { color: ${nom}; }`)), 1, nom);
});

test('given un tableau styles avec un sélecteur d\'attribut, when on vérifie, then la couleur qui suit est signalée', async () => {
  const src = "@Component({ styles: [`.a[aria-selected='true'] { color: #ff0000; }`] }) class X {}";
  assert.equal(await nb(src), 1);
});

test('given une couleur de secours dans var(--x, red), when on vérifie, then elle est signalée', async () => {
  assert.equal(await nb(comp('.a { color: var(--x, red); }')), 1);
});

test('given des styles qui n\'utilisent que des tokens, when on les vérifie, then rien n\'est signalé', async () => {
  assert.equal(await nb(comp('.red, .blue-box { color: var(--lr-texte); border: 1px solid var(--lr-bordure); background: transparent; }')), 0);
});

test('given une couleur hors de styles:, when on vérifie, then elle est ignorée', async () => {
  assert.equal(await nb("const c = '#ff0000'; @Component({ template: '<p>red</p>' })"), 0);
});
