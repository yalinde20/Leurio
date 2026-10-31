// US 36, critère 8 : core/engine et core/regulation n'importent jamais Firebase ;
// tout le code Firebase de l'app vit dans src/app/core/firebase (PLAN §4, §5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, requireDir, lintFile } from '../helpers/run.mjs';

const uid = `${process.pid}-${Date.now()}`;

function ts(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? ts(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const IMPORT_FIREBASE = /(?:from|import)\s*\(?\s*['"](firebase(?:\/[\w-]+)?|@firebase\/[\w-]+)['"]/;

for (const dossier of ['engine', 'regulation']) {
  for (const module of ['firebase/app', 'firebase/firestore', 'firebase/auth', '@firebase/app']) {
    test(`critère 8 : given un fichier de core/${dossier} qui importe ${module}, when on lance le lint, then le lint échoue sur no-restricted-imports`, () => {
      const rel = `src/app/core/${dossier}`;
      requireDir(rel);
      const nom = `tmp-firebase-${module.replace(/\W/g, '-')}-${uid}.ts`;
      const p = join(ROOT, rel, nom);
      try {
        writeFileSync(p, `import * as sdk from '${module}';\nexport const x = sdk;\n`);
        const r = lintFile(`${rel}/${nom}`);
        assert.notEqual(r.status, 0, `le lint aurait dû échouer pour ${module}`);
        assert.ok(r.messages.some((m) => m.ruleId === 'no-restricted-imports'), r.output);
      } finally {
        rmSync(p, { force: true });
      }
    });
  }

  test(`critère 8 : given le code de src/app/core/${dossier}, when on le parcourt, then aucun import de Firebase n'y figure`, () => {
    requireDir(`src/app/core/${dossier}`);
    const fautifs = ts(join(ROOT, 'src/app/core', dossier)).filter((f) => IMPORT_FIREBASE.test(readFileSync(f, 'utf8')));
    assert.deepEqual(fautifs.map((f) => relative(ROOT, f)), []);
  });
}

test('critère 8 : given le code de l\'app, when on cherche les imports du SDK Firebase, then Auth, Firestore, Storage et App Check sont importés dans src/app/core/firebase et nulle part ailleurs', () => {
  const racine = join(ROOT, 'src');
  const dedans = [];
  const dehors = [];
  for (const f of ts(racine).filter((x) => !x.endsWith('.spec.ts'))) {
    const t = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f);
    for (const m of t.matchAll(/['"](firebase\/[\w-]+|@firebase\/[\w-]+)['"]/g)) {
      (rel.startsWith('src/app/core/firebase/') ? dedans : dehors).push(`${rel} -> ${m[1]}`);
    }
  }
  assert.deepEqual(dehors, [], 'le SDK Firebase ne doit être importé que par src/app/core/firebase');
  const modules = new Set(dedans.map((d) => d.split(' -> ')[1]));
  for (const requis of ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/app-check'])
    assert.ok(modules.has(requis), `src/app/core/firebase n'importe pas ${requis}`);
});
