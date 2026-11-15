import type { Injector } from '@angular/core';
import type { SourceProfil } from '../data/profil.service';
import type { UserDoc } from './user-doc';

/**
 * Mise à jour de `users/{uid}` dans Firebase (PLAN §7). `FirebaseService` et `firebase/firestore` ne se chargent qu'au premier
 * appel (import dynamique). Hors ligne, le cache persistant de Firestore (PLAN §4) garde l'écriture et l'envoie au retour du réseau.
 */
export function creerSourceProfilFirebase(injector: Injector): SourceProfil {
  const firebase = async () => injector.get((await import('./firebase.service')).FirebaseService);
  return {
    async mettreAJour(uid, champs) {
      const { db } = await firebase();
      const { doc, updateDoc } = await import('firebase/firestore');
      // updateDoc ne touche qu'aux champs donnés ; la promesse se résout à l'accusé du serveur.
      await updateDoc(doc(db, 'users', uid), champs);
    },
    async lireConsentements(uid) {
      const { db } = await firebase();
      const { doc, getDoc } = await import('firebase/firestore');
      const instantane = await getDoc(doc(db, 'users', uid));
      if (!instantane.exists()) return null;
      const { consentements } = instantane.data() as Partial<UserDoc>;
      return { analytics: consentements?.analytics === true, video: consentements?.video === true };
    },
  };
}
