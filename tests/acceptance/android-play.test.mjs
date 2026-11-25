// US 25 : pipeline Android vers la piste de test interne du Play Store.
// Aucun appel réseau, pas de Gradle : on lit les workflows et on exécute les deux scripts avec un environnement contrôlé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../helpers/run.mjs';

const PLAY = '.github/workflows/android-play.yml';
const RELEASE_PLEASE = '.github/workflows/release-please.yml';
const SECRETS_SCRIPT = 'scripts/verifier-secrets-android.mjs';
const VERSION_SCRIPT = 'scripts/version-android.mjs';
const GRADLE = 'android/app/build.gradle';

const SECRETS_ANDROID = ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD', 'PLAY_SERVICE_ACCOUNT_JSON'];
const SECRETS_FIREBASE = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID', 'FIREBASE_APPCHECK_SITE_KEY'];
const TOUS = [...SECRETS_ANDROID, ...SECRETS_FIREBASE];

const lire = (rel) => {
  const f = join(ROOT, rel);
  if (!existsSync(f)) throw new Error(`${rel} est absent`);
  return readFileSync(f, 'utf8');
};
const indent = (l) => l.length - l.trimStart().length;
const signif = (l) => l.trim() !== '' && !l.trim().startsWith('#');

/** Jobs : { nom: { needs: [...], ifCond, uses, steps: [texte brut de chaque étape] } } */
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
    if (!signif(l)) { if (cur && inSteps && l.trim() === '' ) continue; continue; }
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
  const envoi = Object.values(js).find((j) => j.steps.some((s) => /upload-google-play/.test(s)));
  assert.ok(envoi, 'aucun job n\'utilise upload-google-play');
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

// ---------- Critère 1 : release publiée depuis main -> bundle signé, version croissante, piste interne

test('critère 1 : given une release publiée à la main depuis main, when le pipeline Android s\'exécute, then il se déclenche sur release published et seulement pour main', () => {
  const t = lire(PLAY);
  assert.match(t, /^\s+release:\s*\n\s+types:\s*\[\s*published\s*\]/m, 'déclencheur release: types: [published] absent');
  assert.match(t, /target_commitish\s*==\s*'main'/, 'la condition github.event.release.target_commitish == \'main\' est absente');
});

test('critère 1 : given une release créée par release-please (GITHUB_TOKEN ne déclenche pas d\'autre workflow), when elle est créée, then release-please.yml appelle android-play.yml avec la balise et les secrets', () => {
  const rp = lire(RELEASE_PLEASE);
  assert.match(rp, /release_created/, 'sortie release_created absente');
  assert.match(rp, /tag_name/, 'sortie tag_name absente');
  assert.match(rp, /\bid:\s*\w+/, 'l\'étape release-please doit avoir un id');
  assert.match(rp, /uses:\s*\.\/\.github\/workflows\/android-play\.yml/, 'appel de android-play.yml absent');
  assert.match(rp, /release_created\s*==\s*'true'/, 'l\'appel doit être conditionné par release_created == \'true\'');
  assert.match(rp, /secrets:\s*inherit/, 'secrets: inherit absent');
  assert.match(rp, /tag:\s*\$\{\{[^}]*tag_name[^}]*\}\}/, 'la balise (tag) n\'est pas transmise');
  const pl = lire(PLAY);
  assert.match(pl, /workflow_call:/, 'android-play.yml doit accepter workflow_call');
  assert.match(pl, /workflow_call:[\s\S]*?inputs:[\s\S]*?tag:[\s\S]*?type:\s*string/, 'workflow_call doit avoir une entrée tag de type string');
});

test('critère 1 : given le pipeline, when il construit, then la chaîne est build de production -> cap sync -> bundleRelease signé -> envoi sur la piste internal de app.leurio', () => {
  const seq = sequenceJusquaEnvoi(lire(PLAY));
  const iBuild = indexOfStep(seq, /run:\s*npm run build\b(?!:)/);
  const iSync = indexOfStep(seq, /npm run cap:sync/);
  const iBundle = indexOfStep(seq, /\.\/gradlew[^\n]*bundleRelease/);
  const iUp = indexOfStep(seq, /upload-google-play/);
  assert.ok(iBuild >= 0, 'npm run build (production) absent');
  assert.ok(iSync > iBuild, 'npm run cap:sync doit suivre le build');
  assert.ok(iBundle > iSync, './gradlew bundleRelease doit suivre cap:sync');
  assert.ok(iUp > iBundle, 'l\'envoi doit suivre bundleRelease');
  const t = lire(PLAY);
  assert.match(t, /packageName:\s*app\.leurio/);
  assert.match(t, /track:\s*internal/);
  assert.match(t, /releaseFiles:\s*android\/app\/build\/outputs\/bundle\/release\/app-release\.aab/);
  assert.match(t, /PLAY_SERVICE_ACCOUNT_JSON/);
  for (const n of SECRETS_FIREBASE) assert.match(t, new RegExp(`secrets\\.${n}`), `${n} n'est pas passé au build`);
});

