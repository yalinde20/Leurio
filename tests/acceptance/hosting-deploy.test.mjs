// US 37 : déployer l'app sur Firebase Hosting depuis main (PLAN §10, §5).
// Le workflow de déploiement est séparé de ci.yml (ci.test.mjs simule chaque `run:` de ci.yml).
// Le vrai domaine leurio.app ne se teste pas ici : les critères 5 et 6 sont prouvés en local
// avec l'émulateur Firebase Hosting sur le build de l'app (projet demo-leurio, aucun appel réseau réel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, run } from '../helpers/run.mjs';
import { parseSteps, parseTriggers } from '../helpers/workflow.mjs';

const DEPLOY = '.github/workflows/deploy.yml';
const SCRIPT = 'scripts/verifier-ci.mjs';
const SORTIE = 'dist/leurio/browser';

const lire = (rel) => {
  const f = join(ROOT, rel);
  if (!existsSync(f)) throw new Error(`${rel} est absent`);
  return readFileSync(f, 'utf8');
};
const lireDeploy = () => lire(DEPLOY);
const unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2');

/** Workflows (hors deploy.yml) : { fichier, texte, nom, surPullRequest }. */
function autresWorkflows() {
  const dir = join(ROOT, '.github/workflows');
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f) && f !== 'deploy.yml')
    .map((f) => {
      const texte = readFileSync(join(dir, f), 'utf8');
      const nom = unquote(texte.match(/^name:\s*(.+)$/m)?.[1] ?? '');
      return { fichier: f, texte, nom, surPullRequest: parseTriggers(texte).pull_request !== null };
    });
}

/** Noms entre crochets sous `workflows:` du déclencheur workflow_run. */
function nomsWorkflowRun(texte) {
  const m = texte.match(/^\s*workflow_run:\s*\n\s+workflows:\s*(\[[^\]]*\]|(?:\n\s+- .+)+)/m);
  if (!m) return null;
  const brut = m[1];
  return brut.startsWith('[')
    ? brut.slice(1, -1).split(',').map(unquote).filter(Boolean)
    : brut.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('- ')).map((l) => unquote(l.slice(2)));
}

const estDeploiement = (step) =>
  /FirebaseExtended\/action-hosting-deploy/.test(step.uses ?? '') || /firebase\s+deploy/.test(step.run ?? '');

async function gate() {
  const f = join(ROOT, SCRIPT);
  if (!existsSync(f)) throw new Error(`${SCRIPT} est absent`);
  return import(pathToFileURL(f).href);
}

const run_ = (id, name, conclusion = 'success', status = 'completed', event = 'push') => ({ id, name, status, conclusion, event });
const SHA = 'a'.repeat(40);
const tousSucces = (requis) => requis.map((n, i) => run_(100 + i, n));

// ---------- Critère 1 ----------

test('critère 1 : given un push sur main dont les trois vérifications CI ont réussi, when la passerelle décide, then elle autorise le déploiement', async () => {
  const { decider, REQUIS } = await gate();
  const r = decider({ sha: SHA, teteMain: SHA, evenement: 'push', branche: 'main', runs: tousSucces(REQUIS), requis: REQUIS });
  assert.equal(r.deployer, true, r.raison);
  assert.equal(typeof r.raison, 'string');
});

test('critère 1 : given un re-run d\'une vérification, when la passerelle décide, then seul le dernier run (id le plus élevé) de chaque workflow compte', async () => {
  const { decider, REQUIS } = await gate();
  const runs = [...tousSucces(REQUIS), run_(1, REQUIS[0], 'failure')];
  assert.equal(decider({ sha: SHA, teteMain: SHA, evenement: 'push', branche: 'main', runs, requis: REQUIS }).deployer, true);
  const runs2 = [...tousSucces(REQUIS), run_(999, REQUIS[0], 'failure')];
  assert.equal(decider({ sha: SHA, teteMain: SHA, evenement: 'push', branche: 'main', runs: runs2, requis: REQUIS }).deployer, false);
});

test('critère 1 : given les workflows du dépôt, when on lit REQUIS, then ce sont exactement les noms de tous les workflows qui tournent sur pull_request', async () => {
  const { REQUIS } = await gate();
  const attendus = autresWorkflows().filter((w) => w.surPullRequest).map((w) => w.nom).sort();
  assert.ok(attendus.length >= 3, 'au moins CI, Android et Règles Firestore tournent sur pull_request');
  assert.deepEqual([...REQUIS].sort(), attendus);
});

