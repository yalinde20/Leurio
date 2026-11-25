// US 26 : pipeline iOS vers TestFlight.
// Aucun appel réseau, pas de Xcode : on lit les workflows et on exécute les deux scripts avec un environnement contrôlé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../helpers/run.mjs';

const IOS = '.github/workflows/ios-testflight.yml';
const RELEASE_PLEASE = '.github/workflows/release-please.yml';
const SECRETS_SCRIPT = 'scripts/verifier-secrets-ios.mjs';
const VERSION_SCRIPT = 'scripts/version-ios.mjs';

const SECRETS_IOS = ['IOS_CERTIFICATE_P12_BASE64', 'IOS_CERTIFICATE_PASSWORD', 'IOS_PROVISIONING_PROFILE_BASE64', 'APP_STORE_CONNECT_API_KEY_ID', 'APP_STORE_CONNECT_API_ISSUER_ID', 'APP_STORE_CONNECT_API_KEY_P8'];
const SECRETS_FIREBASE = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID', 'FIREBASE_APPCHECK_SITE_KEY'];
const TOUS = [...SECRETS_IOS, ...SECRETS_FIREBASE];

const ENVOI = /xcrun altool[^\n]*--upload-app|upload-testflight-build|xcrun iTMSTransporter|apple-actions\/upload-testflight-build/;

const lire = (rel) => {
  const f = join(ROOT, rel);
  if (!existsSync(f)) throw new Error(`${rel} est absent`);
  return readFileSync(f, 'utf8');
};
const indent = (l) => l.length - l.trimStart().length;
const signif = (l) => l.trim() !== '' && !l.trim().startsWith('#');

/** Jobs : { nom: { needs: [...], head, steps: [texte brut de chaque étape] } } */
function jobs(text) {
  const lines = text.split('\n');
  const i0 = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  assert.ok(i0 >= 0, 'section jobs: absente');
  const out = {};
  let cur = null;
  let stepIndent = null;
  let inSteps = false;
  for (let i = i0 + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!signif(l)) continue;
    if (indent(l) === 0) break;
    if (indent(l) === 2 && /^\s{2}[\w-]+:\s*$/.test(l)) {
      cur = { nom: l.trim().slice(0, -1), needs: [], head: [], steps: [] };
      out[cur.nom] = cur; inSteps = false; stepIndent = null; continue;
    }
    if (!cur) continue;
    if (indent(l) === 4 && /^steps:\s*$/.test(l.trim())) { inSteps = true; continue; }
    if (inSteps && indent(l) > 4) {
      if (stepIndent === null) stepIndent = indent(l);
      if (indent(l) === stepIndent && l.trim().startsWith('- ')) cur.steps.push(l);
      else cur.steps[cur.steps.length - 1] += `\n${l}`;
      continue;
    }
    if (indent(l) === 4) { inSteps = false; cur.head.push(l); }
    else if (!inSteps) cur.head.push(l);
  }
  for (const j of Object.values(out)) {
    const headText = j.head.join('\n');
    const m = headText.match(/^\s{4}needs:\s*(.*)$/m);
    if (m) {
      const inline = m[1].replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
      j.needs = inline.length ? inline : [...headText.slice(headText.indexOf(m[0])).split('\n').slice(1).join('\n').matchAll(/^\s{6}- (\S+)/gm)].map((x) => x[1]);
    }
    j.text = headText + '\n' + j.steps.join('\n');
  }
  return out;
}

/** Étapes dans l'ordre d'exécution pour le job qui contient l'envoi (jobs requis d'abord). */
function sequenceJusquaEnvoi(text) {
  const js = jobs(text);
  const envoi = Object.values(js).find((j) => j.steps.some((s) => ENVOI.test(s)));
  assert.ok(envoi, 'aucun job n\'envoie sur TestFlight (xcrun altool --upload-app ou équivalent)');
  const vus = new Set();
  const seq = [];
  const visiter = (j) => {
    if (vus.has(j.nom)) return;
    vus.add(j.nom);
    for (const n of j.needs) if (js[n]) visiter(js[n]);
    for (const s of j.steps) seq.push({ job: j.nom, step: s });
  };
  visiter(envoi);
  return seq;
}

const indexOfStep = (seq, re) => seq.findIndex((x) => re.test(x.step));

function lancer(script, env, args = []) {
  const r = spawnSync('node', [join(ROOT, script), ...args], { cwd: ROOT, encoding: 'utf8', timeout: 30_000, env: { PATH: process.env.PATH, ...env } });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, stdout: r.stdout ?? '' };
}
const secretsComplets = () => Object.fromEntries(TOUS.map((n) => [n, `valeur-sentinelle-${n.toLowerCase()}-Zq9`]));
const numero = (r) => Number(r.stdout.match(/^buildNumber\s*=\s*(\d+)\s*$/m)?.[1]);

