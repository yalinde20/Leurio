import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';
import { lireThemes, contraste } from '../helpers/contrast.mjs';

const DOSSIER = 'src/app/features/conseil';
const sources = () => {
  const dir = join(ROOT, DOSSIER);
  assert.ok(existsSync(dir), `${DOSSIER} est absent`);
  return readdirSync(dir)
    .filter((f) => /\.(ts|html|scss|css)$/.test(f) && !/\.spec\.ts$/.test(f))
    .map((f) => ({ f, texte: readFileSync(join(dir, f), 'utf8') }));
};

test('critère 7 : given l\'écran Conseil, when on lit ses fichiers, then la carte « Conditions » est stylée avec les tokens --lr-* et aucune couleur littérale (hex, rgb, hsl, nommée)', () => {
  const fichiers = sources();
  const tout = fichiers.map(({ texte }) => texte).join('\n');
  assert.match(tout, /Conditions/, 'la carte « Conditions » est absente de l\'écran Conseil');
  assert.match(tout, /var\(--lr-(surface|fond)\)/, 'la carte ne se peint pas avec un token de fond (--lr-surface ou --lr-fond)');
  assert.match(tout, /var\(--lr-texte(-secondaire)?\)/, 'la carte n\'utilise pas de token de texte');
  const litterales = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|:\s*(white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|brown|silver|navy|teal)\b/;
  for (const { f, texte } of fichiers) assert.doesNotMatch(texte, litterales, `couleur littérale dans ${join(DOSSIER, f)}`);
});

for (const theme of ['clair', 'sombre']) {
  test(`critère 7 : given le thème ${theme}, when on mesure les tokens de texte de la carte sur ses fonds, then chaque couple utilisé a un contraste d'au moins 4,5:1`, () => {
    const tout = sources().map(({ texte }) => texte).join('\n');
    assert.match(tout, /var\(--lr-/, 'la carte « Conditions » n\'utilise encore aucun token');
    const t = lireThemes()[theme];
    for (const texte of ['--lr-texte', '--lr-texte-secondaire']) {
      for (const fond of ['--lr-surface', '--lr-fond']) {
        const c = contraste(t[texte], t[fond]);
        assert.ok(c >= 4.5, `${texte} sur ${fond} (${theme}) : ${c.toFixed(2)}:1 < 4,5:1`);
      }
    }
  });
}

// ---------- US 65 : badge « Moins précis » ----------
test('US 65 critère 2 : given le badge « Moins précis » de la carte, when on lit les fichiers de l\'écran Conseil, then il est peint avec les tokens --lr-sable et --lr-texte', () => {
  const tout = sources().map(({ texte }) => texte).join('\n');
  assert.match(tout, /Moins précis/, 'le badge « Moins précis » est absent de l\'écran Conseil');
  assert.match(tout, /var\(--lr-sable\)/, 'le badge n\'utilise pas le token --lr-sable');
});

for (const theme of ['clair', 'sombre']) {
  test(`US 65 critère 2 : given le thème ${theme}, when on mesure --lr-texte sur --lr-sable, then le contraste du badge est d'au moins 4,5:1`, () => {
    const t = lireThemes()[theme];
    const c = contraste(t['--lr-texte'], t['--lr-sable']);
    assert.ok(c >= 4.5, `--lr-texte sur --lr-sable (${theme}) : ${c.toFixed(2)}:1 < 4,5:1`);
  });
}