test('critère 1 : given deploy.yml, when on lit son déclencheur, then il suit la fin des workflows requis sur main (workflow_run completed)', async () => {
  const { REQUIS } = await gate();
  const t = lireDeploy();
  assert.deepEqual([...(nomsWorkflowRun(t) ?? [])].sort(), [...REQUIS].sort());
  assert.match(t, /types:\s*\[\s*completed\s*\]|types:\s*\n\s+- completed/);
  assert.match(t, /branches:\s*\[\s*main\s*\]|branches:\s*\n\s+- main/);
  assert.match(t, /^name:\s*Déploiement\s*$/m);
});

test('critère 1 : given deploy.yml, when on lit ses étapes, then le build de production réel précède un déploiement de Hosting seul, sur le commit vérifié', () => {
  const t = lireDeploy();
  const steps = parseSteps(t);
  const iBuild = steps.findIndex((s) => /^npm run build\s*$/m.test(s.run ?? ''));
  const iDeploy = steps.findIndex(estDeploiement);
  assert.ok(iBuild >= 0, 'une étape `npm run build` (build de production) est attendue');
  assert.ok(!steps.some((s) => /build:emulateurs/.test(s.run ?? '')), 'le déploiement ne doit pas utiliser le build émulateurs');
  assert.ok(iDeploy > iBuild, 'le déploiement vient après le build');
  const d = steps[iDeploy];
  if (d.run) assert.match(d.run, /firebase\s+deploy\s+--only\s+hosting\b/);
  else assert.equal(d.with?.channelId, 'live');
  assert.doesNotMatch(t, /--only[ =][^\n]*(firestore|storage|functions)/, 'seul Hosting est déployé');
  assert.doesNotMatch(t, /firebase\s+deploy(?!\s+--only\s+hosting\b)/, 'seul Hosting est déployé');
  assert.match(t, /ref:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha\s*\}\}/, 'checkout du commit vérifié');
  for (const i of [iBuild, iDeploy]) assert.match(steps[i].if ?? '', /steps\.verification\.outputs\.deployer\s*==\s*'true'/, 'étape conditionnée par la passerelle');
  const iGate = steps.findIndex((s) => /node scripts\/verifier-ci\.mjs/.test(s.run ?? ''));
  assert.ok(iGate >= 0 && iGate < iBuild, 'la passerelle vérifier-ci s\'exécute avant le build');
  assert.equal(steps[iGate].id, 'verification');
});

test('critère 1 : given un commit qui n\'est plus la tête de main, when la passerelle décide, then aucun déploiement', async () => {
  const { decider, REQUIS } = await gate();
  const r = decider({ evenement: 'push', branche: 'main', sha: SHA, teteMain: 'b'.repeat(40), runs: tousSucces(REQUIS), requis: REQUIS });
  assert.equal(r.deployer, false);
  assert.match(r.raison, /main/);
});

// ---------- Critère 2 ----------

test('critère 2 : given un run pull_request réussi et un run push en échec ou absent, when la passerelle décide, then aucun déploiement', async () => {
  const { decider, REQUIS } = await gate();
  const pr = tousSucces(REQUIS).map((r) => ({ ...r, id: r.id + 1000, event: 'pull_request' }));
  const echec = tousSucces(REQUIS).map((r, j) => (j === 0 ? { ...r, conclusion: 'failure' } : r));
  const absent = tousSucces(REQUIS).slice(1);
  for (const push of [echec, absent])
    assert.equal(decider({ evenement: 'push', branche: 'main', sha: SHA, teteMain: SHA, runs: [...push, ...pr], requis: REQUIS }).deployer, false);
});

test('critère 2 : given un push sur main dont une vérification a échoué, when la passerelle décide, then aucun déploiement et la raison nomme le workflow en échec', async () => {
  const { decider, REQUIS } = await gate();
  for (const i of REQUIS.keys()) {
    const runs = tousSucces(REQUIS).map((r, j) => (j === i ? { ...r, conclusion: 'failure' } : r));
    const r = decider({ sha: SHA, teteMain: SHA, evenement: 'push', branche: 'main', runs, requis: REQUIS });
    assert.equal(r.deployer, false);
    assert.ok(r.raison.includes(REQUIS[i]), `la raison doit nommer ${REQUIS[i]} : ${r.raison}`);
  }
});

