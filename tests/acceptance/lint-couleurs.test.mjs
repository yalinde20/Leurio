import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, requireDir, requireScript, run } from '../helpers/run.mjs';

const uid = `${process.pid}-${Date.now()}`;
const DOSSIER = 'src/app/shared';

test('critère 7 : given un style de composant qui contient une couleur littérale (hex, rgb, hsl ou nommée), when on lance le lint, then le lint échoue en nommant le fichier', () => {
  requireScript('lint');
  requireDir(DOSSIER);
  const fichiers = {
    [`tmp-${uid}-hex.scss`]: '.x { color: #ff0000; }\n',
    [`tmp-${uid}-rgb.scss`]: '.x { color: rgb(255, 0, 0); }\n',
    [`tmp-${uid}-hsl.scss`]: '.x { color: hsl(0, 100%, 50%); }\n',
    [`tmp-${uid}-nommee.scss`]: '.x { color: red; }\n',
    [`tmp-${uid}-token.scss`]: '.x { color: var(--lr-texte); }\n',
  };
  const ecrits = [];
  try {
    for (const [nom, contenu] of Object.entries(fichiers)) {
      const p = join(ROOT, DOSSIER, nom);
      writeFileSync(p, contenu);
      ecrits.push(p);
    }
    const r = run('npm', ['run', 'lint']);
    assert.notEqual(r.status, 0, 'le lint aurait dû échouer');
    for (const nom of Object.keys(fichiers).filter((n) => !n.endsWith('-token.scss'))) {
      assert.ok(r.output.includes(nom), `le lint ne nomme pas ${nom} : ${r.output}`);
    }
    assert.ok(!r.output.includes(`tmp-${uid}-token.scss`), 'un style qui n\'utilise que var(--lr-texte) ne doit pas être signalé');
  } finally {
    for (const p of ecrits) rmSync(p, { force: true });
  }
});
