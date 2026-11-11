import type { Injector } from '@angular/core';
import type { SourceCompte } from '../data/compte.service';

/**
 * Compte anonyme et profil `users/{uid}` dans Firebase (PLAN §4, §7). `FirebaseService`, `firebase/auth` et
 * `firebase/firestore` ne se chargent qu'au premier appel (import dynamique) : le bundle initial reste léger.
 */
export function creerSourceCompteFirebase(injector: Injector): SourceCompte {
  const firebase = async () => injector.get((await import('./firebase.service')).FirebaseService);
  return {
    async uidCourant() {
      const { auth } = await firebase();
      await auth.authStateReady();
      return auth.currentUser?.uid ?? null;
    },
    async connecterAnonymement() {
      const { auth } = await firebase();
      const { signInAnonymously } = await import('firebase/auth');
      return (await signInAnonymously(auth)).user.uid;
    },
    async profilExiste(uid) {
      const { db } = await firebase();
      const { doc, getDocFromServer } = await import('firebase/firestore');
      // Lecture au serveur : hors ligne elle échoue (l'appelant réessaiera) au lieu de dire « absent » à tort depuis le cache.
      return (await getDocFromServer(doc(db, 'users', uid))).exists();
    },
    async ecrireProfil(uid, profil) {
      const { db } = await firebase();
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'users', uid), profil);
    },
  };
}
