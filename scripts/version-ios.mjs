// Pipeline iOS (US 26, critère 1) : calcule buildNumber (CFBundleVersion) et versionName (CFBundleShortVersionString),
// au format $GITHUB_OUTPUT.
// buildNumber = minutes écoulées depuis le 2026-01-01 UTC : entier, strictement croissant d'une exécution à l'autre
// (App Store Connect exige un numéro supérieur au précédent pour une même version).
// versionName = la balise TAG sans le « v » ; sans TAG (lancement manuel) : la dernière balise du dépôt, sinon 0.0.0.
// Une balise qui n'est pas X.Y.Z (avec ou sans suffixe) fait échouer le script.
// Apple n'accepte que des nombres séparés par des points : un suffixe de pré-version (-rc.1, +build) est retiré.
// VERSION_DATE (ISO 8601) remplace l'heure courante, pour les tests.
import { execFileSync } from 'node:child_process';

const ORIGINE = Date.parse('2026-01-01T00:00:00Z');
const maintenant = process.env.VERSION_DATE?.trim() ? Date.parse(process.env.VERSION_DATE.trim()) : Date.now();
if (Number.isNaN(maintenant)) {
  console.error('VERSION_DATE n\'est pas une date ISO 8601 valide.');
  process.exit(1);
}
const buildNumber = Math.floor((maintenant - ORIGINE) / 60000);
if (buildNumber < 1) {
  console.error('La date est antérieure au 2026-01-01 : buildNumber invalide.');
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

const balise = process.env.TAG?.trim() || derniereBalise();
const brut = (balise ?? '0.0.0').replace(/^v/, '');
// Un nom de balise peut contenir des caractères de shell : on n'accepte qu'une version (chiffres, lettres, points, tirets).
if (!/^[0-9A-Za-z.+-]+$/.test(brut)) {
  console.error('Balise invalide pour un versionName (attendu : X.Y.Z).');
  process.exit(1);
}
const versionName = brut.match(/^\d+\.\d+\.\d+/)?.[0];
if (!versionName) {
  console.error(`::error::La balise « ${balise} » n'est pas une version X.Y.Z : Apple refuse une autre version affichée.`);
  process.exit(1);
}
console.log(`buildNumber=${buildNumber}`);
console.log(`versionName=${versionName}`);
