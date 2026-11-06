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
