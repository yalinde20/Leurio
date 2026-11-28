import { Conditions } from '../../core/engine/conditions';
import { ReleveActuel } from '../../core/data/conditions.service';
import { formaterTemperature, Unites } from '../../shared/unites';

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

/** « 11,5 °C » (« 52,7 °F » en impérial) ou « Inconnue ». */
export function formaterTempEau(tempEau: number | null, unites: Unites = 'metriques'): string {
  return tempEau === null ? INCONNUE : formaterTemperature(tempEau, unites).replace(/\s/g, ' ');
}

/** La source de la température de l'eau, ou `null` quand il n'y a rien à dire. */
export function formaterSourceTempEau(releve: ReleveActuel): string | null {
  const { sourceTempEau, tempEau } = releve.conditions;
  if (tempEau === null) return null;
  if (sourceTempEau === 'capteur' && releve.stationEau) {
    return `Station Hub'Eau ${releve.stationEau.nom}, à ${nombre.format(releve.stationEau.distanceKm)} km`;
  }
  if (sourceTempEau === 'estimation') return "Estimée depuis l'air des derniers jours";
  if (sourceTempEau === 'saisie' && releve.saisieA)
    return `Mesurée au thermomètre à ${formaterHeure(releve.saisieA)}`;
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
export function formaterPression(
  pressionHpa: number | null,
  tendance48h: Conditions['pressionTendance48h'],
): string {
  if (pressionHpa === null) return INDISPONIBLE;
  const base = `${Math.round(pressionHpa)} hPa`;
  if (tendance48h === null) return base;
  const ecart = Math.round(tendance48h);
  const signe = ecart < 0 ? MOINS : ecart > 0 ? '+' : '';
  return `${base} (${signe}${Math.abs(ecart)} hPa en 48 h)`;
}

export function formaterCiel(nuages: number | null): string {
  return nuages === null ? INDISPONIBLE : `${nombre.format(nuages)} % de nuages`;
}

export function formaterVent(vent: number | null): string {
  return vent === null ? INDISPONIBLE : `${Math.round(vent)} km/h`;
}

/** « 7 h 02 – 18 h 31 » (demi-cadratin). */
export function formaterHeuresLegales(debut: Date, fin: Date): string {
  return `${formaterHeure(debut)} – ${formaterHeure(fin)}`;
}

/** Le ciel en un mot, d'après la couverture nuageuse (pourcentage). */
function motCiel(nuages: number): string {
  if (nuages < 25) return 'Dégagé';
  if (nuages < 60) return 'Peu nuageux';
  if (nuages < 85) return 'Nuageux';
  return 'Couvert';
}

/** « Nuageux, vent 12 km/h » : la ligne météo sous la température de l'eau ; chaque partie manquante est omise. */
export function formaterMeteo(nuages: number | null, vent: number | null): string {
  const ciel = nuages === null ? null : motCiel(nuages);
  const venteuse = vent === null ? 'vent indisponible' : `vent ${Math.round(vent)} km/h`;
  if (ciel === null) return `${venteuse.charAt(0).toUpperCase()}${venteuse.slice(1)}`;
  return `${ciel}, ${venteuse}`;
}
