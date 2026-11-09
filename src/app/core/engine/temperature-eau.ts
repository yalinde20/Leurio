/** D'où vient la température de l'eau : capteur Hub'Eau, estimation depuis l'air, ou saisie au thermomètre (PLAN §4). */
export type SourceTempEau = 'capteur' | 'estimation' | 'saisie';

/**
 * Estime la température de l'eau depuis la moyenne de l'air des derniers jours (PLAN §8.2) : la moyenne, bornée à 0 °C.
 * La source rendue est toujours « estimation ».
 */
export function estimerTempEau(moyenneAirC: number): { tempEauC: number; source: 'estimation' } {
  // Math.max(0, -0) rend +0 : jamais de −0 affiché.
  return { tempEauC: Math.max(0, moyenneAirC), source: 'estimation' };
}

/** Durée de validité, en heures, d'une température saisie au thermomètre (PLAN §8.2). */
export const DUREE_MAX_SAISIE_H = 6;

/** Bornes, en °C, d'une température saisie au thermomètre. */
export const TEMP_SAISIE_MIN_C = 0;
export const TEMP_SAISIE_MAX_C = 35;

/** Température de l'eau mesurée par l'utilisateur au thermomètre, avec l'instant de la mesure (PLAN §8.2). */
export interface SaisieTempEau {
  valeurC: number;
  mesureeA: Date;
}

/**
 * Dit si une saisie au thermomètre est encore valable au moment visé (PLAN §8.2) : valeur finie, date valide,
 * et âge (moment − mesure) d'au moins 0 et strictement inférieur à 6 h. Une saisie postérieure au moment est refusée.
 */
export function saisieRecente(saisie: SaisieTempEau | undefined, moment: Date): boolean {
  if (saisie === undefined || !Number.isFinite(saisie.valeurC)) return false;
  const ageMs = moment.getTime() - saisie.mesureeA.getTime();
  return ageMs >= 0 && ageMs < DUREE_MAX_SAISIE_H * 3_600_000;
}
