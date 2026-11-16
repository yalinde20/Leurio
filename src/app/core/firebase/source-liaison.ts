import type { Injector } from '@angular/core';
import type { CompteLie, FournisseurLiaison, SourceLiaison } from '../data/liaison-compte';

const ID_FOURNISSEUR: Record<string, FournisseurLiaison> = { 'google.com': 'google', 'apple.com': 'apple', password: 'email' };

interface UtilisateurLiaison {
  email: string | null;
  providerData: readonly { providerId: string; email: string | null }[];
}

/** Le compte Google, Apple ou e-mail lié à l'utilisateur, `null` s'il est encore anonyme (aucun de ces fournisseurs). */
export function versCompteLie(utilisateur: UtilisateurLiaison | null): CompteLie | null {
  const info = utilisateur?.providerData.find((p) => p.providerId in ID_FOURNISSEUR);
  if (!utilisateur || !info) return null;
  return { fournisseur: ID_FOURNISSEUR[info.providerId], email: utilisateur.email ?? info.email ?? null };
}

/**
 * Liaison du compte anonyme à Google ou Apple dans Firebase Auth (PLAN §2.5, §4). Le compte courant est lié, pas remplacé :
 * l'uid reste le même, donc la boîte et les spots de `users/{uid}` restent en place. Connexion par fenêtre (web et PWA) ;
 * le plugin natif Capacitor n'est pas traité ici. `firebase/auth` ne se charge qu'au premier appel.
 */
export function creerSourceLiaisonFirebase(injector: Injector): SourceLiaison {
  const firebase = async () => injector.get((await import('./firebase.service')).FirebaseService);
  return {
    async compteLie() {
      const { auth } = await firebase();
      await auth.authStateReady();
      return versCompteLie(auth.currentUser);
    },
    async lier(fournisseur) {
      const { auth } = await firebase();
      await auth.authStateReady();
      const { GoogleAuthProvider, OAuthProvider, linkWithPopup } = await import('firebase/auth');
      const utilisateur = auth.currentUser;
      if (!utilisateur) throw Object.assign(new Error('Aucun compte à lier.'), { code: 'auth/no-current-user' });
      const prestataire = fournisseur === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
      prestataire.addScope('email');
      const { user } = await linkWithPopup(utilisateur, prestataire);
      const lie = versCompteLie(user);
      return lie ?? { fournisseur, email: user.email };
    },
    async lierEmail(email, motDePasse) {
      const { auth } = await firebase();
      await auth.authStateReady();
      const utilisateur = auth.currentUser;
      if (!utilisateur) throw Object.assign(new Error('Aucun compte à lier.'), { code: 'auth/no-current-user' });
      const { EmailAuthProvider, linkWithCredential } = await import('firebase/auth');
      const { user } = await linkWithCredential(utilisateur, EmailAuthProvider.credential(email, motDePasse));
      return versCompteLie(user) ?? { fournisseur: 'email', email: user.email ?? email };
    },
  };
}
