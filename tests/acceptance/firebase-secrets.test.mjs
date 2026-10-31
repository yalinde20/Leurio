// US 36, critère 6 : aucun secret ni valeur de configuration Firebase dans les fichiers suivis par Git.
// (Les fichiers non suivis mais non ignorés sont scannés aussi : un fichier ajouté ne doit pas passer entre les mailles.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';

const SELF = 'tests/acceptance/firebase-secrets.test.mjs';
const BINAIRES = /\.(png|jpe?g|gif|webp|ico|icns|jar|woff2?|ttf|otf|pdf|zip|gz|keystore|jks)$/i;
const IGNORES = new Set(['package-lock.json', SELF]);

// Motifs construits par morceaux pour que ce fichier ne se détecte pas lui-même.
const MOTIFS = [
  ['clé d\'API web Google/Firebase', new RegExp('AI' + 'za[0-9A-Za-z_-]{35}')],
  ['clé reCAPTCHA / App Check', new RegExp('\\b6L[0-9A-Za-z_-]{38}\\b')],
  ['clé privée', new RegExp('-----BEGIN (RSA |EC )?PRIVATE ' + 'KEY-----')],
  ['champ private_key de compte de service', new RegExp('"private' + '_key"')],
  ['compte de service', new RegExp('"type"\\s*:\\s*"service' + '_account"')],
  ['identifiant d\'application Firebase', new RegExp('\\b1:\\d{6,}:(web|android|ios):[0-9a-f]{10,}\\b')],
  ['domaine firebaseapp.com / firebasestorage.app d\'un vrai projet', /\b(?!demo-)[a-z0-9-]+\.(firebaseapp\.com|firebasestorage\.app)\b/],
];

function fichiers() {
  const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout.split('\n').filter(Boolean);
  return [...new Set([...git(['ls-files']), ...git(['ls-files', '--others', '--exclude-standard'])])]
    .filter((f) => !BINAIRES.test(f) && !IGNORES.has(f));
}

function contenu(f) {
  try {
    const t = readFileSync(join(ROOT, f), 'utf8');
    return t.includes('\0') ? null : t;
  } catch {
    return null;
  }
}

/** Retourne [{ fichier, motif }] pour les fichiers donnés ({ chemin: texte }). */
export function trouver(textes) {
  const out = [];
  for (const [fichier, texte] of Object.entries(textes))
    for (const [motif, re] of MOTIFS) if (re.test(texte)) out.push({ fichier, motif });
  return out;
}

test('critère 6 : given les fichiers suivis par Git, when on les parcourt, then aucune valeur de configuration Firebase, clé App Check ou clé de compte de service n\'y figure', () => {
  const textes = {};
  for (const f of fichiers()) {
    const t = contenu(f);
    if (t !== null) textes[f] = t;
  }
  assert.ok(Object.keys(textes).length > 50, 'le parcours des fichiers suivis ne trouve presque rien');
  assert.deepEqual(trouver(textes), []);
});

test('critère 6 : given un fichier contenant une clé d\'API, une clé reCAPTCHA ou une clé de compte de service, when on le parcourt, then le scan le détecte (le contrôle n\'est pas aveugle)', () => {
  const fausseCle = 'AI' + 'za' + 'A'.repeat(35);
  const fausseSite = '6L' + 'x'.repeat(38);
  const textes = {
    'a.ts': `const apiKey = '${fausseCle}';`,
    'b.ts': `const siteKey = '${fausseSite}';`,
    'c.json': '{ "type": "service' + '_account", "private' + '_key": "x" }',
    'd.ts': "const authDomain = 'mon-vrai-projet.firebase" + "app.com';",
    'e.ts': "const appId = '1:123456789012:web:abcdef0123456789';",
    'ok.ts': "const projectId = 'demo-leurio'; const host = '127.0.0.1';",
  };
  const trouves = trouver(textes).map((t) => t.fichier);
  assert.deepEqual([...new Set(trouves)].sort(), ['a.ts', 'b.ts', 'c.json', 'd.ts', 'e.ts']);
});

test('critère 6 : given le dépôt, when on lit .firebaserc et firebase.json, then le projet par défaut (s\'il existe) est un projet de démonstration demo-*', () => {
  const rc = join(ROOT, '.firebaserc');
  const suivi = spawnSync('git', ['ls-files', '--error-unmatch', '.firebaserc'], { cwd: ROOT }).status === 0;
  const present = (() => { try { readFileSync(rc); return true; } catch { return false; } })();
  if (!suivi && !present) return;
  const projets = JSON.parse(readFileSync(rc, 'utf8')).projects ?? {};
  for (const [alias, id] of Object.entries(projets)) assert.match(id, /^demo-/, `.firebaserc : le projet « ${alias} » (${id}) n'est pas un projet demo-*`);
});

test('critère 6 : given .gitignore, when on le lit, then les fichiers .env et les clés de compte de service sont ignorés', () => {
  const lignes = readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
  const ignore = (chemin) => spawnSync('git', ['check-ignore', '-q', chemin], { cwd: ROOT }).status === 0;
  assert.ok(lignes.length > 0);
  for (const chemin of ['.env', '.env.local', '.env.production', 'service-account.json', 'leurio-firebase-adminsdk-abc12.json', 'serviceAccountKey.json'])
    assert.ok(ignore(chemin), `${chemin} devrait être ignoré par Git`);
  for (const chemin of ['src/app/core/firebase/config.reelle.ts', 'google-services.json', 'GoogleService-Info.plist'])
    assert.ok(ignore(chemin), `${chemin} devrait être ignoré par Git`);
});
