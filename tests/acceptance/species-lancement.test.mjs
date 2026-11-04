// US 41 : le contenu réel (7 espèces du lancement) passe la validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

test('critère 5 : given le contenu avec les 7 espèces du lancement, when on lance npm run validate-data, then elle passe', () => {
  const especes = JSON.parse(readFileSync(join(ROOT, 'src/assets/data/species.json'), 'utf8'));
  assert.deepEqual(especes.map((e) => e.code).sort(), ['ASP', 'BBG', 'BRO', 'CHE', 'PER', 'SAN', 'SIL']);
  const r = run('npm', ['run', 'validate-data'], 120_000);
  assert.equal(r.status, 0, r.output);
});
