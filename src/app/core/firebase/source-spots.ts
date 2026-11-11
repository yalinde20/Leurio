import type { Injector } from '@angular/core';
import type { SourceSpots } from '../data/spots.service';

/**
 * Lecture des spots dans Firestore (`users/{uid}/spots`, PLAN §7). `FirebaseService` et `firebase/firestore`
 * ne se chargent qu'à la première lecture (import dynamique) : l'écran « Conseil » ne les met pas dans son premier chunk.
 */
export function creerSourceSpotsFirebase(injector: Injector): SourceSpots {
  const firebase = async () => injector.get((await import('./firebase.service')).FirebaseService);
  return {
    async uid() {
      const { auth } = await firebase();
      await auth.authStateReady();
      return auth.currentUser?.uid ?? null;
    },
    async documents(uid) {
      const { db } = await firebase();
      const { collection, getDocs } = await import('firebase/firestore');
      const instantane = await getDocs(collection(db, 'users', uid, 'spots'));
      return instantane.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
  };
}
