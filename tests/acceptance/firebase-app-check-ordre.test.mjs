// US 20, critère 1 : en production (web, Android, iOS), App Check est initialisé avant le premier accès à Firestore ou Storage.
// firebase.service.ts est empaqueté par esbuild avec des doubles pour ./config, Angular, @capacitor/* et firebase/* : aucun réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { ROOT } from '../helpers/run.mjs';

const DOUBLES_APP_CHECK = `
const j = (globalThis.__journalUs20 ??= []);
const fab = (classe) => class { constructor() { j.push('fournisseur:' + classe); } };
export const CustomProvider = fab('CustomProvider');
export const ReCaptchaV3Provider = fab('ReCaptchaV3Provider');
export const ReCaptchaEnterpriseProvider = fab('ReCaptchaEnterpriseProvider');
export const initializeAppCheck = () => { j.push('initializeAppCheck'); return {}; };
`;

async function demarrer({ natif, emulateurs }) {
  globalThis.__journalUs20 = [];
  const dir = mkdtempSync(join(tmpdir(), 'us20-'));
  const ecrire = (nom, code) => { writeFileSync(join(dir, nom), code); return join(dir, nom); };
  const capacitor = `export const Capacitor = { isNativePlatform: () => ${natif} }; export const registerPlugin = () => ({});`;
  const remplacements = {
    './config': ecrire('config.mjs', `export const emulateurs = ${emulateurs};
export const config = { firebase: { apiKey: 'k', authDomain: 'd', projectId: 'p', storageBucket: 'b', messagingSenderId: '0', appId: 'a' }, appCheckSiteKey: 'cle-de-site' };`),
    '@angular/core': ecrire('core.mjs', 'export const Injectable = () => (c) => c;'),
    '@capacitor/core': ecrire('capacitor.mjs', capacitor),
    './hook-test': ecrire('hook.mjs', 'export const exposerPourLesTests = () => {};'),
    'firebase/app-check': ecrire('app-check.mjs', DOUBLES_APP_CHECK),
    'firebase/app': ecrire('app.mjs', 'export const initializeApp = () => ({});'),
    'firebase/auth': ecrire('auth.mjs', 'export const getAuth = () => ({}); export const connectAuthEmulator = () => {};'),
    'firebase/firestore': ecrire('fs.mjs', `export const initializeFirestore = () => { (globalThis.__journalUs20).push('initializeFirestore'); return {}; };
export const persistentLocalCache = () => ({}); export const persistentMultipleTabManager = () => ({}); export const connectFirestoreEmulator = () => {};`),
    'firebase/storage': ecrire('st.mjs', `export const getStorage = () => { (globalThis.__journalUs20).push('getStorage'); return {}; };
export const connectStorageEmulator = () => {};`),
  };
  const sortie = join(dir, 'service.mjs');
  try {
    await build({
      entryPoints: [join(ROOT, 'src/app/core/firebase/firebase.service.ts')],
      bundle: true, format: 'esm', platform: 'node', outfile: sortie, logLevel: 'silent',
      plugins: [{
        name: 'doubles',
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => (remplacements[a.path] ? { path: remplacements[a.path] } : undefined));
        },
      }],
    });
    const { FirebaseService } = await import(`${pathToFileURL(sortie).href}?${Date.now()}`);
    new FirebaseService();
    return globalThis.__journalUs20;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function verifierOrdre(journal) {
  const appCheck = journal.indexOf('initializeAppCheck');
  assert.ok(appCheck >= 0, `App Check n'est pas initialisé : ${journal}`);
  assert.ok(journal.includes('initializeFirestore') && journal.includes('getStorage'), `Firestore ou Storage absent : ${journal}`);
  assert.ok(appCheck < journal.indexOf('initializeFirestore'), `App Check après Firestore : ${journal}`);
  assert.ok(appCheck < journal.indexOf('getStorage'), `App Check après Storage : ${journal}`);
}

test('critère 1 : given la production sur Android ou iOS, when l\'app démarre, then App Check utilise un fournisseur natif (pas reCAPTCHA) et est initialisé avant Firestore et Storage', async () => {
  const journal = await demarrer({ natif: true, emulateurs: false });
  assert.ok(!journal.includes('fournisseur:ReCaptchaEnterpriseProvider'), `reCAPTCHA utilisé sur natif : ${journal}`);
  assert.ok(journal.includes('fournisseur:CustomProvider'), `aucun fournisseur natif : ${journal}`);
  verifierOrdre(journal);
});

test('critère 1 : given la production sur le web, when l\'app démarre, then App Check utilise reCAPTCHA Enterprise et est initialisé avant Firestore et Storage', async () => {
  const journal = await demarrer({ natif: false, emulateurs: false });
  assert.ok(journal.includes('fournisseur:ReCaptchaEnterpriseProvider'), `reCAPTCHA Enterprise absent : ${journal}`);
  assert.ok(!journal.includes('fournisseur:CustomProvider'), `fournisseur local utilisé en production web : ${journal}`);
  verifierOrdre(journal);
});

test('critère 2 : given les émulateurs sur Android ou iOS, when l\'app démarre, then App Check utilise le fournisseur local factice, jamais reCAPTCHA', async () => {
  const journal = await demarrer({ natif: true, emulateurs: true });
  assert.ok(!journal.includes('fournisseur:ReCaptchaEnterpriseProvider'), `reCAPTCHA utilisé : ${journal}`);
  assert.ok(journal.includes('fournisseur:CustomProvider'));
  verifierOrdre(journal);
});
