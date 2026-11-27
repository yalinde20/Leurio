// Dossiers temporaires de contenu pour les tests de `validate-data` (US 293).
// `validate-data` cherche les pictogrammes des familles depuis le parent du dossier de données :
// le dossier rendu est donc `<racine>/assets/data`, et les SVG réels sont copiés dans `<racine>/assets/pictogrammes`.
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROOT } from './run.mjs';

/** Chemin (relatif à assets/) du pictogramme des familles d'exemple. */
export const PICTOGRAMME = 'pictogrammes/souples.svg';

/** Crée `<racine temporaire>/assets/data` avec les pictogrammes réels à côté ; rend le dossier de données. */
export function creerDossierDonnees(prefixe) {
  const racine = mkdtempSync(join(tmpdir(), prefixe));
  const data = join(racine, 'assets', 'data');
  mkdirSync(data, { recursive: true });
  cpSync(join(ROOT, 'src/assets/pictogrammes'), join(racine, 'assets', 'pictogrammes'), { recursive: true });
  return data;
}

/** Supprime tout ce que `creerDossierDonnees` a créé. */
export function supprimerDossierDonnees(data) {
  rmSync(dirname(dirname(data)), { recursive: true, force: true });
}
