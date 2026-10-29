import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, requireDir, lintFile } from '../helpers/run.mjs';

const uid = `${process.pid}-${Date.now()}`;

/** Écrit des fichiers temporaires dans un dossier existant, lint le premier, nettoie. */
function avecFichiers(dossier, fichiers, fn) {
  requireDir(dossier);
  const ecrits = [];
  try {
    for (const [nom, contenu] of Object.entries(fichiers)) {
      const p = join(ROOT, dossier, nom);
      writeFileSync(p, contenu);
      ecrits.push(p);
    }
    return fn();
  } finally {
    for (const p of ecrits) rmSync(p, { force: true });
  }
}

test('critère 3 : given un fichier de core/engine qui importe @angular/core, when on lance le lint, then il échoue et le message nomme la règle qui interdit les dépendances framework dans core/engine', () => {
  const nom = `tmp-acceptance-${uid}.ts`;
  const r = avecFichiers('src/app/core/engine', { [nom]: `import { Injectable } from '@angular/core';\nexport const x = Injectable;\n` },
    () => lintFile(`src/app/core/engine/${nom}`));
  assert.notEqual(r.status, 0, 'le lint aurait dû échouer');
  const m = r.messages.find((x) => x.ruleId === 'no-restricted-imports');
  assert.ok(m, `aucune erreur no-restricted-imports : ${r.output}`);
  assert.match(m.message, /core\/engine/);
});

for (const [libelle, module] of [['@ionic', '@ionic/angular'], ['@capacitor', '@capacitor/core'], ['firebase', 'firebase/app']]) {
  test(`critère 4 : given un fichier de core/regulation qui importe ${libelle}, when on lance le lint, then le lint échoue`, () => {
    const nom = `tmp-acceptance-${libelle.replace('@', '')}-${uid}.ts`;
    const r = avecFichiers('src/app/core/regulation', { [nom]: `import * as lib from '${module}';\nexport const x = lib;\n` },
      () => lintFile(`src/app/core/regulation/${nom}`));
    assert.notEqual(r.status, 0, `le lint aurait dû échouer pour ${module}`);
    assert.ok(r.messages.some((x) => x.ruleId === 'no-restricted-imports'), r.output);
  });
}

test('critère 5 : given un fichier de core/regulation qui importe suncalc ou un autre fichier TypeScript pur, when on lance le lint, then le lint passe', () => {
  const pur = `tmp-acceptance-pur-${uid}.ts`;
  const sun = `tmp-acceptance-sun-${uid}.ts`;
  const rel = `tmp-acceptance-rel-${uid}.ts`;
  avecFichiers('src/app/core/regulation', {
    [pur]: `export const double = (n: number): number => n * 2;\n`,
    [sun]: `import SunCalc from 'suncalc';\nexport const times = SunCalc;\n`,
    [rel]: `import { double } from './${pur.replace('.ts', '')}';\nexport const quatre = double(2);\n`,
  }, () => {
    for (const f of [sun, rel]) {
      const r = lintFile(`src/app/core/regulation/${f}`);
      assert.equal(r.status, 0, `le lint aurait dû passer pour ${f} : ${r.output}`);
    }
  });
});
