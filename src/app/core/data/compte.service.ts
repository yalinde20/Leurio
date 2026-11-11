import { Injectable, InjectionToken } from '@angular/core';
import type { UserDoc } from '../firebase/user-doc';
import type { ChoixOnboarding } from './onboarding.store';

// STUB vide (US 90, tests d'acceptation) : l'implémentation viendra avec la story.
export interface SourceCompte {
  uidCourant(): Promise<string | null>;
  connecterAnonymement(): Promise<string>;
  profilExiste(uid: string): Promise<boolean>;
  ecrireProfil(uid: string, doc: UserDoc): Promise<void>;
}

export const SOURCE_COMPTE = new InjectionToken<SourceCompte>('SOURCE_COMPTE');

@Injectable({ providedIn: 'root' })
export class CompteService {
  async assurerCompte(choix: ChoixOnboarding): Promise<void> {
    void choix; // À implémenter.
  }
}
