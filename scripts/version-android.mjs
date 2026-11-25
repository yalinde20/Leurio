// Pipeline Android (US 25, critère 1) : calcule versionCode et versionName, au format $GITHUB_OUTPUT.
// versionCode = minutes écoulées depuis le 2026-01-01 UTC : entier, strictement croissant d'une
// exécution à l'autre, et sous la limite du Play Store (2,1 milliards, atteinte dans des milliers d'années).
// versionName = la balise TAG sans le « v » ; sans TAG (lancement manuel) : la dernière balise du dépôt, sinon 0.0.0-manuel.
// VERSION_DATE (ISO 8601) remplace l'heure courante, pour les tests.
import { execFileSync } from 'node:child_process';

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
/** Dernière balise du dépôt (lancement manuel depuis main), ou null. */
function derniereBalise() {
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const brut = (process.env.TAG?.trim() || derniereBalise() || '0.0.0-manuel').replace(/^v/, '');
// Un nom de balise peut contenir des caractères de shell : on n'accepte qu'une version (chiffres, points, tirets).
if (!/^[0-9A-Za-z.+-]+$/.test(brut)) {
  console.error('Balise invalide pour un versionName (attendu : X.Y.Z).');
  process.exit(1);
}
console.log(`versionCode=${versionCode}`);
console.log(`versionName=${brut}`);
