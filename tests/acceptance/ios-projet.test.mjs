// US 26 : préparation du projet Xcode avant l'archive (scripts/preparer-projet-ios.mjs).
// Le script tourne sur une copie du vrai project.pbxproj, dans un dossier temporaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../helpers/run.mjs';

const SCRIPT = join(ROOT, 'scripts/preparer-projet-ios.mjs');
const TEAM = 'ZZ9TEAMSENTINEL';
const PROFIL = 'Profil Sentinelle "Leurio"';
const PLIST = '<?xml version="1.0"?><plist><dict><key>API_KEY</key><string>cle-sentinelle-Zq9</string></dict></plist>';

function projet() {
  const dir = mkdtempSync(join(tmpdir(), 'leurio-ios-'));
  mkdirSync(join(dir, 'ios/App/App.xcodeproj'), { recursive: true });
  mkdirSync(join(dir, 'ios/App/App'), { recursive: true });
  const pbx = join(dir, 'ios/App/App.xcodeproj/project.pbxproj');
  cpSync(join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj'), pbx);
  return { dir, pbx, original: readFileSync(pbx, 'utf8') };
}
function lancer(pbx, env = {}) {
  const r = spawnSync('node', [SCRIPT], { cwd: ROOT, encoding: 'utf8', timeout: 30_000, env: { PATH: process.env.PATH, PBXPROJ_PATH: pbx, TEAM_ID: TEAM, PROFILE_NAME: PROFIL, ...env } });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
/** Bloc d'une configuration nommée, dans la liste de configurations de la cible App. */
function configs(texte) {
  const cible = /PBXNativeTarget "App" \*\/ = \{[\s\S]*?\n\t\t\};/.exec(texte)?.[0] ?? '';
  const liste = /buildConfigurationList = (\w{24})/.exec(/\n\t\t\w{24} \/\* App \*\/ = \{\n\t\t\tisa = PBXNativeTarget;[\s\S]*?\n\t\t\};/.exec(texte)[0])[1];
  const ids = [...new RegExp(`${liste}[^\\n]*= \\{[\\s\\S]*?buildConfigurations = \\(([\\s\\S]*?)\\);`).exec(texte)[1].matchAll(/(\w{24}) \/\* (\w+) \*\//g)];
  assert.ok(cible);
  const bloc = (id) => new RegExp(`\\n\\t\\t${id}[^\\n]*= \\{\\n[\\s\\S]*?\\n\\t\\t\\};`).exec(texte)[0];
  return Object.fromEntries(ids.map((m) => [m[2], { id: m[1], texte: bloc(m[1]) }]));
}
const occurrences = (texte, motif) => texte.split(motif).length - 1;

test('given le projet Xcode, when on prépare la signature, then la configuration Release de la cible App passe en signature manuelle avec l\'équipe et le profil', () => {
  const { pbx, original } = projet();
  const r = lancer(pbx);
  assert.equal(r.status, 0, r.out);
  const release = configs(readFileSync(pbx, 'utf8')).Release.texte;
  assert.match(release, /CODE_SIGN_STYLE = Manual;/);
  assert.doesNotMatch(release, /CODE_SIGN_STYLE = Automatic/);
  assert.match(release, /CODE_SIGN_IDENTITY = "Apple Distribution";/);
  assert.match(release, new RegExp(`DEVELOPMENT_TEAM = "${TEAM}";`));
  assert.match(release, /PROVISIONING_PROFILE_SPECIFIER = "Profil Sentinelle \\"Leurio\\"";/);
  assert.equal(occurrences(release, 'CODE_SIGN_STYLE'), 1);
  assert.ok(configs(original).Release.texte.includes('CODE_SIGN_STYLE = Automatic;'));
});

test('given le projet Xcode, when on prépare la signature, then la configuration Debug de la cible et les configurations du projet restent inchangées', () => {
  const { pbx, original } = projet();
  assert.equal(lancer(pbx).status, 0);
  const apres = readFileSync(pbx, 'utf8');
  assert.equal(configs(apres).Debug.texte, configs(original).Debug.texte);
  const niveauProjet = /504EC2FF1FED79650016851F[\s\S]*?buildConfigurations = \(([\s\S]*?)\);/.exec(original)[1];
  for (const [, id] of niveauProjet.matchAll(/(\w{24}) \/\*/g)) {
    const bloc = (t) => new RegExp(`\\n\\t\\t${id}[^\\n]*= \\{\\n[\\s\\S]*?\\n\\t\\t\\};`).exec(t)[0];
    assert.equal(bloc(apres), bloc(original));
  }
});

test('given un GoogleService-Info.plist fourni, when on prépare le projet, then le fichier est écrit et référencé une seule fois dans le projet, le groupe App et les ressources de la cible', () => {
  const { dir, pbx } = projet();
  const r = lancer(pbx, { GOOGLE_SERVICE_INFO_PLIST: PLIST });
  assert.equal(r.status, 0, r.out);
  assert.equal(readFileSync(join(dir, 'ios/App/App/GoogleService-Info.plist'), 'utf8').trim(), PLIST);
  const t = readFileSync(pbx, 'utf8');
  assert.equal(occurrences(t, 'isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = GoogleService-Info.plist'), 1);
  assert.equal(occurrences(t, 'GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile'), 1);
  assert.match(t, /isa = PBXGroup;\n\t\t\tchildren = \([^)]*GoogleService-Info\.plist \*\/,[^)]*\);\n\t\t\tpath = App;/);
  const phase = /isa = PBXResourcesBuildPhase;[\s\S]*?\n\t\t\};/.exec(t)[0];
  assert.equal(occurrences(phase, 'GoogleService-Info.plist in Resources'), 1);
  assert.equal(occurrences(t, 'GoogleService-Info.plist */,'), 1);
});

test('given un projet déjà préparé, when on relance la préparation, then rien n\'est dupliqué', () => {
  const { pbx } = projet();
  const env = { GOOGLE_SERVICE_INFO_PLIST: PLIST };
  assert.equal(lancer(pbx, env).status, 0);
  const premier = readFileSync(pbx, 'utf8');
  assert.equal(lancer(pbx, env).status, 0);
  assert.equal(readFileSync(pbx, 'utf8'), premier);
});

test('given aucun GoogleService-Info.plist, when on prépare le projet, then un avertissement le signale et le projet n\'y fait pas référence', () => {
  const { dir, pbx } = projet();
  const r = lancer(pbx);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /::warning::.*GOOGLE_SERVICE_INFO_PLIST.*App Check.*Crashlytics/);
  assert.ok(!readFileSync(pbx, 'utf8').includes('GoogleService-Info.plist'));
  assert.ok(!existsSync(join(dir, 'ios/App/App/GoogleService-Info.plist')));
});

test('given une équipe ou un profil manquant, when on prépare le projet, then le script échoue sans modifier le projet', () => {
  for (const manquant of ['TEAM_ID', 'PROFILE_NAME']) {
    const { pbx, original } = projet();
    const r = lancer(pbx, { [manquant]: '' });
    assert.notEqual(r.status, 0);
    assert.match(r.out, new RegExp(`::error::${manquant}`));
    assert.equal(readFileSync(pbx, 'utf8'), original);
  }
});

test('given la préparation du projet, when elle s\'exécute, then aucune valeur de secret n\'est affichée', () => {
  const { pbx } = projet();
  const r = lancer(pbx, { GOOGLE_SERVICE_INFO_PLIST: PLIST });
  for (const v of [TEAM, PROFIL, 'cle-sentinelle-Zq9']) assert.ok(!r.out.includes(v), 'une valeur est affichée');
});
