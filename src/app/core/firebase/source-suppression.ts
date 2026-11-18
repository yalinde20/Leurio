import type { Injector } from '@angular/core';
import type { SourceSuppression } from '../data/suppression-compte.service';
import { versCompteLie } from './source-liaison';

/** Au-delà de ce délai depuis la dernière connexion, Firebase Auth demande de se reconnecter avant de supprimer le compte. */
const CONNEXION_RECENTE_MS = 5 * 60_000;

/**
 * Suppression du compte dans Firebase (PLAN §2.5, §4, §7) : photos de `users/{uid}/lures` (Storage), documents de `tackleBox` et `spots`,
 * `users/{uid}`, puis le compte d'authentification. `FirebaseService` et `firebase/*` ne se chargent qu'au premier appel (import dynamique).
 */
export function creerSourceSuppressionFirebase(injector: Injector): SourceSuppression {
  const firebase = async () => injector.get((await import('./firebase.service')).FirebaseService);
  const utilisateur = async () => {
    const { auth } = await firebase();
    await auth.authStateReady();
    const courant = auth.currentUser;
    if (!courant) throw Object.assign(new Error('Aucun compte connecté.'), { code: 'auth/no-current-user' });
    return courant;
  };
  return {
    async reconnexionRequise() {
      const courant = await utilisateur();
      const lie = versCompteLie(courant);
      if (!lie) return null;
      const derniere = Date.parse(courant.metadata.lastSignInTime ?? '');
      return Number.isNaN(derniere) || Date.now() - derniere > CONNEXION_RECENTE_MS ? lie.fournisseur : null;
    },
    async reconnecter(fournisseur) {
      const courant = await utilisateur();
      const { GoogleAuthProvider, OAuthProvider, reauthenticateWithPopup } = await import('firebase/auth');
      await reauthenticateWithPopup(courant, fournisseur === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com'));
    },
    async reconnecterEmail(motDePasse) {
      const courant = await utilisateur();
      const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
      await reauthenticateWithCredential(courant, EmailAuthProvider.credential(courant.email ?? '', motDePasse));
    },
    async supprimerDonnees() {
      const { uid } = await utilisateur();
      const { storage, db } = await firebase();
      const [{ ref, listAll, deleteObject }, { collection, doc, getDocs, deleteDoc }] = await Promise.all([
        import('firebase/storage'),
        import('firebase/firestore'),
      ]);
      const photos = await listAll(ref(storage, `users/${uid}/lures`));
      for (const photo of photos.items) await deleteObject(photo);
      for (const nom of ['tackleBox', 'spots']) {
        const documents = await getDocs(collection(db, 'users', uid, nom));
        for (const document of documents.docs) await deleteDoc(document.ref);
      }
      await deleteDoc(doc(db, 'users', uid));
    },
    async supprimerCompte() {
      const courant = await utilisateur();
      const { deleteUser } = await import('firebase/auth');
      await deleteUser(courant);
    },
  };
}
