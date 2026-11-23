import { inject, Injectable, InjectionToken, Injector } from '@angular/core';
import { creerSourceFeedbackFirebase } from '../firebase/source-feedback';
import { Conditions } from '../engine/conditions';

/** Création d'un document de la collection `feedback` (PLAN §7). Ne rejette jamais : hors ligne, l'écriture attend le réseau. */
export interface SourceFeedback {
  envoyer(feedback: Record<string, unknown>): Promise<void>;
}

export const SOURCE_FEEDBACK = new InjectionToken<SourceFeedback>('SOURCE_FEEDBACK', {
  providedIn: 'root',
  factory: () => creerSourceFeedbackFirebase(inject(Injector)),
});

const UNE_HEURE_MS = 3600 * 1000;

/** Ce qui identifie le conseil noté. */
export interface ConseilNote {
  typeId: string;
  techniqueId: string;
}

const arrondir = (valeur: number | null): number | null => (valeur === null ? null : Math.round(valeur));

/**
 * Le document `feedback` d'un avis (PLAN §7) : conditions arrondies (eau et vent à l'entier, inconnus gardés à `null`),
 * sans position, sans uid ; date arrondie à l'heure (UTC).
 */
export function construireFeedback(conseil: ConseilNote, utile: boolean, conditions: Conditions, date: Date): Record<string, unknown> {
  return {
    conseilId: `${conseil.typeId}:${conseil.techniqueId}`,
    typeId: conseil.typeId,
    techniqueId: conseil.techniqueId,
    utile,
    conditions: {
      tempEau: arrondir(conditions.tempEau),
      vent: arrondir(conditions.vent),
      debitTendance: conditions.debitTendance,
      pressionTendance48h: conditions.pressionTendance48h,
      departement: conditions.departement,
    },
    date: new Date(Math.floor(date.getTime() / UNE_HEURE_MS) * UNE_HEURE_MS).toISOString(),
  };
}

/** Les avis 👍 / 👎 sur les conseils (PLAN §2.1, §7). */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly source = inject(SOURCE_FEEDBACK);

  /** Envoie l'avis sans l'attendre : un échec ne se voit pas à l'écran (l'écriture hors ligne part au retour du réseau). */
  donnerAvis(conseil: ConseilNote, utile: boolean, conditions: Conditions, date: Date): void {
    try {
      this.source.envoyer(construireFeedback(conseil, utile, conditions, date)).catch(() => undefined);
    } catch {
      // Un avis perdu ne gêne jamais le conseil.
    }
  }
}
