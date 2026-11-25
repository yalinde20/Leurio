// Pipeline Android (US 25, critère 1) : calcule versionCode et versionName, au format $GITHUB_OUTPUT.
// versionCode = minutes écoulées depuis le 2026-01-01 UTC : entier, strictement croissant d'une
// exécution à l'autre, et sous la limite du Play Store (2,1 milliards, atteinte dans des milliers d'années).
// versionName = la balise TAG sans le « v » ; sans balise (lancement manuel) : 0.0.0-manuel.
// VERSION_DATE (ISO 8601) remplace l'heure courante, pour les tests.
const ORIGINE = Date.parse('2026-01-01T00:00:00Z');
const maintenant = process.env.VERSION_DATE?.trim() ? Date.parse(process.env.VERSION_DATE.trim()) : Date.now();
if (Number.isNaN(maintenant)) {
  console.error('VERSION_DATE n\'est pas une date ISO 8601 valide.');
  process.exit(1);
}
const versionCode = Math.floor((maintenant - ORIGINE) / 60000);
if (versionCode < 1) {
  console.error('La date est antérieure au 2026-01-01 : versionCode invalide.');
  process.exit(1);
}
const tag = process.env.TAG?.trim().replace(/^v/, '');
console.log(`versionCode=${versionCode}`);
console.log(`versionName=${tag || '0.0.0-manuel'}`);
