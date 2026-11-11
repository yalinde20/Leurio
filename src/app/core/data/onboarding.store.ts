import { Injectable } from '@angular/core';
import { ResultatPosition } from './position.service';

export interface ChoixOnboarding {
  niveau: 'debutant' | 'intermediaire';
  especesFavorites: string[];
}

/** Clé du localStorage où l'onboarding terminé est gardé (US 89). L'US 90 recopiera ces choix dans users/{uid}. */
const CLE = 'leurio.onboarding';

function estChoix(valeur: unknown): valeur is ChoixOnboarding {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const { niveau, especesFavorites } = valeur as Record<string, unknown>;
  return (
    (niveau === 'debutant' || niveau === 'intermediaire') &&
    Array.isArray(especesFavorites) &&
    especesFavorites.every((code) => typeof code === 'string')
  );
}

/** L'onboarding terminé (niveau et espèces favorites), gardé sur le téléphone. Ne lève jamais d'erreur. */
@Injectable({ providedIn: 'root' })
export class OnboardingStore {
  /** « Plus tard » touché pendant ce lancement : en mémoire seulement, jamais gardé. */
  localisationDifferee = false;

  /** La réponse du téléphone obtenue à la page 3, pour que « Conseil » ne redemande pas la position. Rendue une seule fois. */
  private positionObtenue: ResultatPosition | null = null;

  // Copie en mémoire : si le stockage est inaccessible, l'onboarding terminé ne boucle pas pendant ce lancement.
  private choix: ChoixOnboarding | null = null;

  /** Les choix de l'onboarding terminé ; `null` s'il n'est pas terminé ou si le stockage est illisible. */
  lire(): ChoixOnboarding | null {
    if (this.choix) return this.choix;
    try {
      const brut = localStorage.getItem(CLE);
      if (brut === null) return null;
      const valeur: unknown = JSON.parse(brut);
      return estChoix(valeur) ? { niveau: valeur.niveau, especesFavorites: valeur.especesFavorites } : null;
    } catch {
      return null;
    }
  }

  garderPosition(position: ResultatPosition): void {
    this.positionObtenue = position;
  }

  prendrePosition(): ResultatPosition | null {
    const position = this.positionObtenue;
    this.positionObtenue = null;
    return position;
  }

  terminer(choix: ChoixOnboarding): void {
    this.choix = choix;
    try {
      localStorage.setItem(CLE, JSON.stringify({ niveau: choix.niveau, especesFavorites: choix.especesFavorites }));
    } catch {
      // Stockage plein ou inaccessible : l'onboarding sera remontré au prochain lancement.
    }
  }
}
