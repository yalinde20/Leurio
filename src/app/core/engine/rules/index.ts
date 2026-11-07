import { regleCouleur } from './couleur';
import { regleLuminosite } from './luminosite';
import { Regle } from './regle';
import { regleLune } from './lune';
import { reglePression } from './pression';
import { regleSaison } from './saison';
import { regleTaille } from './taille';
import { regleTemperature } from './temperature';

/** Règles appliquées à chaque couple, dans l'ordre de leurs phrases du « pourquoi ». */
export const REGLES: Regle[] = [regleTemperature, regleSaison, regleCouleur, regleLuminosite, regleTaille];
export const REGLES: Regle[] = [
  regleTemperature,
  regleSaison,
  regleCouleur,
  regleLuminosite,
  reglePression,
  regleLune,
];
