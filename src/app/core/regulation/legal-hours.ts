/** Marge, en minutes, avant le lever et après le coucher du soleil (PLAN §6). */
const MARGE_MINUTES = 30;

/** Heures légales de pêche d'un jour : de ½ h avant le lever à ½ h après le coucher du soleil. */
export interface HeuresLegales {
  debut: Date;
  fin: Date;
}

/** `null` quand le soleil ne se lève ou ne se couche pas ce jour-là : aucune heure n'est inventée. */
export function heuresLegales(soleil: { lever: Date | null; coucher: Date | null }): HeuresLegales | null {
  if (!soleil.lever || !soleil.coucher) return null;
  return {
    debut: new Date(soleil.lever.getTime() - MARGE_MINUTES * 60_000),
    fin: new Date(soleil.coucher.getTime() + MARGE_MINUTES * 60_000),
  };
}

/** Le moment est-il dans les heures légales ? Les deux bornes sont incluses (PLAN §6). */
export function dansHeuresLegales(moment: Date, heures: HeuresLegales): boolean {
  const t = moment.getTime();
  return t >= heures.debut.getTime() && t <= heures.fin.getTime();
}
