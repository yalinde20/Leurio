import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './run.mjs';

/** Nom du script npm qui synchronise les projets natifs (npm run cap:sync). */
export const SYNC_SCRIPT = 'cap:sync';

/** Lit capacitor.config.ts (texte brut) et en extrait appId, appName et webDir. */
export function readCapacitorConfig() {
  const file = join(ROOT, 'capacitor.config.ts');
  if (!existsSync(file)) throw new Error('capacitor.config.ts est absent');
  const text = readFileSync(file, 'utf8');
  const get = (key) => text.match(new RegExp(`\\b${key}\\s*:\\s*(['"\`])([^'"\`]*)\\1`))?.[2];
  return { appId: get('appId'), appName: get('appName'), webDir: get('webDir') };
}

/** Dossier de sortie des fichiers web du build Angular, déduit de angular.json. */
export function angularBrowserOutput() {
  const angular = JSON.parse(readFileSync(join(ROOT, 'angular.json'), 'utf8'));
  const [name, project] = Object.entries(angular.projects)[0];
  const out = project.architect.build.options?.outputPath;
  const base = typeof out === 'string' ? out : out?.base ?? `dist/${name}`;
  const browser = typeof out === 'object' && out !== null && 'browser' in out ? out.browser : 'browser';
  return join(base, browser).replace(/\\/g, '/');
}
