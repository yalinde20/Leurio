// US 131 : App Check s'initialise avec reCAPTCHA Enterprise (et plus reCAPTCHA v3 classique).
// firebase.service.ts est empaqueté par esbuild avec des doubles pour ./config, Angular et firebase/* : aucun réseau,
// aucun appel à reCAPTCHA. Le vrai module est exécuté ; seuls ses imports sont remplacés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { ROOT } from '../helpers/run.mjs';

const DOUBLES = `
const journal = (globalThis.__journalAppCheck = { appels: [], construits: [] });
const fab = (classe) => class { constructor(arg) { journal.construits.push({ classe, arg }); } };
export const CustomProvider = fab('CustomProvider');
export const ReCaptchaV3Provider = fab('ReCaptchaV3Provider');
export const ReCaptchaEnterpriseProvider = fab('ReCaptchaEnterpriseProvider');
export const initializeAppCheck = (_app, options) => { journal.appels.push(options); return {}; };
`;

/** Instancie FirebaseService avec `emulateurs` et la clé donnés ; rend ce qui a été construit. */
async function instancier(emulateurs, cle) {
  globalThis.__journalAppCheck = undefined;
  const dir = mkdtempSync(join(tmpdir(), 'us131-'));
  const ecrire = (nom, code) => { writeFileSync(join(dir, nom), code); return join(dir, nom); };
  const appCheck = ecrire('app-check.mjs', DOUBLES);
  const remplacements = {
    './config': ecrire('config.mjs', `export const emulateurs = ${emulateurs};
export const config = { firebase: { apiKey: 'k', authDomain: 'd', projectId: 'p', storageBucket: 'b', messagingSenderId: '0', appId: 'a' }, appCheckSiteKey: ${JSON.stringify(cle)} };`),
    '@angular/core': ecrire('core.mjs', 'export const Injectable = () => (c) => c;'),
    './hook-test': ecrire('hook.mjs', 'export const exposerPourLesTests = () => {};'),
    'firebase/app-check': appCheck,
    'firebase/app': ecrire('app.mjs', 'export const initializeApp = () => ({});'),
    'firebase/auth': ecrire('auth.mjs', 'export const getAuth = () => ({}); export const connectAuthEmulator = () => {};'),
    'firebase/firestore': ecrire('fs.mjs', 'export const initializeFirestore = () => ({}); export const persistentLocalCache = () => ({}); export const persistentMultipleTabManager = () => ({}); export const connectFirestoreEmulator = () => {};'),
    'firebase/storage': ecrire('st.mjs', 'export const getStorage = () => ({}); export const connectStorageEmulator = () => {};'),
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
    return globalThis.__journalAppCheck;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('critère 1 : given le mode production avec une clé de site, when Firebase est initialisé, then App Check utilise le fournisseur reCAPTCHA Enterprise avec cette clé', async () => {
  const j = await instancier(false, 'cle-de-site-enterprise');
  assert.deepEqual(j.construits, [{ classe: 'ReCaptchaEnterpriseProvider', arg: 'cle-de-site-enterprise' }]);
  assert.equal(j.appels.length, 1);
  assert.equal(j.appels[0].isTokenAutoRefreshEnabled, true);
});

test('critère 1 : given le mode production, when Firebase est initialisé, then le fournisseur reCAPTCHA v3 classique n\'est pas utilisé', async () => {
  const j = await instancier(false, 'cle-de-site-enterprise');
  assert.ok(!j.construits.some((c) => c.classe === 'ReCaptchaV3Provider'), 'ReCaptchaV3Provider est encore construit');
});

test('critère 2 : given le mode émulateurs, when Firebase est initialisé, then App Check utilise le fournisseur de débogage local (non-régression)', async () => {
  const j = await instancier(true, '');
  assert.deepEqual(j.construits.map((c) => c.classe), ['CustomProvider']);
  assert.equal(j.appels[0].isTokenAutoRefreshEnabled, false);
});
