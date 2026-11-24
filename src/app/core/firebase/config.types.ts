// Forme de la configuration Firebase de l'app (PLAN §4). Deux fichiers la fournissent :
// `config.ts` (émulateurs, versionné) et `config.reelle.ts` (généré au build réel, jamais versionné).
export interface ConfigFirebase {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  /** Identifiant de mesure Google Analytics (G-…), facultatif : sans lui, Analytics reste inerte (US 19). */
  measurementId?: string;
}

export interface ConfigApp {
  firebase: ConfigFirebase;
  /** Clé de site reCAPTCHA Enterprise d'App Check ; vide sur les émulateurs. */
  appCheckSiteKey: string;
  /** Identifiant du build, « commit court · date » (ex. « 1970163 · 2026-11-24 ») ; « dev » sur les émulateurs. */
  build: string;
}
