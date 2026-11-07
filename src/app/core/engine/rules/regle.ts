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
  /** Pourcentage de nuages à partir duquel le ciel est couvert. */
  seuilCielCouvert: number;
  [facteur: string]: number | string[];
}

/** Le couple évalué : un type de leurre, une animation, pour une espèce. */
export interface ContexteRegle {
  conditions: Conditions;
  espece: Espece;
  type: TypeLeurre;
  animation: Animation;
  /** Les couleurs du contenu, dans l'ordre du contenu. */
  couleurs: Couleur[];
  /** Poids du moteur ; les règles qui ont un seuil ou une liste dans le contenu les lisent ici (absents, elles se taisent ou, pour la luminosité, seul le moment compte). */
  poids?: PoidsMoteur;
}

/** Taille (cm) ou poids (g) conseillé pour un type de leurre. */
export interface TailleLeurre {
  valeur: number;
  unite: 'cm' | 'g';
}

export interface ResultatRegle {
  facteur: keyof PoidsMoteur;
  /** Adéquation du couple, de 0 à 1 ; multipliée par le poids du facteur. Seule la pénalité de difficulté va au-delà : l'écart de niveaux (1 ou 2). */
  points: number;
  /** Phrase du « pourquoi », en français. */
  phrase: string;
  /** Identifiant de la couleur de leurre conseillée par la règle, s'il y en a une. */
  couleur?: string;
  /** Taille ou poids du leurre conseillé par la règle, s'il y en a un. */
  taille?: TailleLeurre;
}

/** Une règle rend `null` quand elle n'est pas déclenchée : elle ne compte pas et n'écrit rien. */
export type Regle = (contexte: ContexteRegle) => ResultatRegle | null;
