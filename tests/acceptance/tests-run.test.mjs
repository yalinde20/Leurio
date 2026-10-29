import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run, requireScript } from '../helpers/run.mjs';

function specs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? specs(p) : p.endsWith('.spec.ts') ? [p] : [];
  });
}

test('critère 7 : given le projet neuf, when on lance les tests, then un test unitaire de fonction TypeScript et un test de composant s\'exécutent et passent', () => {
  requireScript('test');
  assert.ok(specs(join(ROOT, 'src/app/core')).length >= 1, 'aucun *.spec.ts sous src/app/core (test d\'une fonction pure)');
  assert.ok(existsSync(join(ROOT, 'src/app/app.spec.ts')), 'src/app/app.spec.ts (test de composant) est absent');
  const r = run('npm', ['test'], 600_000);
  assert.equal(r.status, 0, r.output);
  const m = r.output.match(/Tests\s+(?:\d+ failed \| )?(\d+) passed/);
  assert.ok(m, `résumé Vitest introuvable : ${r.output}`);
  assert.ok(Number(m[1]) >= 2, `${m[1]} test(s) passé(s), 2 attendus au moins`);
});
