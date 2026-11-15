import { inject, InjectionToken, Injector } from '@angular/core';
import { creerSourceLiaisonFirebase } from '../firebase/source-liaison';

export type FournisseurLiaison = 'google' | 'apple';

export interface CompteLie {
  fournisseur: FournisseurLiaison;
  /** `null` si le fournisseur n'en donne pas (Apple, adresse masquée ou absente). */
  email: string | null;
}

/** Liaison du compte anonyme à Google ou Apple (PLAN §2.5, §4). */
export interface SourceLiaison {
  /** Le compte déjà lié au lancement ; `null` tant que le compte est anonyme ou absent. */
  compteLie(): Promise<CompteLie | null>;
  /**
   * Ouvre la fenêtre du fournisseur et lie le compte anonyme courant (même uid : rien n'est copié ni supprimé).
   * Rejette avec un objet portant `code` (code d'erreur Firebase Auth).
   */
  lier(fournisseur: FournisseurLiaison): Promise<CompteLie>;
}

export const SOURCE_LIAISON = new InjectionToken<SourceLiaison>('SOURCE_LIAISON', {
  providedIn: 'root',
  factory: () => creerSourceLiaisonFirebase(inject(Injector)),
});
