// Forme de la configuration Firebase de l'app (PLAN §4). Deux fichiers la fournissent :
// `config.ts` (émulateurs, versionné) et `config.reelle.ts` (généré au build réel, jamais versionné).
export interface ConfigFirebase {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface ConfigApp {
  firebase: ConfigFirebase;
  /** Clé de site reCAPTCHA v3 d'App Check ; vide sur les émulateurs. */
  appCheckSiteKey: string;
}
