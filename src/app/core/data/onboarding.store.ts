import { Injectable } from '@angular/core';

export interface ChoixOnboarding {
  niveau: 'debutant' | 'intermediaire';
  especesFavorites: string[];
}

// STUB vide (US 89, tests d'acceptation) : l'implémentation vient après les tests.
@Injectable({ providedIn: 'root' })
export class OnboardingStore {
  localisationDifferee = false;

  lire(): ChoixOnboarding | null {
    return null;
  }

  terminer(choix: ChoixOnboarding): void {
    void choix;
  }
}
