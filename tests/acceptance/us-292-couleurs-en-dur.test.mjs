import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, requireScript, run } from '../helpers/run.mjs';

// US 292, critère 4 : aucune couleur en dur hors de src/theme/tokens.scss, y compris dans les `styles:` des composants TypeScript.
const COULEUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/;

function tsDe(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = join(dossier, e.name);
    if (e.isDirectory()) return tsDe(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
}

/** Contenu des `styles:` d'un composant (gabarit ou chaîne), `styles: [...]` compris. */
function stylesDe(src) {
  return [...src.matchAll(/\bstyles\s*:\s*(`[\s\S]*?`|\[[\s\S]*?\]|'[^']*'|"[^"]*")/g)].map((m) => m[1]);
}

test('US 292 critère 4 : given le code des composants, when on lit leurs styles TypeScript, then aucune couleur n\'est écrite en dur', () => {
  const fautifs = [];
  for (const f of tsDe(join(ROOT, 'src/app'))) {
    const src = readFileSync(f, 'utf8');
    for (const s of stylesDe(src)) if (COULEUR.test(s)) fautifs.push(f.slice(ROOT.length + 1));
  }
  assert.deepEqual([...new Set(fautifs)], []);
});

test('US 292 critère 4 : given un composant dont `styles:` contient une couleur littérale, when on lance le lint, then le lint échoue en nommant le fichier', () => {
  requireScript('lint');
  const nom = `tmp-us292-${process.pid}-${Date.now()}.ts`;
  const p = join(ROOT, 'src/app/shared', nom);
  writeFileSync(p, "import { Component } from '@angular/core';\n@Component({ selector: 'app-tmp-us292', template: '', styles: `.x { color: #ff0000; }` })\nexport class TmpUs292Component {}\n");
  try {
    const r = run('npm', ['run', 'lint']);
    assert.notEqual(r.status, 0, 'le lint aurait dû échouer sur une couleur en dur dans styles:');
    assert.ok(r.output.includes(nom), `le lint ne nomme pas ${nom} : ${r.output.slice(-1500)}`);
  } finally {
    rmSync(p, { force: true });
  }
});
