import { regleLuminosite } from './luminosite';
import { regleCouleur } from './couleur';
import { Regle } from './regle';
import { regleSaison } from './saison';
import { regleTemperature } from './temperature';

/** Règles appliquées à chaque couple, dans l'ordre de leurs phrases du « pourquoi ». */
export const REGLES: Regle[] = [regleTemperature, regleSaison, regleLuminosite];
export const REGLES: Regle[] = [regleTemperature, regleSaison, regleCouleur];