test('critère 1 : given le pipeline, when le bundle est construit, then versionCode et versionName viennent de scripts/version-android.mjs et sont passés à Gradle', () => {
  const t = lire(PLAY);
  assert.match(t, /version-android\.mjs/, 'le script de version n\'est pas appelé');
  assert.match(t, /bundleRelease[^\n]*-PversionCode=/, 'gradlew bundleRelease doit recevoir -PversionCode');
  assert.match(t, /bundleRelease[^\n]*-PversionName=/, 'gradlew bundleRelease doit recevoir -PversionName');
});

test('critère 1 : given deux dates successives, when on calcule le versionCode, then il est entier, strictement croissant et sous la limite du Play Store', () => {
  const a = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-03-01T10:00:00Z', TAG: 'v1.2.3' });
  const b = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-03-01T10:01:00Z', TAG: 'v1.2.3' });
  const c = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-11-25T08:30:00Z', TAG: 'v1.3.0' });
  for (const r of [a, b, c]) assert.equal(r.status, 0, r.out);
  const code = (r) => Number(r.stdout.match(/versionCode\s*=\s*(\d+)/)?.[1]);
  assert.ok(Number.isInteger(code(a)) && code(a) > 0, `versionCode illisible : ${a.stdout}`);
  assert.ok(code(b) > code(a), 'une minute plus tard, le versionCode doit être supérieur');
  assert.ok(code(c) > code(b));
  assert.equal(code(a), Math.floor((Date.parse('2026-03-01T10:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 60000));
  assert.ok(code(c) <= 2_100_000_000);
});

test('critère 1 : given un tag vX.Y.Z, when on calcule la version, then versionName est X.Y.Z (le v est retiré)', () => {
  const r = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-03-01T10:00:00Z', TAG: 'v1.2.3' });
  assert.equal(r.status, 0, r.out);
  assert.match(r.stdout, /versionName\s*=\s*1\.2\.3\s*$/m);
});

test('critère 1 : given android/app/build.gradle, when on le lit, then versionCode et versionName viennent des propriétés Gradle (défauts 1 et "1.0") et une signature release lit son keystore dans l\'environnement', () => {
  const g = lire(GRADLE);
  assert.match(g, /versionCode[^\n]*versionCode/, 'versionCode doit lire la propriété versionCode');
  assert.match(g, /hasProperty\(['"]versionCode['"]\)|findProperty\(['"]versionCode['"]\)|project\.properties\[['"]versionCode['"]\]/, 'lecture de la propriété versionCode absente');
  assert.match(g, /hasProperty\(['"]versionName['"]\)|findProperty\(['"]versionName['"]\)|project\.properties\[['"]versionName['"]\]/, 'lecture de la propriété versionName absente');
  assert.match(g, /:\s*1\b|\?\s*:\s*1\b|, *1\)/, 'défaut versionCode 1 absent');
  assert.match(g, /["']1\.0["']/, 'défaut versionName "1.0" absent');
  assert.match(g, /signingConfigs\s*\{[\s\S]*release/, 'signingConfig release absente');
  assert.match(g, /signingConfig\s*=?\s*signingConfigs\.release|signingConfig\s+signingConfigs\.release/, 'le build release n\'utilise pas la signature release');
  for (const n of ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']) assert.match(g, new RegExp(n), `${n} n'est pas lu`);
  assert.match(g, /if\s*\(|\?/, 'la signature doit être conditionnelle (le build debug marche sans secrets)');
});

// ---------- Critère 2 : lancement à la main

test('critère 2 : given le pipeline Android, when le propriétaire le lance à la main, then workflow_dispatch existe et la chaîne de build et d\'envoi est la même', () => {
  const t = lire(PLAY);
  assert.match(t, /^\s+workflow_dispatch:/m, 'déclencheur workflow_dispatch absent');
  const seq = sequenceJusquaEnvoi(t);
  assert.ok(indexOfStep(seq, /bundleRelease/) >= 0 && indexOfStep(seq, /upload-google-play/) > indexOfStep(seq, /bundleRelease/));
  // un seul chemin d'envoi : pas de job distinct pour le lancement manuel
  assert.equal((t.match(/upload-google-play/g) ?? []).length, 1, 'un seul envoi : même bundle quel que soit le déclencheur');
});

test('critère 2 : given un lancement manuel (sans tag), when on calcule la version, then le script donne quand même un versionCode croissant et un versionName', () => {
  const a = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-05-01T00:00:00Z' });
  const b = lancer(VERSION_SCRIPT, { VERSION_DATE: '2026-05-01T00:05:00Z' });
  assert.equal(a.status, 0, a.out);
  assert.equal(b.status, 0, b.out);
  const code = (r) => Number(r.stdout.match(/versionCode\s*=\s*(\d+)/)?.[1]);
  assert.ok(code(b) > code(a));
  assert.match(a.stdout, /versionName\s*=\s*\S+/);
});

// ---------- Critère 3 : vérifications en échec -> aucun envoi

test('critère 3 : given le lint, le type check ou les tests, when le pipeline s\'exécute, then ils tournent avant le build et l\'envoi', () => {
  const seq = sequenceJusquaEnvoi(lire(PLAY));
  const iUp = indexOfStep(seq, /upload-google-play/);
  const iBundle = indexOfStep(seq, /bundleRelease/);
  for (const cmd of ['npm run lint', 'npm run typecheck', 'npm test']) {
    const i = indexOfStep(seq, new RegExp(`run:\\s*${cmd}\\s*$`, 'm'));
    assert.ok(i >= 0, `${cmd} absent du pipeline Android`);
    assert.ok(i < iBundle && i < iUp, `${cmd} doit précéder le bundle et l'envoi`);
  }
  assert.ok(indexOfStep(seq, /npm ci/) >= 0);
});

test('critère 3 : given une vérification qui échoue, when le pipeline s\'exécute, then aucune étape avant l\'envoi n\'ignore l\'échec (continue-on-error, if: always())', () => {
  const t = lire(PLAY);
  assert.doesNotMatch(t, /continue-on-error:\s*true/, 'continue-on-error: true interdit');
  assert.doesNotMatch(t, /if:\s*(\$\{\{\s*)?(always|failure|cancelled)\(\)/, 'if: always()/failure()/cancelled() interdit');
  const seq = sequenceJusquaEnvoi(t);
  assert.ok(indexOfStep(seq, /upload-google-play/) >= 0);
});

// ---------- Critère 4 : secrets manquants

test('critère 4 : given le pipeline, when il démarre, then la vérification des secrets est la première étape après checkout, avant npm ci, et reçoit tous les secrets en env', () => {
  const t = lire(PLAY);
  const seq = sequenceJusquaEnvoi(t);
  const iCheck = indexOfStep(seq, /verifier-secrets-android\.mjs/);
  assert.ok(iCheck >= 0, 'l\'étape verifier-secrets-android.mjs est absente');
  assert.ok(iCheck < indexOfStep(seq, /npm ci/), 'les secrets se vérifient avant npm ci');
  assert.ok(iCheck < indexOfStep(seq, /npm run lint/));
  assert.ok(iCheck < indexOfStep(seq, /upload-google-play/));
  const avant = seq.slice(0, iCheck).filter((x) => /run:/.test(x.step) && !/checkout/.test(x.step));
  assert.deepEqual(avant, [], 'aucune commande ne doit précéder la vérification des secrets');
  for (const n of TOUS) assert.match(seq[iCheck].step, new RegExp(`${n}:\\s*\\$\\{\\{\\s*secrets\\.${n}\\s*\\}\\}`), `${n} non transmis à la vérification`);
});

test('critère 4 : given tous les secrets présents, when on lance la vérification, then elle réussit et n\'affiche aucune valeur', () => {
  const env = secretsComplets();
  const r = lancer(SECRETS_SCRIPT, env);
  assert.equal(r.status, 0, r.out);
  for (const v of Object.values(env)) assert.ok(!r.out.includes(v), 'une valeur de secret est affichée');
});

for (const nom of TOUS) {
  test(`critère 4 : given le secret ${nom} manquant, when on lance la vérification, then elle échoue en nommant ${nom} sans afficher aucune valeur`, () => {
    const env = secretsComplets();
    delete env[nom];
    const r = lancer(SECRETS_SCRIPT, env);
    assert.notEqual(r.status, 0, 'la vérification doit échouer');
    assert.match(r.out, new RegExp(`Secret manquant : ${nom}\\b`));
    for (const v of Object.values(env)) assert.ok(!r.out.includes(v), 'une valeur de secret est affichée');
  });
}

test('critère 4 : given un secret vide et un autre blanc, when on lance la vérification, then les deux sont signalés comme manquants', () => {
  const env = { ...secretsComplets(), ANDROID_KEY_PASSWORD: '', PLAY_SERVICE_ACCOUNT_JSON: '   ' };
  const r = lancer(SECRETS_SCRIPT, env);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /Secret manquant : ANDROID_KEY_PASSWORD/);
  assert.match(r.out, /Secret manquant : PLAY_SERVICE_ACCOUNT_JSON/);
  for (const v of Object.values(secretsComplets())) assert.ok(!r.out.includes(v));
});
