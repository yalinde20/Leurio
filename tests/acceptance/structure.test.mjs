import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';

const DOSSIERS = [
  'src/app/core/engine', 'src/app/core/regulation', 'src/app/core/data', 'src/app/core/firebase',
  'src/app/features/onboarding', 'src/app/features/conseil', 'src/app/features/animation',
  'src/app/features/boite', 'src/app/features/spots', 'src/app/features/compte',
  'src/app/shared', 'src/assets/data', 'schemas', 'scripts',
];

function tsFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith('.ts') ? [p] : [];
  });
}

test('critère 1 : given le dépôt, when on liste les dossiers, then tous les dossiers de l\'arborescence du plan existent', () => {
  const manquants = DOSSIERS.filter((d) => !(existsSync(join(ROOT, d)) && statSync(join(ROOT, d)).isDirectory()));
  assert.deepEqual(manquants, [], `dossiers manquants : ${manquants.join(', ')}`);
});

test('critère 2 : given le code de l\'app, when on cherche une déclaration de NgModule, then aucune n\'est trouvée et le composant racine est standalone', () => {
  const app = join(ROOT, 'src/app/app.ts');
  assert.ok(existsSync(app), 'src/app/app.ts (composant racine) est absent');
  const fichiers = tsFiles(join(ROOT, 'src'));
  assert.ok(fichiers.length > 0, 'aucun fichier TypeScript dans src');
  const avecNgModule = fichiers.filter((f) => /@NgModule\s*\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(avecNgModule, [], 'NgModule trouvé');
  const src = readFileSync(app, 'utf8');
  assert.match(src, /@Component\s*\(/);
  assert.doesNotMatch(src, /standalone\s*:\s*false/);
  const main = join(ROOT, 'src/main.ts');
  assert.ok(existsSync(main), 'src/main.ts est absent');
  assert.match(readFileSync(main, 'utf8'), /bootstrapApplication\s*\(/);
});