test('critère 2 : given une vérification annulée, manquante ou pas terminée, when la passerelle décide, then aucun déploiement', async () => {
  const { decider, REQUIS } = await gate();
  const base = tousSucces(REQUIS);
  const cas = {
    annulée: base.map((r, j) => (j === 0 ? { ...r, conclusion: 'cancelled' } : r)),
    manquante: base.slice(1),
    'en cours': base.map((r, j) => (j === 1 ? { ...r, status: 'in_progress', conclusion: null } : r)),
    'aucun run': [],
  };
  for (const [nom, runs] of Object.entries(cas))
    assert.equal(decider({ sha: SHA, teteMain: SHA, evenement: 'push', branche: 'main', runs, requis: REQUIS }).deployer, false, nom);
});

test('critère 2 : given deploy.yml, when on lit la condition du job, then il ne tourne que si le workflow déclencheur a réussi', () => {
  const t = lireDeploy();
  assert.match(t, /if:[^\n]*github\.event\.workflow_run\.conclusion\s*==\s*'success'/);
});

// ---------- Critère 3 ----------

test('critère 3 : given une pull request dont toutes les vérifications passent, when la passerelle décide, then aucun déploiement', async () => {
  const { decider, REQUIS } = await gate();
  const runs = tousSucces(REQUIS).map((r) => ({ ...r, event: 'pull_request' }));
  assert.equal(decider({ sha: SHA, teteMain: SHA, evenement: 'pull_request', branche: 'main', runs, requis: REQUIS }).deployer, false);
  assert.equal(decider({ sha: SHA, teteMain: SHA, evenement: 'pull_request', branche: 'une-branche', runs, requis: REQUIS }).deployer, false);
});

test('critère 3 : given un push sur une autre branche que main, when la passerelle décide, then aucun déploiement', async () => {
  const { decider, REQUIS } = await gate();
  assert.equal(decider({ sha: SHA, teteMain: SHA, evenement: 'push', branche: 'us/37-autre', runs: tousSucces(REQUIS), requis: REQUIS }).deployer, false);
});

test('critère 3 : given deploy.yml, when on lit ses déclencheurs et sa condition, then il n\'a ni push ni pull_request et exige un événement push', () => {
  const t = lireDeploy();
  const trig = parseTriggers(t);
  assert.equal(trig.push, null);
  assert.equal(trig.pull_request, null);
  assert.match(t, /if:[^\n]*github\.event\.workflow_run\.event\s*==\s*'push'/);
});

test('critère 3 : given ci.yml, android.yml et firestore-rules.yml, when on les lit, then aucun ne contient d\'étape de déploiement', () => {
  const trois = autresWorkflows().filter((w) => ['ci.yml', 'android.yml', 'firestore-rules.yml'].includes(w.fichier));
  assert.equal(trois.length, 3);
  for (const w of trois) {
    assert.doesNotMatch(w.texte, /firebase\s+deploy|action-hosting-deploy/, w.fichier);
    assert.ok(!parseSteps(w.texte).some(estDeploiement), w.fichier);
  }
});

// ---------- Critère 4 ----------

