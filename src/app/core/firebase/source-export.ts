import type { Injector } from '@angular/core';
import type { DocumentExport, SourceExport } from '../data/export.service';

/**
 * Lecture du profil, de la boîte et des spots dans Firestore (`users/{uid}`, PLAN §7) pour l'export (US 97).
 * Hors ligne (ou si la lecture réseau échoue), la lecture se fait depuis le cache persistant de Firestore.
 * `FirebaseService` et `firebase/firestore` ne se chargent qu'à la première lecture (import dynamique).
 */
export function creerSourceExportFirebase(injector: Injector): SourceExport {
  const firebase = async () => injector.get((await import('./firebase.service')).FirebaseService);
  return {
    async lire() {
      const { auth, db } = await firebase();
      await auth.authStateReady();
      const uid = auth.currentUser?.uid ?? null;
      if (uid === null) return { uid, profil: null, tackleBox: [], spots: [] };

      const { collection, doc, getDoc, getDocFromCache, getDocs, getDocsFromCache } = await import('firebase/firestore');
      const lire = async <T>(reseau: () => Promise<T>, cache: () => Promise<T>): Promise<T> => {
        if (navigator.onLine === false) return cache();
        try {
          return await reseau();
        } catch {
          return cache();
        }
      };
      const liste = async (nom: string): Promise<DocumentExport[]> => {
        const reference = collection(db, 'users', uid, nom);
        const instantane = await lire(
          () => getDocs(reference),
          () => getDocsFromCache(reference),
        );
        return instantane.docs.map((d) => ({ id: d.id, data: d.data() }));
      };

      const reference = doc(db, 'users', uid);
      const [profil, tackleBox, spots] = await Promise.all([
        lire(
          () => getDoc(reference),
          () => getDocFromCache(reference),
        ),
        liste('tackleBox'),
        liste('spots'),
      ]);
      return { uid, profil: profil.exists() ? profil.data() : null, tackleBox, spots };
    },
  };
}
