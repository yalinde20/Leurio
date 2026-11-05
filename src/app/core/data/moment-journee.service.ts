import { Injectable } from '@angular/core';
import { getTimes } from 'suncalc';
import type { Lieu } from './weather-provider';

export type MomentJournee = 'aube' | 'jour' | 'crépuscule' | 'nuit';

/**
 * Dit si l'on est à l'aube, de jour, au crépuscule ou de nuit (entrée `moment` des conditions, PLAN §8.1).
 * Calcul local avec suncalc (PLAN §4), sans réseau. Le crépuscule est civil (soleil à 6° sous l'horizon).
 * Intervalles semi-ouverts : [aube, lever[ aube, [lever, coucher[ jour, [coucher, fin du crépuscule[ crépuscule, sinon nuit.
 */
@Injectable({ providedIn: 'root' })
export class MomentJourneeService {
  moment(lieu: Lieu, instant: Date): MomentJournee {
    const { dawn, sunrise, sunset, dusk } = getTimes(instant, lieu.latitude, lieu.longitude);
    const t = instant.getTime();
    // Une heure absente ou invalide (nuit ou jour polaires) ne délimite aucun intervalle : on retombe sur « nuit ».
    const dans = (debut: Date | null | undefined, fin: Date | null | undefined) => {
      const d = debut?.getTime();
      const f = fin?.getTime();
      return d !== undefined && f !== undefined && !Number.isNaN(d) && !Number.isNaN(f) && t >= d && t < f;
    };

    if (dans(dawn, sunrise)) return 'aube';
    if (dans(sunrise, sunset)) return 'jour';
    if (dans(sunset, dusk)) return 'crépuscule';
    return 'nuit';
  }
}
