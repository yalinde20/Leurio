import { Conditions } from '../conditions';
import { Animation, Espece, TypeLeurre } from '../../data/catalog.types';

/** Facteurs pondérés par `engine-weights.json` (PLAN §8.2). */
export interface PoidsMoteur {
  temperature: number;
  saison: number;
  clarte: number;
  luminosite: number;
  pression: number;
  lune: number;
  penaliteDifficulte: number;
  [facteur: string]: number;
}

/** Le couple évalué : un type de leurre, une animation, pour une espèce. */
export interface ContexteRegle {
  conditions: Conditions;
  espece: Espece;
  type: TypeLeurre;
  animation: Animation;
}

export interface ResultatRegle {
  facteur: keyof PoidsMoteur;
  /** Adéquation du couple, de 0 à 1 ; multipliée par le poids du facteur. */
  points: number;
  /** Phrase du « pourquoi », en français. */
  phrase: string;
}

/** Une règle rend `null` quand elle n'est pas déclenchée : elle ne compte pas et n'écrit rien. */
export type Regle = (contexte: ContexteRegle) => ResultatRegle | null;
