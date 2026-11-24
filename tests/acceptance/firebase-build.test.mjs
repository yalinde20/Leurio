// US 36, critère 5 (hypothèse de conception A, à ajuster si le propriétaire en décide autrement) :
// la configuration Firebase de production vient de variables d'environnement lues au build.
//   - `npm run build` (production réelle) exige les 7 variables FIREBASE_* et échoue en nommant celle qui manque ;
//   - `npm run build:emulateurs` (production, configuration émulateurs) n'en exige aucune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readPackageJson } from '../helpers/run.mjs';

const VARIABLES = {
  FIREBASE_API_KEY: 'fake-api-key-pour-les-tests',
  FIREBASE_AUTH_DOMAIN: 'fake-projet-test.example.test',
  FIREBASE_PROJECT_ID: 'fake-projet-test',
  FIREBASE_STORAGE_BUCKET: 'fake-projet-test-bucket',
  FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  FIREBASE_APP_ID: 'fake-app-id-pour-les-tests',
  FIREBASE_APPCHECK_SITE_KEY: 'fake-site-key-pour-les-tests',
};
const NOMS = Object.keys(VARIABLES);

/** Lance `npm run <script>` avec exactement les variables FIREBASE_* données (aucune autre ne fuit). */
function build(script, variables) {
  const env = { ...process.env, CI: 'true', FORCE_COLOR: '0', NO_COLOR: '1' };
  for (const n of NOMS) delete env[n];
  Object.assign(env, variables);
  const r = spawnSync('npm', ['run', script], { cwd: ROOT, encoding: 'utf8', env, timeout: 900_000 });
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function requireScript(name) {
  assert.ok(readPackageJson().scripts?.[name], `le script npm "${name}" n'existe pas`);
}

function sansUne(nom, valeur) {
  const v = { ...VARIABLES };
  if (valeur === undefined) delete v[nom];
  else v[nom] = valeur;
  return v;
}

function bundles() {
  const dir = join(ROOT, 'dist/leurio/browser');
  assert.ok(existsSync(dir), 'dist/leurio/browser est absent après le build');
  return readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
}

for (const nom of ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID', 'FIREBASE_APPCHECK_SITE_KEY']) {
  test(`critère 5 : given la variable ${nom} absente, when on lance le build de production, then le build échoue avec un message qui nomme ${nom}`, () => {
    requireScript('build');
    const r = build('build', sansUne(nom));
    assert.notEqual(r.status, 0, `le build aurait dû échouer sans ${nom}\n${r.output}`);
    assert.ok(r.output.includes(nom), `le message d'erreur ne nomme pas ${nom}\n${r.output}`);
  });
}

test('critère 5 : given la variable FIREBASE_AUTH_DOMAIN définie mais vide, when on lance le build de production, then le build échoue avec un message qui nomme FIREBASE_AUTH_DOMAIN', () => {
  requireScript('build');
  const r = build('build', sansUne('FIREBASE_AUTH_DOMAIN', ''));
  assert.notEqual(r.status, 0, `le build aurait dû échouer avec une variable vide\n${r.output}`);
  assert.ok(r.output.includes('FIREBASE_AUTH_DOMAIN'), r.output);
});

test('critère 5 : given les sept variables de configuration Firebase (valeurs factices), when on lance le build de production, then le build réussit et la configuration vient des variables', () => {
  requireScript('build');
  const r = build('build', VARIABLES);
  assert.equal(r.status, 0, `le build aurait dû réussir\n${r.output}`);
  const js = bundles();
  assert.ok(js.includes(VARIABLES.FIREBASE_PROJECT_ID), 'le projectId des variables n\'est pas dans le bundle');
  assert.ok(js.includes(VARIABLES.FIREBASE_API_KEY), 'la clé d\'API des variables n\'est pas dans le bundle');
  assert.ok(!js.includes('leurioFirebase'), 'le build de production réel ne doit pas exposer le hook de test window.leurioFirebase');
});

test('critère 4 : given le build de production en configuration émulateurs, when on lance npm run build:emulateurs sans aucune variable, then le build réussit et vise les émulateurs du projet demo-leurio', () => {
  requireScript('build:emulateurs');
  const r = build('build:emulateurs', {});
  assert.equal(r.status, 0, `le build émulateurs aurait dû réussir sans variable\n${r.output}`);
  const js = bundles();
  assert.ok(js.includes('demo-leurio'), 'le projectId demo-leurio est absent du bundle');
  assert.ok(js.includes('9099') && js.includes('8080') && js.includes('9199'), 'les ports des émulateurs (9099, 8080, 9199) sont absents du bundle');
  assert.ok(js.includes('leurioFirebase'), 'le hook window.leurioFirebase (émulateurs seulement) est absent');
});

// US 131, critère 4 : la valeur provisoire `a-configurer` du secret ne casse pas le build de production.
test('critère 4 (US 131) : given FIREBASE_APPCHECK_SITE_KEY vaut a-configurer, when on lance le build de production, then le build réussit', () => {
  requireScript('build');
  const r = build('build', { ...VARIABLES, FIREBASE_APPCHECK_SITE_KEY: 'a-configurer' });
  assert.equal(r.status, 0, `le build de production aurait dû réussir\n${r.output.slice(-2000)}`);
});
