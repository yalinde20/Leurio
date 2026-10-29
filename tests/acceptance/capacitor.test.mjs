import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run, readPackageJson, requireScript } from '../helpers/run.mjs';
import { SYNC_SCRIPT, readCapacitorConfig, angularBrowserOutput } from '../helpers/capacitor.mjs';

/** Liste triée des fichiers d'un dossier, en chemins relatifs, récursivement. */
function listFiles(root, sub = '') {
  return readdirSync(join(root, sub), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(root, join(sub, e.name)) : [join(sub, e.name)]))
    .sort();
}

test('critère 0 : given le dépôt, when on lit capacitor.config.ts, then il donne le nom d\'app « Leurio », un identifiant d\'app et le dossier de sortie du build Angular comme dossier web', () => {
  const { appId, appName, webDir } = readCapacitorConfig();
  assert.equal(appName, 'Leurio');
  assert.match(appId ?? '', /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, `appId invalide : ${appId}`);
  assert.equal(webDir?.replace(/\/$/, ''), angularBrowserOutput());
});

test('critère 1 : given un build de production, when on synchronise les projets natifs avec Capacitor, then la commande réussit et les projets android et ios contiennent les fichiers du build', () => {
  requireScript('build');
  requireScript(SYNC_SCRIPT);
  const build = run('npm', ['run', 'build'], 900_000);
  assert.equal(build.status, 0, `le build a échoué : ${build.output}`);
  // Supprime les copies existantes : une copie périmée ne doit pas faire passer le test.
  const copies = ['android/app/src/main/assets/public', 'ios/App/App/public'];
  for (const rel of copies) rmSync(join(ROOT, rel), { recursive: true, force: true });
  const sync = run('npm', ['run', SYNC_SCRIPT], 900_000);
  assert.equal(sync.status, 0, `la synchronisation a échoué : ${sync.output}`);
  const dist = readFileSync(join(ROOT, angularBrowserOutput(), 'index.html'), 'utf8');
  const distFiles = listFiles(join(ROOT, angularBrowserOutput()));
  for (const dir of copies) {
    const rel = `${dir}/index.html`;
    assert.ok(existsSync(join(ROOT, rel)), `${rel} est absent`);
    assert.equal(readFileSync(join(ROOT, rel), 'utf8'), dist, `${rel} ne correspond pas au build`);
    // Capacitor peut ajouter des fichiers (cordova.js…) : chaque fichier du build doit être présent et identique.
    for (const f of distFiles) {
      const copy = join(ROOT, dir, f);
      assert.ok(existsSync(copy), `${dir}/${f} est absent`);
      assert.deepEqual(readFileSync(copy), readFileSync(join(ROOT, angularBrowserOutput(), f)), `${dir}/${f} ne correspond pas au build`);
    }
  }
});

test('critère 3 : given le fichier CLAUDE.md, when on lit la section « ## Commands », then elle donne la commande de synchronisation des projets natifs', () => {
  const md = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const m = md.match(/^## Commands\s*\n([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m);
  assert.ok(m, 'section "## Commands" introuvable');
  assert.match(m[1], new RegExp(`\`npm run ${SYNC_SCRIPT}\``), `la commande \`npm run ${SYNC_SCRIPT}\` n'est pas dans la section Commands`);
  const script = readPackageJson().scripts?.[SYNC_SCRIPT];
  assert.ok(script, `le script npm "${SYNC_SCRIPT}" n'existe pas`);
  assert.match(script, /\bcap sync\b/, `le script ${SYNC_SCRIPT} ne lance pas "cap sync" : ${script}`);
});
