import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run, requireScript } from '../helpers/run.mjs';

test('critère 6 : given une erreur de type dans un fichier de src/app, when on lance le type check, then il échoue en indiquant le fichier', () => {
  requireScript('typecheck');
  assert.ok(existsSync(join(ROOT, 'src/app')), 'src/app n\'existe pas');
  const nom = `tmp-acceptance-type-${process.pid}-${Date.now()}.ts`;
  const p = join(ROOT, 'src/app', nom);
  try {
    writeFileSync(p, `export const n: number = 'x';\n`);
    const r = run('npm', ['run', 'typecheck']);
    assert.notEqual(r.status, 0, 'le type check aurait dû échouer');
    assert.ok(r.output.includes(nom), `le fichier ${nom} n'est pas cité : ${r.output}`);
  } finally {
    rmSync(p, { force: true });
  }
});
