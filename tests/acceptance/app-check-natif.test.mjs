// US 20 : App Check en production sur Android et iOS (plugin natif) et documentation de l'application stricte.
// Tests sur les fichiers : aucun service réel n'est appelé ; l'application stricte (enforcement) se fait dans la console Firebase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readPackageJson } from '../helpers/run.mjs';

const lire = (rel) => {
  const f = join(ROOT, rel);
  assert.ok(existsSync(f), `${rel} est absent`);
  return readFileSync(f, 'utf8');
};

test('critère 1 : given le projet, when on lit package.json, then le plugin @capacitor-firebase/app-check est une dépendance', () => {
  const pkg = readPackageJson();
  assert.ok(pkg.dependencies?.['@capacitor-firebase/app-check'], 'dépendance @capacitor-firebase/app-check absente');
});

test('critère 1 : given capacitor.config.ts, when on le lit, then le plugin est lié par lien symbolique dans les options SPM iOS', () => {
  const src = lire('capacitor.config.ts');
  assert.match(src, /@capacitor-firebase\/app-check/);
  assert.match(src, /experimental/);
  assert.match(src, /spm/);
  assert.match(src, /packageOptions/);
  assert.match(src, /symlink\s*:\s*true/);
});

test('critère 1 : given le projet iOS, when on lit les droits de l\'app, then App Attest est activé en production', () => {
  const plist = lire('ios/App/App/App.entitlements');
  assert.match(plist, /<key>com\.apple\.developer\.devicecheck\.appattest-environment<\/key>\s*<string>production<\/string>/);
});

test('critère 1 : given le projet Xcode, when on lit project.pbxproj, then les deux configurations de la cible App référencent App.entitlements', () => {
  const pbx = lire('ios/App/App.xcodeproj/project.pbxproj');
  const refs = pbx.match(/CODE_SIGN_ENTITLEMENTS = "?App\/App\.entitlements"?;/g) ?? [];
  assert.ok(refs.length >= 2, `CODE_SIGN_ENTITLEMENTS attendu dans Debug et Release, trouvé ${refs.length} fois`);
});

test('critère 1 : given le projet iOS, when on lit Package.swift, then le plugin App Check est enregistré', () => {
  assert.match(lire('ios/App/CapApp-SPM/Package.swift'), /CapacitorFirebaseAppCheck/);
});

test('critère 1 : given le projet Android, when on lit capacitor.settings.gradle, then le module du plugin App Check est inclus', () => {
  assert.match(lire('android/capacitor.settings.gradle'), /capacitor-firebase-app-check/);
});

test('critère 3 : given la documentation, when on lit docs/app-check.md, then elle explique l\'application stricte pour Cloud Firestore et Cloud Storage', () => {
  const md = lire('docs/app-check.md');
  assert.match(md, /appliquer|enforce/i);
  assert.match(md, /firestore/i);
  assert.match(md, /storage/i);
  assert.match(md, /console/i);
});

test('critère 3 : given la documentation, when on la lit, then elle dit qu\'une requête sans jeton valide est refusée', () => {
  assert.match(lire('docs/app-check.md'), /refus|rejet|bloqu/i);
});

test('critère 3 : given la documentation, when on la lit, then elle couvre Play Integrity, App Attest et reCAPTCHA Enterprise', () => {
  const md = lire('docs/app-check.md');
  assert.match(md, /play integrity/i);
  assert.match(md, /sha-?256/i);
  assert.match(md, /app attest/i);
  assert.match(md, /team id/i);
  assert.match(md, /recaptcha enterprise/i);
});

test('critère 3 : given la documentation, when on la lit, then elle couvre les métriques et les jetons de débogage', () => {
  const md = lire('docs/app-check.md');
  assert.match(md, /métriques|metrics/i);
  assert.match(md, /débogage|debug/i);
});
