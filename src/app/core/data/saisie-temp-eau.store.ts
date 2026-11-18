import { Injectable } from '@angular/core';
import { SaisieTempEau, TEMP_SAISIE_MAX_C, TEMP_SAISIE_MIN_C } from '../engine/temperature-eau';

const CLE = 'leurio.saisieTempEau';

/** La température mesurée au thermomètre, gardée sur le téléphone (localStorage). Ne lève jamais. */
@Injectable({ providedIn: 'root' })
export class SaisieTempEauStore {
  /** La dernière saisie, ou `null` si rien n'est gardé, si le stockage est inaccessible ou si son contenu est corrompu. */
  lire(): SaisieTempEau | null {
    try {
      const brut = localStorage.getItem(CLE);
      if (brut === null) return null;
      const donnees: unknown = JSON.parse(brut);
      if (typeof donnees !== 'object' || donnees === null) return null;
      const { valeurC, mesureeA } = donnees as Record<string, unknown>;
      if (typeof valeurC !== 'number' || !Number.isFinite(valeurC) || valeurC < TEMP_SAISIE_MIN_C || valeurC > TEMP_SAISIE_MAX_C || typeof mesureeA !== 'string') return null;
      const date = new Date(mesureeA);
      return Number.isNaN(date.getTime()) ? null : { valeurC, mesureeA: date };
    } catch {
      return null;
    }
  }

  /** Remplace la saisie gardée. Un stockage plein ou inaccessible est ignoré : la page garde la mesure en mémoire, mais elle ne survit pas à la fermeture de l'app. */
  ecrire(saisie: SaisieTempEau): void {
    try {
      localStorage.setItem(CLE, JSON.stringify({ valeurC: saisie.valeurC, mesureeA: saisie.mesureeA.toISOString() }));
    } catch {
      // Sans stockage, la mesure ne survit pas à la fermeture de l'app.
    }
  }

  /** Retire la saisie gardée (suppression du compte, US 98). */
  effacer(): void {
    try {
      localStorage.removeItem(CLE);
    } catch {
      // Stockage inaccessible : rien à retirer.
    }
  }
}
