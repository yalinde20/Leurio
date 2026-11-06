import { Conditions } from '../../core/engine/conditions';
import { ReleveActuel } from '../../core/data/conditions.service';

const INCONNUE = 'Inconnue';
const INDISPONIBLE = 'Indisponible';
const MOINS = '−';

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, useGrouping: false });
const heureParis = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** « 7 h 02 », à l'heure de Paris. */
export function formaterHeure(date: Date): string {
  const parties = heureParis.formatToParts(date);
  const valeur = (type: string) => parties.find((p) => p.type === type)?.value ?? '';
  return `${Number(valeur('hour'))} h ${valeur('minute')}`;
}

/** « 11,5 °C » ou « Inconnue ». */
export function formaterTempEau(tempEau: number | null): string {
  return tempEau === null ? INCONNUE : `${nombre.format(tempEau)} °C`;
}

/** La source de la température de l'eau, ou `null` quand il n'y a rien à dire. */
export function formaterSourceTempEau(releve: ReleveActuel): string | null {
  const { sourceTempEau, tempEau } = releve.conditions;
  if (tempEau === null) return null;
  if (sourceTempEau === 'capteur' && releve.stationEau) {
    return `Station Hub'Eau ${releve.stationEau.nom}, à ${nombre.format(releve.stationEau.distanceKm)} km`;
  }
  if (sourceTempEau === 'estimation') return "Estimée depuis l'air des derniers jours";
  if (sourceTempEau === 'saisie' && releve.saisieA) return `Mesurée au thermomètre à ${formaterHeure(releve.saisieA)}`;
  return null;
}

export function formaterDebit(releve: ReleveActuel): string {
  switch (releve.conditions.debitTendance) {
    case 'crue':
      return 'En crue';
    case 'normal':
      return 'Normal';
    case 'étiage':
      return "À l'étiage";
    default:
      return releve.debitAbsent === 'aucune station' ? 'Pas de station proche' : INDISPONIBLE;
  }
}

/** « 1012 hPa (−8 hPa en 48 h) » ; la tendance est omise si elle manque. */
export function formaterPression(pressionHpa: number | null, tendance48h: Conditions['pressionTendance48h']): string {
  if (pressionHpa === null) return INDISPONIBLE;
  const base = `${nombre.format(pressionHpa)} hPa`;
  if (tendance48h === null) return base;
  const signe = tendance48h < 0 ? MOINS : tendance48h > 0 ? '+' : '';
  return `${base} (${signe}${nombre.format(Math.abs(tendance48h))} hPa en 48 h)`;
}

export function formaterCiel(nuages: number | null): string {
  return nuages === null ? INDISPONIBLE : `${nombre.format(nuages)} % de nuages`;
}

export function formaterVent(vent: number | null): string {
  return vent === null ? INDISPONIBLE : `${nombre.format(vent)} km/h`;
}

/** « 7 h 02 – 18 h 31 » (demi-cadratin). */
export function formaterHeuresLegales(debut: Date, fin: Date): string {
  return `${formaterHeure(debut)} – ${formaterHeure(fin)}`;
}
