import { SourceTempEau } from './temperature-eau';

/** Saison météorologique (PLAN §8.1) : hiver de décembre à février, printemps de mars à mai, été de juin à août, automne de septembre à novembre. */
export type Saison = 'hiver' | 'printemps' | 'été' | 'automne';

const MOIS_PARIS = new Intl.DateTimeFormat('fr-FR', { month: 'numeric', timeZone: 'Europe/Paris' });

/** Saison météorologique d'un instant ; le mois est pris en heure de Paris (PLAN §8.1). */
export function saisonDe(instant: Date): Saison {
  const mois = Number(MOIS_PARIS.format(instant));
  if (mois === 12 || mois <= 2) return 'hiver';
  if (mois <= 5) return 'printemps';
  if (mois <= 8) return 'été';
  return 'automne';
}

/**
 * Tout ce que le moteur sait d'un lieu et d'un moment (PLAN §8.1).
 * Une valeur que l'on n'a pas vaut `null` (ou « inconnu » pour la tendance du débit) : jamais de valeur inventée.
 */
export interface Conditions {
  /** Température de l'eau en °C, `null` si inconnue. */
  tempEau: number | null;
  /** D'où vient `tempEau` ; `null` si elle est inconnue. */
  sourceTempEau: SourceTempEau | null;
  debitTendance: 'crue' | 'normal' | 'étiage' | 'inconnu';
  /** Écart de pression sur 48 h en hPa, `null` si indisponible. */
  pressionTendance48h: number | null;
  /** Couverture nuageuse en %, `null` si la météo est indisponible. */
  nuages: number | null;
  /** Vent en km/h, `null` si la météo est indisponible. */
  vent: number | null;
  moment: 'aube' | 'jour' | 'crépuscule' | 'nuit';
  saison: Saison;
  /** Catégorie piscicole du cours d'eau ; `null` pour une position GPS sans spot. */
  categorie: 1 | 2 | null;
  departement: string;
  /** Code de l'espèce visée ; absent quand on les vise toutes. */
  especeCible?: string;
  niveau: 'debutant' | 'intermediaire';
}
