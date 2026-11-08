import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';
import { lireThemes, contraste } from '../helpers/contrast.mjs';

// US 80, critère 7 : couleurs par tokens, contraste >= 4,5:1 dans les deux thèmes, lien de 48 px.
const FICHIER = 'src/app/features/conseil/bandeau-reglementation.component.ts';
const source = () => {
  const p = join(ROOT, FICHIER);
  assert.ok(existsSync(p), `${FICHIER} est absent`);
  return readFileSync(p, 'utf8');
};

test('US 80 critère 7 : given le bandeau Réglementation, when on lit son composant, then il est peint avec les tokens --lr-* et aucune couleur littérale', () => {
  const texte = source();
  assert.match(texte, /var\(--lr-surface\)/, 'le fond du bandeau n\'est pas --lr-surface');
  assert.match(texte, /var\(--lr-texte\)/, 'le texte du bandeau n\'est pas --lr-texte');
  assert.match(texte, /var\(--lr-danger\)/, 'ce qui est fermé n\'est pas écrit avec --lr-danger');
  assert.match(texte, /var\(--lr-primaire\)/, 'le lien n\'est pas peint avec --lr-primaire');
  const litterales = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|:\s*(white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|brown|silver|navy|teal)\b/;
  assert.doesNotMatch(texte, litterales, `couleur littérale dans ${FICHIER}`);
});

test('US 80 critère 7 : given le lien vers la fédération, when on lit le style du bandeau, then sa cible tactile fait au moins 48 px de haut', () => {
  const texte = source();
  const m = /min-height:\s*(\d+)px/.exec(texte);
  assert.ok(m, 'aucun min-height déclaré pour le lien du bandeau');
  assert.ok(Number(m[1]) >= 48, `min-height ${m[1]}px < 48px`);
});

for (const theme of ['clair', 'sombre']) {
  test(`US 80 critère 7 : given le thème ${theme}, when on mesure chaque texte du bandeau sur son fond, then le contraste est d'au moins 4,5:1`, () => {
    source();
    const t = lireThemes()[theme];
    for (const texte of ['--lr-texte', '--lr-texte-secondaire', '--lr-danger', '--lr-primaire']) {
      const c = contraste(t[texte], t['--lr-surface']);
      assert.ok(c >= 4.5, `${texte} sur --lr-surface (${theme}) : ${c.toFixed(2)}:1 < 4,5:1`);
    }
  });
}
