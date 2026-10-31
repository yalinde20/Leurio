// Configuration par défaut : émulateurs Firebase, projet de démonstration (PLAN §4, §11).
// Aucune valeur secrète ni d'un vrai projet ici : `npm run build` remplace ce fichier par
// `config.reelle.ts`, généré depuis les variables FIREBASE_* (scripts/build-reel.mjs).
import type { ConfigApp } from './config.types';

/**
 * Vrai : Auth, Firestore et Storage visent les émulateurs locaux et App Check est en mode débogage.
 * Constante littérale pour que le build réel retire le code réservé aux émulateurs.
 */
export const emulateurs = true;

export const config: ConfigApp = {
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-leurio.firebaseapp.test',
    projectId: 'demo-leurio',
    storageBucket: 'demo-leurio.appspot.test',
    messagingSenderId: '000000000000',
    appId: 'demo-app-id',
  },
  appCheckSiteKey: '',
};

