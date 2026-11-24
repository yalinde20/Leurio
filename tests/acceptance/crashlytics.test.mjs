import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readPackageJson } from '../helpers/run.mjs';

const lire = (rel) => readFileSync(join(ROOT, rel), 'utf8');

test('US 18 critère 1 : given le dépôt, when on lit package.json, then le plugin Capacitor Crashlytics est une dépendance', () => {
  const pkg = readPackageJson();
  assert.ok(pkg.dependencies?.['@capacitor-firebase/crashlytics'], 'dépendance @capacitor-firebase/crashlytics absente');
});

test('US 18 critère 1 : given le projet Android, when on lit les fichiers Gradle, then le plugin Crashlytics est déclaré et appliqué seulement si google-services.json est fourni', () => {
  const racine = lire('android/build.gradle');
  assert.match(racine, /com\.google\.firebase:firebase-crashlytics-gradle:/, 'classpath du plugin Gradle Crashlytics absent');
  const app = lire('android/app/build.gradle');
  const bloc = app.match(/def servicesJSON[\s\S]*?\n\}\s*catch/)?.[0] ?? '';
  assert.match(bloc, /servicesJSON\.text/, 'le test de présence de google-services.json a disparu');
  assert.match(bloc, /apply plugin: 'com\.google\.firebase\.crashlytics'/, 'plugin com.google.firebase.crashlytics non appliqué dans le bloc google-services.json');
});

test('US 18 critère 3 : given le build web, when on lit le code, then le plugin natif n\'est importé que dynamiquement (jamais dans le bundle initial du web)', () => {
  const f = 'src/app/core/firebase/plantages.ts';
  assert.ok(existsSync(join(ROOT, f)), `${f} est absent`);
  const src = lire(f);
  assert.doesNotMatch(src, /^import[^\n]*@capacitor-firebase\/crashlytics/m, 'import statique du plugin');
  assert.match(src, /import\(\s*['"]@capacitor-firebase\/crashlytics['"]\s*\)/);
});

test('US 18 critère 3 : given la config native, when on la lit, then la collecte Crashlytics est désactivée par défaut sur Android et iOS', () => {
  const manifest = lire('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:name="firebase_crashlytics_collection_enabled"\s+android:value="false"/);
  const plist = lire('ios/App/App/Info.plist');
  assert.match(plist, /<key>FirebaseCrashlyticsCollectionEnabled<\/key>\s*<false\/>/);
});

test('US 18 : given le build réel, when on identifie le build, then « commit court · date UTC » est écrit dans la configuration et ne fait jamais échouer', async () => {
  const { identifierBuild } = await import(pathToFileURL(join(ROOT, 'scripts/build-info.mjs')).href);
  const date = new Date('2026-11-24T23:59:00Z');
  assert.equal(identifierBuild({ env: { GITHUB_SHA: '1970163abcdef' }, git: () => 'zzz', maintenant: date }), '1970163 · 2026-11-24');
  assert.equal(identifierBuild({ env: {}, git: () => 'abc1234', maintenant: date }), 'abc1234 · 2026-11-24');
  assert.equal(identifierBuild({ env: {}, git: () => '', maintenant: date }), 'inconnu · 2026-11-24');
  assert.match(lire('scripts/build-reel.mjs'), /build: \$\{JSON\.stringify\(identifierBuild\(\)\)\}/);
  assert.match(lire('src/app/core/firebase/config.ts'), /build: 'dev'/);
});
