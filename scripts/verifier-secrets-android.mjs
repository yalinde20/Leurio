// Pipeline Android (US 25, critère 4) : vérifie que tous les secrets nécessaires sont fournis
// (variables d'environnement). Échoue en nommant chaque secret manquant ou vide, sans jamais afficher de valeur.
const SECRETS = [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
  'PLAY_SERVICE_ACCOUNT_JSON',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_APPCHECK_SITE_KEY',
];

const manquants = SECRETS.filter((n) => !process.env[n]?.trim());
if (manquants.length > 0) {
  for (const n of manquants) console.error(`Secret manquant : ${n}`);
  console.error('Crée-le dans Settings > Secrets and variables > Actions du dépôt, puis relance le pipeline.');
  process.exit(1);
}
console.log('Tous les secrets du pipeline Android sont présents.');
