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
    /**
     * Lit d'abord le serveur (`getDoc`, qui se rabat sur le cache hors ligne). Si cela échoue (hors ligne et sans cache), la promesse reste en
     * attente jusqu'au retour du réseau au lieu d'échouer : un retrait de consentement fait entre-temps sera écrit à ce moment-là.
     */
    async lireConsentements(uid) {
      const { db } = await firebase();
      const { doc, getDoc, onSnapshot } = await import('firebase/firestore');
      const reference = doc(db, 'users', uid);
      const lire = (instantane: { exists(): boolean; data(): unknown }) => {
        if (!instantane.exists()) return null;
        const { consentements } = instantane.data() as Partial<UserDoc>;
        return { analytics: consentements?.analytics === true, video: typeof consentements?.video === 'boolean' ? consentements.video : null };
      };
      try {
        return lire(await getDoc(reference));
      } catch {
        return new Promise((resolve, reject) => {
          const arreter = onSnapshot(
            reference,
            { includeMetadataChanges: true },
            (instantane) => {
              if (instantane.metadata.fromCache && !instantane.exists()) return;
              arreter();
              resolve(lire(instantane));
            },
            reject,
          );
        });
      }
    },
  };
}
