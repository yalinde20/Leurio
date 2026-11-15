import { inject, InjectionToken, Injector } from '@angular/core';
import { creerSourceProfilFirebase } from '../firebase/source-profil';
import type { UserDoc } from '../firebase/user-doc';

/** Ce que « Préférences » et « Consentements » lisent et écrivent dans `users/{uid}` (remplacé par un double dans les tests). */
export interface SourceProfil {
  /**
   * Met à jour ces champs seulement. La promesse se résout à l'accusé du serveur : hors ligne elle reste en attente,
   * l'écriture est gardée par le cache persistant et envoyée au retour du réseau.
   */
  mettreAJour(uid: string, champs: Partial<Pick<UserDoc, 'niveau' | 'especesFavorites' | 'consentements'>>): Promise<void>;
  /** Les consentements de `users/{uid}` ; `null` si le document n'existe pas. */
  lireConsentements(uid: string): Promise<UserDoc['consentements'] | null>;
}

export const SOURCE_PROFIL = new InjectionToken<SourceProfil>('SOURCE_PROFIL', {
  providedIn: 'root',
  factory: () => creerSourceProfilFirebase(inject(Injector)),
});
