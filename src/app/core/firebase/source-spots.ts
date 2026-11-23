import type { Injector } from '@angular/core';
import type { SourceSpots } from '../data/spots.service';

/**
 * Lecture et ajout des spots dans Firestore (`users/{uid}/spots`, PLAN §7). `FirebaseService` et `firebase/firestore`
 * ne se chargent qu'à la première utilisation (import dynamique) : l'écran « Conseil » ne les met pas dans son premier chunk.
 * Le cache local persistant de Firestore (PLAN §4) rend l'écriture et la lecture possibles hors ligne.
 */
export function creerSourceSpotsFirebase(injector: Injector): SourceSpots {
  const firebase = async () => injector.get((await import('./firebase.service')).FirebaseService);
  return {
    async uid() {
      const { auth } = await firebase();
      await auth.authStateReady();
      return auth.currentUser?.uid ?? null;
    },
    surUid(rappel, surErreur) {
      let arrete = false;
      let desabonner: () => void = () => undefined;
      void (async () => {
        const { auth } = await firebase();
        const { onAuthStateChanged } = await import('firebase/auth');
        if (arrete) return;
        desabonner = onAuthStateChanged(auth, (utilisateur) => rappel(utilisateur?.uid ?? null), surErreur);
      })().catch(surErreur);
      return () => {
        arrete = true;
        desabonner();
      };
    },
    async documents(uid) {
      const { db } = await firebase();
      const { collection, getDocs } = await import('firebase/firestore');
      const instantane = await getDocs(collection(db, 'users', uid, 'spots'));
      return instantane.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    ecouter(uid, surChangement, surErreur) {
      let arrete = false;
      let desabonner: () => void = () => undefined;
      void (async () => {
        const { db } = await firebase();
        const { collection, onSnapshot } = await import('firebase/firestore');
        if (arrete) return;
        desabonner = onSnapshot(
          collection(db, 'users', uid, 'spots'),
          { includeMetadataChanges: true },
          (instantane) => surChangement(instantane.docs.map((d) => ({ id: d.id, data: d.data(), enAttente: d.metadata.hasPendingWrites }))),
          surErreur,
        );
      })().catch(surErreur);
      return () => {
        arrete = true;
        desabonner();
      };
    },
    async ajouter(uid, data) {
      const { db } = await firebase();
      const { collection, doc, setDoc } = await import('firebase/firestore');
      // Le setDoc ne se résout qu'à l'accusé du serveur, absent hors ligne : on ne l'attend pas. L'écriture locale est faite
      // (la liste la voit tout de suite) ; un refus du serveur la retire de la liste.
      setDoc(doc(collection(db, 'users', uid, 'spots')), data).catch((erreur: unknown) =>
        console.warn("Le spot n'a pas pu être enregistré sur le serveur.", erreur),
      );
    },
  };
}
