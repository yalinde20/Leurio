import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function run(command, args = [], timeout = 300_000) {
  const r = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', timeout, env: { ...process.env, CI: 'true', FORCE_COLOR: '0', NO_COLOR: '1' } });
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}`, error: r.error };
}

export function readPackageJson() {
  const file = join(ROOT, 'package.json');
  if (!existsSync(file)) throw new Error('package.json est absent : le projet n\'existe pas encore');
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function requireScript(name) {
  const pkg = readPackageJson();
  if (!pkg.scripts?.[name]) throw new Error(`le script npm "${name}" n'existe pas dans package.json`);
}

export function requireDir(rel) {
  if (!existsSync(join(ROOT, rel))) throw new Error(`le dossier ${rel} n'existe pas`);
}

/** Lint un fichier avec l'ESLint du projet (sans rien télécharger). */
export function lintFile(rel) {
  requireScript('lint');
  const r = run('npx', ['--no-install', 'eslint', rel, '--format', 'json']);
  let messages = [];
  try {
    messages = JSON.parse(r.output.slice(r.output.indexOf('[')))[0]?.messages ?? [];
  } catch { /* sortie non JSON : l'assertion sur le statut échouera */ }
  return { ...r, messages };
}