test('critère 4 : given deploy.yml, when on le lit, then le compte de service et le projet viennent de secrets GitHub', () => {
  const t = lireDeploy();
  assert.match(t, /\$\{\{\s*secrets\.FIREBASE_SERVICE_ACCOUNT\s*\}\}/);
  const projet = [...t.matchAll(/^\s*projectId:\s*(.+)$/gm)].map((m) => m[1].trim());
  for (const p of projet) assert.match(p, /^\$\{\{\s*secrets\.[A-Z_]+\s*\}\}$/, `projectId littéral : ${p}`);
  assert.doesNotMatch(t, /--token/);
  assert.doesNotMatch(t, /GOOGLE_APPLICATION_CREDENTIALS\s*[:=]\s*(?!\$\{\{)\S/);
});

test('critère 4 : given deploy.yml, when on lit le build de production, then chaque variable FIREBASE_* vient d\'un secret et aucune valeur n\'est écrite', () => {
  const t = lireDeploy();
  const vars = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID', 'APPCHECK_SITE_KEY'].map((n) => `FIREBASE_${n}`);
  for (const v of vars) assert.match(t, new RegExp(`^\\s*${v}:\\s*\\$\\{\\{\\s*secrets\\.${v}\\s*\\}\\}\\s*$`, 'm'), v);
  // motifs de firebase-secrets.test.mjs (construits par morceaux)
  const motifs = [
    new RegExp('AI' + 'za[0-9A-Za-z_-]{35}'),
    new RegExp('\\b6L[0-9A-Za-z_-]{38}\\b'),
    new RegExp('-----BEGIN (RSA |EC )?PRIVATE ' + 'KEY-----'),
    new RegExp('"private' + '_key"'),
    new RegExp('"type"\\s*:\\s*"service' + '_account"'),
    new RegExp('\\b1:\\d{6,}:(web|android|ios):[0-9a-f]{10,}\\b'),
    /\b(?!demo-)[a-z0-9-]+\.(firebaseapp\.com|firebasestorage\.app)\b/,
  ];
  for (const re of motifs) assert.doesNotMatch(t, re);
  for (const l of t.split('\n').filter((x) => /^\s*FIREBASE_[A-Z_]+:/.test(x))) assert.match(l, /\$\{\{\s*secrets\./, l);
});

// ---------- Critères 5 et 6 : preuve locale avec l'émulateur Hosting ----------

let resultats;
function servir() {
  if (resultats) return resultats;
  const b = run('npm', ['run', 'build:emulateurs'], 900_000);
  assert.equal(b.status, 0, `build:emulateurs en échec :\n${b.output.slice(-2000)}`);
  const r = run('npx', ['--no-install', 'firebase', 'emulators:exec', '--only', 'hosting', '--project', 'demo-leurio',
    'node tests/helpers/hosting-fetch.mjs'], 300_000);
  const m = r.output.match(/RESULTAT:(\{.*\})/);
  assert.ok(m, `l'émulateur Hosting n'a rien renvoyé (firebase.json sans section hosting ?) :\n${r.output.slice(-2000)}`);
  resultats = JSON.parse(m[1]);
  return resultats;
}

test('critère 5 : given firebase.json, when on lit la section hosting, then elle publie le dossier de sortie du build Angular', () => {
  const cfg = JSON.parse(lire('firebase.json'));
  assert.ok(cfg.hosting, 'firebase.json n\'a pas de section hosting');
  assert.equal(cfg.hosting.public, SORTIE);
  const ng = JSON.parse(lire('angular.json'));
  assert.ok(ng.projects.leurio, 'le projet Angular s\'appelle leurio');
  const sortie = ng.projects.leurio.architect.build.options.outputPath;
  assert.ok(sortie === undefined || sortie === 'dist/leurio' || sortie.base === 'dist/leurio', 'dossier de sortie Angular par défaut : dist/leurio');
  assert.ok(readFileSync(join(ROOT, 'capacitor.config.ts'), 'utf8').includes(SORTIE));
});

test('critère 5 : given le build servi par Hosting, when on ouvre la racine, then l\'app s\'affiche (200 et <app-root>)', { timeout: 1_500_000 }, () => {
  const r = servir()['/'];
  assert.equal(r.status, 200);
  assert.match(r.corps, /<app-root/);
});

test('critère 5 : given Hosting, when on demande le service worker, la racine ou une route interne, then ils sont servis sans cache long (no-cache)', { timeout: 1_500_000 }, () => {
  for (const c of ['/', '/conseil'])
    assert.match(servir()[c].cacheControl ?? '', /no-cache/, c);
  const sw = servir()['/ngsw-worker.js'];
  assert.equal(sw.status, 200);
  assert.match(sw.cacheControl ?? '', /no-cache|max-age=0/);
  assert.doesNotMatch(sw.cacheControl ?? '', /max-age=(?!0\b)\d+/);
  const cfg = JSON.parse(lire('firebase.json'));
  const entetes = cfg.hosting?.headers ?? [];
  for (const f of ['ngsw-worker.js', 'ngsw.json', 'safety-worker.js', 'worker-basic.min.js', 'index.html']) {
    const e = entetes.find((h) => h.source.includes(f));
    assert.ok(e, `en-tête de cache manquant pour ${f}`);
    assert.match(e.headers.find((h) => h.key.toLowerCase() === 'cache-control')?.value ?? '', /no-cache/, f);
  }
});

test('critère 6 : given Hosting, when on ouvre directement /conseil ou /boite, then l\'app s\'affiche (200, même index.html) au lieu d\'une 404', { timeout: 1_500_000 }, () => {
  const res = servir();
  for (const c of ['/conseil', '/boite']) {
    assert.equal(res[c].status, 200, c);
    assert.equal(res[c].corps, res['/'].corps, `${c} doit renvoyer index.html`);
  }
  const cfg = JSON.parse(lire('firebase.json'));
  assert.deepEqual(cfg.hosting?.rewrites, [{ source: '**', destination: '/index.html' }]);
});
