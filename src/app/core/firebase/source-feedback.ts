import type { Injector } from '@angular/core';
import type { SourceFeedback } from '../data/feedback.service';

/**
 * Création d'un avis dans la collection `feedback` (PLAN §7). `FirebaseService` et `firebase/firestore` ne se chargent qu'au
 * premier avis (import dynamique). Le cache local persistant de Firestore (PLAN §4) garde l'écriture hors ligne.
 */
export function creerSourceFeedbackFirebase(injector: Injector): SourceFeedback {
  return {
    async envoyer(feedback) {
      try {
        const { auth, db } = injector.get((await import('./firebase.service')).FirebaseService);
        // Les règles exigent un compte (anonyme) : on attend sa restauration locale, jamais le réseau.
        await auth.authStateReady();
        const { addDoc, collection } = await import('firebase/firestore');
        // L'addDoc ne se résout qu'à l'accusé du serveur, absent hors ligne : on ne l'attend pas.
        addDoc(collection(db, 'feedback'), feedback).catch((erreur: unknown) =>
          console.warn("L'avis n'a pas pu être enregistré sur le serveur.", erreur),
        );
      } catch (erreur) {
        console.warn("L'avis n'a pas pu être envoyé.", erreur);
      }
    },
  };
}
