// US 105, décision A1 : `article` (« un » / « une ») de chaque type de lure-types.json, validé par le schéma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const lire = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));

function valider(mutate) {
  const dir = mkdtempSync(join(tmpdir(), `article-${process.pid}-`));
  try {
    const src = join(ROOT, 'src/assets/data');
    for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(join(src, f), join(dir, f));
    const lure = lire('src/assets/data/lure-types.json');
    mutate(lure);
    writeFileSync(join(dir, 'lure-types.json'), JSON.stringify(lure, null, 2));
    return run('node', ['scripts/validate-data.ts', dir], 60_000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('US 105 contenu : given lure-types.json, when on lit les types, then chacun a `article` « un » ou « une »', () => {
  for (const t of lire('src/assets/data/lure-types.json')) {
    assert.ok(
      ['un', 'une'].includes(t.article),
      `${t.id} : article « un » ou « une » attendu, reçu ${JSON.stringify(t.article)}`,
    );
  }
});

test('US 105 schéma : given le schéma des types, when on le lit, then `article` est obligatoire et limité à « un » et « une »', () => {
  const s = lire('schemas/lure-types.schema.json').items;
  assert.ok(s.required.includes('article'));
  assert.deepEqual([...(s.properties?.article?.enum ?? [])].sort(), ['un', 'une']);
});

test('US 105 validation : given un type sans `article`, when on valide le contenu, then la validation échoue', () => {
  const r = valider((l) => delete l[0].article);
  assert.notEqual(r.status, 0);
});

test('US 105 validation : given un type dont `article` est « le », when on valide le contenu, then la validation échoue', () => {
  const r = valider((l) => (l[0].article = 'le'));
  assert.notEqual(r.status, 0);
});
