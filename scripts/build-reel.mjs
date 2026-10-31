// Build de production réel (PLAN §4) : lit la configuration Firebase dans les variables
// d'environnement FIREBASE_*, échoue en nommant celle qui manque (vide = manquante), écrit
// src/app/core/firebase/config.reelle.ts (ignoré par Git) puis lance `ng build`.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VARIABLES = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_APPCHECK_SITE_KEY',
];

const manquantes = VARIABLES.filter((n) => !process.env[n]?.trim());
if (manquantes.length > 0) {
  console.error(`Build de production impossible : variable(s) d'environnement manquante(s) ou vide(s) : ${manquantes.join(', ')}.`);
  console.error('Pour construire sans elles, avec les émulateurs : npm run build:emulateurs.');
  process.exit(1);
}

const v = (n) => JSON.stringify(process.env[n].trim());
const fichier = fileURLToPath(new URL('../src/app/core/firebase/config.reelle.ts', import.meta.url));
writeFileSync(
  fichier,
  `// Fichier généré par scripts/build-reel.mjs depuis les variables FIREBASE_* : ne pas modifier, ne pas versionner.
import type { ConfigApp } from './config.types';

export const emulateurs = false;

export const config: ConfigApp = {
  firebase: {
    apiKey: ${v('FIREBASE_API_KEY')},
    authDomain: ${v('FIREBASE_AUTH_DOMAIN')},
    projectId: ${v('FIREBASE_PROJECT_ID')},
    storageBucket: ${v('FIREBASE_STORAGE_BUCKET')},
    messagingSenderId: ${v('FIREBASE_MESSAGING_SENDER_ID')},
    appId: ${v('FIREBASE_APP_ID')},
  },
  appCheckSiteKey: ${v('FIREBASE_APPCHECK_SITE_KEY')},
};
`,
);

const r = spawnSync('npx', ['ng', 'build', '--configuration', 'production'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
