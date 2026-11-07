import { Conditions } from '../conditions';
import { Animation, Couleur, Espece, TypeLeurre } from '../../data/catalog.types';

/** Facteurs pondérés par `engine-weights.json` (PLAN §8.2). */
export interface PoidsMoteur {
  temperature: number;
  saison: number;
  clarte: number;
  luminosite: number;
  pression: number;
  lune: number;
  penaliteDifficulte: number;
  /** Écart de pression sur 48 h (hPa) au-delà duquel la pression devient un indice. */
  seuilPression: number;
  /** Phases de lune (noms de l'AstroService) qui donnent le bonus de lune. */
  phasesLuneBonus: string[];
  [facteur: string]: number | string[];
  /** Pourcentage de nuages à partir duquel le ciel est couvert. */
  seuilCielCouvert: number;
  [facteur: string]: number;
}

/** Le couple évalué : un type de leurre, une animation, pour une espèce. */
export interface ContexteRegle {
  conditions: Conditions;
  espece: Espece;
  type: TypeLeurre;
  animation: Animation;
  /** Les couleurs du contenu, dans l'ordre du contenu. */
  couleurs: Couleur[];
  /** Poids du moteur ; les règles qui ont un seuil ou une liste dans le contenu les lisent ici. */
  /** Poids du moteur ; absents, le seuil de ciel couvert est inconnu et seul le moment compte. */
  poids?: PoidsMoteur;
}

export interface ResultatRegle {
  facteur: keyof PoidsMoteur;
  /** Adéquation du couple, de 0 à 1 ; multipliée par le poids du facteur. */
  points: number;
  /** Phrase du « pourquoi », en français. */
  phrase: string;
  /** Identifiant de la couleur de leurre conseillée par la règle, s'il y en a une. */
  couleur?: string;
}

/** Une règle rend `null` quand elle n'est pas déclenchée : elle ne compte pas et n'écrit rien. */
export type Regle = (contexte: ContexteRegle) => ResultatRegle | null;
