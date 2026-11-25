// Pipeline iOS (US 26) : prépare ios/App/App.xcodeproj avant l'archive, sans toucher au projet commité.
// 1. Signature manuelle limitée à la configuration Release de la cible App (TEAM_ID et PROFILE_NAME, lus
//    dans le profil de provisionnement). Passée sur la ligne de commande, elle s'appliquerait aussi aux cibles
//    des paquets SPM (firebase-ios-sdk), qui refusent un profil de provisionnement.
// 2. GOOGLE_SERVICE_INFO_PLIST (facultatif) : écrit GoogleService-Info.plist à côté d'Info.plist et l'ajoute aux
//    ressources de la cible App ; sans lui, App Check et Crashlytics restent inactifs (avertissement).
// PBXPROJ_PATH remplace le chemin du project.pbxproj (tests). Les valeurs ne sont jamais affichées.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const chemin = process.env.PBXPROJ_PATH?.trim() || 'ios/App/App.xcodeproj/project.pbxproj';
const equipe = process.env.TEAM_ID?.trim();
const profil = process.env.PROFILE_NAME?.trim();
const plist = process.env.GOOGLE_SERVICE_INFO_PLIST ?? '';
const NOM_PLIST = 'GoogleService-Info.plist';

function echec(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}
if (!equipe) echec('TEAM_ID manquant : l\'identifiant d\'équipe n\'a pas pu être lu dans le profil de provisionnement.');
if (!profil) echec('PROFILE_NAME manquant : le nom du profil n\'a pas pu être lu dans le profil de provisionnement.');

const quote = (v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/** Identifiant de 24 caractères hexadécimaux, stable (donc idempotent). */
const identifiant = (nom) => createHash('sha1').update(`leurio-ios-${nom}`).digest('hex').slice(0, 24).toUpperCase();

let p = readFileSync(chemin, 'utf8');

/** Texte d'un objet du projet (de son identifiant à sa fermeture) et sa position. */
function bloc(id) {
  const m = new RegExp(`\\n\\t\\t${id}[^\\n]*= \\{\\n[\\s\\S]*?\\n\\t\\t\\};`).exec(p);
  if (!m) echec(`Objet ${id} introuvable dans le projet Xcode.`);
  return { texte: m[0], debut: m.index };
}
function remplacer(ancien, nouveau) {
  p = p.replace(ancien, () => nouveau);
}

// La cible App, sa liste de configurations, sa configuration Release et sa phase Ressources.
const cible = /\n\t\t(\w{24}) \/\* App \*\/ = \{\n\t\t\tisa = PBXNativeTarget;[\s\S]*?\n\t\t\};/.exec(p);
if (!cible) echec('Cible App introuvable dans le projet Xcode.');
const listeId = /buildConfigurationList = (\w{24})/.exec(cible[0])?.[1];
const phasesTexte = /buildPhases = \(([\s\S]*?)\);/.exec(cible[0])?.[1] ?? '';
const phaseRessources = [...phasesTexte.matchAll(/(\w{24}) \/\* [^*]* \*\//g)].map((m) => m[1]).find((id) => new RegExp(`\\n\\t\\t${id}[^\\n]*= \\{\\n\\t\\t\\tisa = PBXResourcesBuildPhase;`).test(p));
const configs = /buildConfigurations = \(([\s\S]*?)\);/.exec(bloc(listeId).texte)?.[1] ?? '';
const releaseId = [...configs.matchAll(/(\w{24}) \/\* (\w+) \*\//g)].find((m) => m[2] === 'Release')?.[1];
if (!releaseId || !phaseRessources) echec('Configuration Release ou phase Ressources de la cible App introuvable.');

// 1. Signature manuelle (Release de la cible App uniquement).
const release = bloc(releaseId).texte;
const reglages = ['CODE_SIGN_IDENTITY', 'CODE_SIGN_STYLE', 'DEVELOPMENT_TEAM', 'PROVISIONING_PROFILE_SPECIFIER'];
let nouvelle = release;
for (const r of reglages) nouvelle = nouvelle.replace(new RegExp(`\\n\\t\\t\\t\\t${r}( \\[[^\\]]*\\])? = [^\\n]*;`, 'g'), '');
nouvelle = nouvelle.replace(
  '\n\t\t\tbuildSettings = {',
  () => `\n\t\t\tbuildSettings = {\n\t\t\t\tCODE_SIGN_IDENTITY = ${quote('Apple Distribution')};\n\t\t\t\tCODE_SIGN_STYLE = Manual;\n\t\t\t\tDEVELOPMENT_TEAM = ${quote(equipe)};\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = ${quote(profil)};`,
);
remplacer(release, nouvelle);
console.log('Signature manuelle appliquée à la configuration Release de la cible App.');

// 2. GoogleService-Info.plist (facultatif).
if (!plist.trim()) {
  console.log('::warning::Secret GOOGLE_SERVICE_INFO_PLIST absent : App Check et Crashlytics seront inactifs dans cette version.');
} else {
  // ios/App/App.xcodeproj/project.pbxproj -> ios/App/App/
  writeFileSync(join(dirname(dirname(chemin)), 'App', NOM_PLIST), plist.endsWith('\n') ? plist : `${plist}\n`);
  if (p.includes(NOM_PLIST)) {
    console.log(`${NOM_PLIST} est déjà référencé dans le projet.`);
  } else {
    const ref = identifiant('fileref');
    const fichier = identifiant('buildfile');
    const groupe = /\n\t\t\w{24} \/\* App \*\/ = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n[\s\S]*?\n\t\t\t\);\n\t\t\tpath = App;/.exec(p);
    if (!groupe) echec('Groupe App introuvable dans le projet Xcode.');
    remplacer(groupe[0], groupe[0].replace('\n\t\t\t);\n\t\t\tpath = App;', `\n\t\t\t\t${ref} /* ${NOM_PLIST} */,\n\t\t\t);\n\t\t\tpath = App;`));
    remplacer('/* End PBXFileReference section */', `\t\t${ref} /* ${NOM_PLIST} */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = ${NOM_PLIST}; sourceTree = "<group>"; };\n/* End PBXFileReference section */`);
    remplacer('/* End PBXBuildFile section */', `\t\t${fichier} /* ${NOM_PLIST} in Resources */ = {isa = PBXBuildFile; fileRef = ${ref} /* ${NOM_PLIST} */; };\n/* End PBXBuildFile section */`);
    const phase = bloc(phaseRessources).texte;
    remplacer(phase, phase.replace('\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing', `\n\t\t\t\t${fichier} /* ${NOM_PLIST} in Resources */,\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing`));
    console.log(`${NOM_PLIST} ajouté aux ressources de la cible App.`);
  }
}
writeFileSync(chemin, p);
