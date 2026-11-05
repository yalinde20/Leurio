import { Injectable } from '@angular/core';
import { getMoonIllumination, getTimes } from 'suncalc';
import { Lieu } from './weather-provider';

/** Les huit phases de la lune, dans l'ordre du cycle. */
export const PHASES_LUNE = [
  'Nouvelle lune',
  'Premier croissant',
  'Premier quartier',
  'Gibbeuse croissante',
  'Pleine lune',
  'Gibbeuse décroissante',
  'Dernier quartier',
  'Dernier croissant',
] as const;

export type NomPhaseLune = (typeof PHASES_LUNE)[number];

/** Lever et coucher du soleil ; `null` quand le soleil ne se lève ou ne se couche pas ce jour-là. */
export interface SoleilDuJour {
  lever: Date | null;
  coucher: Date | null;
}

export interface LuneDuMoment {
  phase: NomPhaseLune;
  /** Part éclairée du disque, de 0 (nouvelle lune) à 1 (pleine lune). */
  fractionEclairee: number;
}

const FUSEAU = 'Europe/Paris';

const formatFuseau = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSEAU,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

/** Écart de Paris à UTC (minutes, positif à l'est) à l'instant `instant`. */
function decalageParisMinutes(instant: Date): number {
  const valeur = (type: string): number => Number(parties.find((p) => p.type === type)?.value);
  const parties = formatFuseau.formatToParts(instant);
  const muralUtc = Date.UTC(valeur('year'), valeur('month') - 1, valeur('day'), valeur('hour'), valeur('minute'), valeur('second'));
  return Math.round((muralUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** Soleil et lune calculés en local avec suncalc : aucun accès réseau (PLAN §4). */
@Injectable({ providedIn: 'root' })
export class AstroService {
  /** Lever et coucher du soleil pour le jour civil français qui contient `jour`. */
  soleil(lieu: Lieu, jour: Date): SoleilDuJour {
    const temps = getTimes(jour, lieu.latitude, lieu.longitude, 0, decalageParisMinutes(jour));
    return { lever: temps.sunrise, coucher: temps.sunset };
  }

  /** Phase de la lune à `instant` (la phase ne dépend pas du lieu). */
  lune(instant: Date, lieu?: Lieu): LuneDuMoment {
    void lieu;
    const { fraction, phase } = getMoonIllumination(instant);
    // Huit secteurs centrés sur 0, 1/8, … 7/8 du cycle.
    const secteur = Math.floor(phase * 8 + 0.5) % 8;
    return { phase: PHASES_LUNE[secteur], fractionEclairee: fraction };
  }
}
