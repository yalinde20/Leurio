import { inject, InjectionToken, Injector } from '@angular/core';
import { creerSourceLiaisonFirebase } from '../firebase/source-liaison';

export type FournisseurLiaison = 'google' | 'apple' | 'email';

export interface CompteLie {
  fournisseur: FournisseurLiaison;
  /** `null` si le fournisseur n'en donne pas (Apple, adresse masquée ou absente). */
  email: string | null;
}

/** Liaison du compte anonyme à Google, Apple ou une adresse e-mail (PLAN §2.5, §4). */
export interface SourceLiaison {
  /** Le compte déjà lié au lancement ; `null` tant que le compte est anonyme ou absent. */
  compteLie(): Promise<CompteLie | null>;
  /**
   * Ouvre la fenêtre du fournisseur et lie le compte anonyme courant (même uid : rien n'est copié ni supprimé).
   * Rejette avec un objet portant `code` (code d'erreur Firebase Auth).
   */
  lier(fournisseur: 'google' | 'apple'): Promise<CompteLie>;
  /**
   * Lie le compte anonyme courant à l'adresse et au mot de passe (même uid : rien n'est copié ni supprimé ; aucun e-mail de vérification).
   * Rejette avec un objet portant `code` (code d'erreur Firebase Auth).
   */
  lierEmail(email: string, motDePasse: string): Promise<CompteLie>;
}

export const SOURCE_LIAISON = new InjectionToken<SourceLiaison>('SOURCE_LIAISON', {
  providedIn: 'root',
  factory: () => creerSourceLiaisonFirebase(inject(Injector)),
});
