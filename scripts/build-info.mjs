// Identifiant du build pour les rapports de plantage (US 18) : « commit court · date UTC », ex. « 1970163 · 2026-11-24 ».
// Ne fait jamais échouer le build : sans git ni GITHUB_SHA, le commit est « inconnu ».
import { spawnSync } from 'node:child_process';

function commitGit() {
  try {
    const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : '';
  } catch {
    return '';
  }
}

export function identifierBuild({ env = process.env, git = commitGit, maintenant = new Date() } = {}) {
  const commit = env.GITHUB_SHA?.trim().slice(0, 7) || git() || 'inconnu';
  return `${commit} · ${maintenant.toISOString().slice(0, 10)}`;
}