// ---------- Critère 1 : release publiée depuis main -> version iOS signée, numéro de build croissant, TestFlight

test('critère 1 : given une release publiée depuis main, when le pipeline iOS s\'exécute, then il se déclenche sur release published, seulement pour main, sur un runner macOS', () => {
  const t = lire(IOS);
  assert.match(t, /^name:\s*iOS TestFlight\s*$/m, 'le workflow doit s\'appeler « iOS TestFlight »');
  assert.match(t, /^\s+release:\s*\n\s+types:\s*\[\s*published\s*\]/m, 'déclencheur release: types: [published] absent');
  assert.match(t, /target_commitish\s*==\s*'main'/, 'la condition github.event.release.target_commitish == \'main\' est absente');
  assert.match(t, /refs\/heads\/main/, 'le lancement manuel depuis main doit être permis');
  assert.match(t, /refs\/tags\//, 'le lancement manuel depuis une balise doit être permis');
  assert.match(t, /runs-on:\s*macos-/, 'un build iOS exige un runner macOS');
});

test('critère 1 : given le pipeline, when il démarre, then il vérifie que le commit vient de main', () => {
  const seq = sequenceJusquaEnvoi(lire(IOS));
  const i = indexOfStep(seq, /git merge-base --is-ancestor HEAD origin\/main/);
  assert.ok(i >= 0, 'étape « Le commit vient de main » absente');
  assert.match(seq[i].step, /Le commit vient de main/);
  assert.ok(i < indexOfStep(seq, /npm ci/), 'la vérification doit précéder npm ci');
  assert.ok(i < indexOfStep(seq, ENVOI), 'la vérification doit précéder l\'envoi');
});

test('critère 1 : given une release créée par release-please, when elle est créée, then release-please.yml appelle ios-testflight.yml avec la balise et les secrets', () => {
  const rp = lire(RELEASE_PLEASE);
  const js = jobs(rp);
  const appel = Object.values(js).find((j) => /uses:\s*\.\/\.github\/workflows\/ios-testflight\.yml/.test(j.text));
  assert.ok(appel, 'appel de ios-testflight.yml absent');
  assert.match(appel.text, /release_created\s*==\s*'true'/, 'l\'appel doit être conditionné par release_created == \'true\'');
  assert.match(appel.text, /secrets:\s*inherit/, 'secrets: inherit absent');
  assert.match(appel.text, /tag:\s*\$\{\{[^}]*tag_name[^}]*\}\}/, 'la balise (tag) n\'est pas transmise');
  assert.ok(appel.needs.includes('release-please'), 'le job doit dépendre de release-please');
  assert.match(rp, /android-play\.yml/, 'l\'appel Android existant doit rester');
  const t = lire(IOS);
  assert.match(t, /workflow_call:[\s\S]*?inputs:[\s\S]*?tag:[\s\S]*?type:\s*string/, 'workflow_call doit avoir une entrée tag de type string');
});

test('critère 1 : given le pipeline, when il construit, then la chaîne est build de production -> cap sync -> archive signée -> export .ipa -> envoi TestFlight', () => {
  const t = lire(IOS);
  const seq = sequenceJusquaEnvoi(t);
  const iBuild = indexOfStep(seq, /run:\s*npm run build\b(?!:)/);
  const iSync = indexOfStep(seq, /npm run cap:sync/);
  const iArchive = indexOfStep(seq, /xcodebuild[^\n]*\barchive\b|xcodebuild[\s\S]*?\\\s*\n[\s\S]*?\barchive\b/);
  const iExport = indexOfStep(seq, /xcodebuild[^\n]*-exportArchive/);
  const iUp = indexOfStep(seq, ENVOI);
  assert.ok(iBuild >= 0, 'npm run build (production) absent');
  assert.ok(iSync > iBuild, 'npm run cap:sync doit suivre le build');
  assert.ok(iArchive > iSync, 'xcodebuild archive doit suivre cap:sync');
  assert.ok(iExport > iArchive, 'xcodebuild -exportArchive doit suivre l\'archive');
  assert.ok(iUp > iExport, 'l\'envoi doit suivre l\'export');
  assert.match(t, /\.ipa/, 'le pipeline doit produire un .ipa');
  for (const n of SECRETS_FIREBASE) assert.match(t, new RegExp(`secrets\\.${n}`), `${n} n'est pas passé au build`);
});

test('critère 1 : given la version iOS, when elle est signée, then le certificat, le profil et la clé App Store Connect viennent des secrets', () => {
  const t = lire(IOS);
  for (const n of SECRETS_IOS) assert.match(t, new RegExp(`secrets\\.${n}\\b`), `${n} n'est pas utilisé`);
  assert.match(t, /security\s+(create-keychain|import)/, 'le certificat doit être importé dans un trousseau temporaire');
  assert.match(t, /Provisioning Profiles/, 'le profil doit être installé dans ~/Library/MobileDevice/Provisioning Profiles');
});

