import type { Injector } from '@angular/core';
import type { SourceTackleBox } from '../data/tackle-box.service';

/**
 * Lecture et écriture de la boîte dans Firestore (`users/{uid}/tackleBox`, PLAN §7). `FirebaseService` et `firebase/firestore`
 * ne se chargent qu'à la première utilisation (import dynamique) : l'écran « Conseil » ne les met pas dans son premier chunk.
 * Le cache local persistant de Firestore (PLAN §4) rend l'écriture et la lecture possibles hors ligne.
 */
export function creerSourceTackleBoxFirebase(injector: Injector): SourceTackleBox {
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
    ecouter(uid, surChangement, surErreur) {
      let arrete = false;
      let desabonner: () => void = () => undefined;
      void (async () => {
        const { db } = await firebase();
        const { collection, onSnapshot } = await import('firebase/firestore');
        if (arrete) return;
        desabonner = onSnapshot(
          collection(db, 'users', uid, 'tackleBox'),
          { includeMetadataChanges: true },
          (instantane) =>
            surChangement(
              instantane.docs.map((d) => ({ id: d.id, data: d.data(), enAttente: d.metadata.hasPendingWrites })),
            ),
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
      setDoc(doc(collection(db, 'users', uid, 'tackleBox')), data).catch((erreur: unknown) =>
        console.warn("Le leurre n'a pas pu être enregistré sur le serveur.", erreur),
      );
    },
    async modifier(uid, id, data) {
      const { db } = await firebase();
      const { doc, updateDoc } = await import('firebase/firestore');
      // Comme `ajouter` : la promesse ne se résout qu'à l'accusé du serveur, on ne l'attend pas.
      updateDoc(doc(db, 'users', uid, 'tackleBox', id), data).catch((erreur: unknown) =>
        console.warn("La modification du leurre n'a pas pu être enregistrée sur le serveur.", erreur),
      );
    },
    async supprimer(uid, id) {
      const { db } = await firebase();
      const { deleteDoc, doc } = await import('firebase/firestore');
      deleteDoc(doc(db, 'users', uid, 'tackleBox', id)).catch((erreur: unknown) =>
        console.warn("La suppression du leurre n'a pas pu être enregistrée sur le serveur.", erreur),
      );
    },
  };
}