test('critère 1 : given le pipeline, when la version iOS est construite, then CFBundleVersion et CFBundleShortVersionString viennent de scripts/version-ios.mjs', () => {
  const t = lire(IOS);
  assert.match(t, /version-ios\.mjs/, 'le script de version n\'est pas appelé');
  assert.match(t, /steps\.\w+\.outputs\.buildNumber/, 'buildNumber n\'est pas relu');
  assert.match(t, /steps\.\w+\.outputs\.versionName/, 'versionName n\'est pas relu');
  assert.match(t, /CURRENT_PROJECT_VERSION=/, 'xcodebuild doit recevoir CURRENT_PROJECT_VERSION (numéro de build)');
  assert.match(t, /MARKETING_VERSION=/, 'xcodebuild doit recevoir MARKETING_VERSION (version affichée)');
});

test('critère 1 : given deux dates successives, when on calcule le numéro de build, then il est entier, strictement croissant et plus grand que le précédent', () => {
  const a = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-03-01T10:00:00Z', TAG: 'v1.2.3' });
  const b = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-03-01T10:01:00Z', TAG: 'v1.2.3' });
  const c = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-11-25T08:30:00Z', TAG: 'v1.3.0' });
  for (const r of [a, b, c]) assert.equal(r.status, 0, r.out);
  assert.ok(Number.isInteger(numero(a)) && numero(a) > 0, `buildNumber illisible : ${a.stdout}`);
  assert.ok(numero(b) > numero(a), 'une minute plus tard, le numéro doit être supérieur');
  assert.ok(numero(c) > numero(b));
  assert.equal(numero(a), Math.floor((Date.parse('2026-03-01T10:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 60000));
  assert.ok(numero(c) <= 2_100_000_000);
});

test('critère 1 : given un tag vX.Y.Z, when on calcule la version, then versionName est X.Y.Z (le v est retiré)', () => {
  const r = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-03-01T10:00:00Z', TAG: 'v1.2.3' });
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /^versionName\s*=\s*1\.2\.3\s*$/m);
});

test('critère 1 : given un tag qui n\'est pas une version, when on calcule la version, then le script échoue', () => {
  lire(VERSION_SCRIPT);
  const r = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-03-01T10:00:00Z', TAG: 'v1.2.3; rm -rf /' });
  assert.notEqual(r.status, 0, 'une balise avec des caractères de shell doit être refusée');
});

// ---------- Critère 2 : lancement à la main

test('critère 2 : given le pipeline iOS, when le propriétaire le lance à la main, then workflow_dispatch existe et la chaîne de build et d\'envoi est la même', () => {
  const t = lire(IOS);
  assert.match(t, /^\s+workflow_dispatch:/m, 'déclencheur workflow_dispatch absent');
  const seq = sequenceJusquaEnvoi(t);
  assert.ok(indexOfStep(seq, /-exportArchive/) >= 0 && indexOfStep(seq, ENVOI) > indexOfStep(seq, /-exportArchive/));
  const envois = t.split('\n').filter((l) => /xcrun altool[^\n]*--upload-app|upload-testflight-build/.test(l) && !l.trim().startsWith('#'));
  assert.equal(envois.length, 1, 'un seul envoi : même version quel que soit le déclencheur');
});

test('critère 2 : given un lancement manuel pour la même release, when on calcule la version, then versionName est identique et le numéro de build reste croissant', () => {
  const a = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-05-01T00:00:00Z', TAG: 'v2.0.0' });
  const b = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-05-01T00:05:00Z', TAG: 'v2.0.0' });
  assert.equal(a.status, 0, a.out);
  assert.equal(b.status, 0, b.out);
  assert.equal(a.stdout.match(/^versionName=.*$/m)?.[0], 'versionName=2.0.0');
  assert.equal(b.stdout.match(/^versionName=.*$/m)?.[0], 'versionName=2.0.0');
  assert.ok(numero(b) > numero(a));
});

test('critère 2 : given un lancement manuel sans tag, when on calcule la version, then le script donne quand même un numéro croissant et un versionName', () => {
  const a = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-05-01T00:00:00Z' });
  const b = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-05-01T00:05:00Z' });
  assert.equal(a.status, 0, a.out);
  assert.equal(b.status, 0, b.out);
  assert.ok(numero(b) > numero(a));
  assert.match(a.stdout, /^versionName\s*=\s*\S+/m);
});

// ---------- Critère 3 : vérifications en échec -> aucun envoi

test('critère 3 : given le lint, le type check ou les tests, when le pipeline iOS s\'exécute, then ils tournent avant l\'archive et l\'envoi', () => {
  const seq = sequenceJusquaEnvoi(lire(IOS));
  const iUp = indexOfStep(seq, ENVOI);
  const iArchive = indexOfStep(seq, /xcodebuild/);
  assert.ok(iArchive >= 0, 'xcodebuild absent');
  for (const cmd of ['npm run lint', 'npm run typecheck', 'npm test', 'npm run validate-data']) {
    const i = indexOfStep(seq, new RegExp(`run:\\s*${cmd}\\s*$`, 'm'));
    assert.ok(i >= 0, `${cmd} absent du pipeline iOS`);
    assert.ok(i < iArchive && i < iUp, `${cmd} doit précéder l'archive et l'envoi`);
  }
  assert.ok(indexOfStep(seq, /npm ci/) >= 0);
});

test('critère 3 : given une vérification qui échoue, when le pipeline iOS s\'exécute, then aucune étape n\'ignore l\'échec (continue-on-error, if: always())', () => {
  const t = lire(IOS);
  assert.doesNotMatch(t, /continue-on-error/, 'continue-on-error interdit');
  assert.doesNotMatch(t, /if:\s*(\$\{\{\s*)?(always|failure|cancelled)\(\)/, 'if: always()/failure()/cancelled() interdit');
  assert.ok(indexOfStep(sequenceJusquaEnvoi(t), ENVOI) >= 0);
});

// ---------- Critère 4 : secrets manquants

test('critère 4 : given le pipeline iOS, when il démarre, then la vérification des secrets précède tout build et reçoit tous les secrets en env', () => {
  const seq = sequenceJusquaEnvoi(lire(IOS));
  const iCheck = indexOfStep(seq, /node scripts\/verifier-secrets-ios\.mjs/);
  assert.ok(iCheck >= 0, 'l\'étape verifier-secrets-ios.mjs est absente');
  for (const re of [/npm ci/, /npm run lint/, /npm run build\b/, /security\s/, /xcodebuild/, ENVOI]) {
    assert.ok(iCheck < indexOfStep(seq, re), `les secrets se vérifient avant ${re}`);
  }
  const avant = seq.slice(0, iCheck).filter((x) => /run:/.test(x.step));
  assert.deepEqual(avant, [], 'aucune commande ne doit précéder la vérification des secrets');
  for (const n of TOUS) assert.match(seq[iCheck].step, new RegExp(`${n}:\\s*\\$\\{\\{\\s*secrets\\.${n}\\s*\\}\\}`), `${n} non transmis à la vérification`);
});

test('critère 4 : given tous les secrets présents, when on lance la vérification iOS, then elle réussit et n\'affiche aucune valeur', () => {
  const env = secretsComplets();
  const r = lancer(SECRETS_SCRIPT, env);
  assert.equal(r.status, 0, r.out);
  for (const v of Object.values(env)) assert.ok(!r.out.includes(v), 'une valeur de secret est affichée');
});

for (const nom of TOUS) {
  test(`critère 4 : given le secret ${nom} manquant, when on lance la vérification iOS, then elle échoue en nommant ${nom} sans afficher aucune valeur`, () => {
    const env = secretsComplets();
    delete env[nom];
    const r = lancer(SECRETS_SCRIPT, env);
    assert.notEqual(r.status, 0, 'la vérification doit échouer');
    assert.match(r.out, new RegExp(`::error::.*${nom}\\b|Secret manquant : ${nom}\\b`));
    for (const v of Object.values(env)) assert.ok(!r.out.includes(v), 'une valeur de secret est affichée');
  });
}

test('critère 4 : given un secret vide et un autre blanc, when on lance la vérification iOS, then les deux sont signalés comme manquants', () => {
  const env = { ...secretsComplets(), IOS_CERTIFICATE_PASSWORD: '', APP_STORE_CONNECT_API_KEY_P8: '   ' };
  const r = lancer(SECRETS_SCRIPT, env);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /IOS_CERTIFICATE_PASSWORD/);
  assert.match(r.out, /APP_STORE_CONNECT_API_KEY_P8/);
  for (const v of Object.values(secretsComplets())) assert.ok(!r.out.includes(v));
});

test('critère 4 : given plusieurs secrets manquants, when on lance la vérification iOS, then tous sont nommés en une seule exécution', () => {
  const env = secretsComplets();
  delete env.IOS_PROVISIONING_PROFILE_BASE64;
  delete env.APP_STORE_CONNECT_API_KEY_ID;
  const r = lancer(SECRETS_SCRIPT, env);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /IOS_PROVISIONING_PROFILE_BASE64/);
  assert.match(r.out, /APP_STORE_CONNECT_API_KEY_ID/);
});
