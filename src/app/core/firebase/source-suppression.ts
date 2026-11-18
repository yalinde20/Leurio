import type { Injector } from '@angular/core';
import type { User } from 'firebase/auth';
import type { SourceSuppression } from '../data/suppression-compte.service';
import { versCompteLie } from './source-liaison';

/** Au-delà de ce délai depuis la dernière connexion, Firebase Auth demande de se reconnecter avant de supprimer le compte. */
const CONNEXION_RECENTE_MS = 5 * 60_000;

/** Même délai que `FirebaseService` pour Storage : au-delà, une opération de suppression est considérée comme échouée (hors ligne, serveur muet). */
const DELAI_MAX_OPERATION_MS = 20_000;

/** Rejette si `operation` ne répond pas à temps : Firestore n'accuse réception d'une suppression qu'une fois le serveur joint. */
function avecDelai<T>(operation: Promise<T>): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout>;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(Object.assign(new Error('Suppression trop longue.'), { code: 'suppression/delai' })), DELAI_MAX_OPERATION_MS);
  });
  return Promise.race([operation, delai]).finally(() => clearTimeout(minuteur));
}

/** Rejette si la liste vient du cache local : des documents du serveur pourraient manquer et resteraient orphelins une fois le compte supprimé. */
function verifierDuServeur(instantane: { metadata?: { fromCache?: boolean } }): void {
  if (instantane.metadata?.fromCache === true) throw Object.assign(new Error('Liste incomplète (hors ligne).'), { code: 'suppression/cache' });
}

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
  /** Chargés par `reconnexionRequise` pour que `reconnecter` ouvre la fenêtre sans `await` préalable (Safari la bloque sinon). */
  let pret: { service: Awaited<ReturnType<typeof firebase>>; courant: User; module: typeof import('firebase/auth') } | null = null;
  const ouvrirFenetre = async (courant: User, module: typeof import('firebase/auth'), fournisseur: 'google' | 'apple'): Promise<void> => {
    await module.reauthenticateWithPopup(courant, fournisseur === 'google' ? new module.GoogleAuthProvider() : new module.OAuthProvider('apple.com'));
  };
  return {
    async reconnexionRequise() {
      const courant = await utilisateur();
      const lie = versCompteLie(courant);
      if (!lie) return null;
      pret = { service: await firebase(), courant, module: await import('firebase/auth') };
      const derniere = Date.parse(courant.metadata.lastSignInTime ?? '');
      return Number.isNaN(derniere) || Date.now() - derniere > CONNEXION_RECENTE_MS ? lie.fournisseur : null;
    },
    reconnecter(fournisseur) {
      // Chemin du clic : aucun `await` avant la fenêtre quand `reconnexionRequise` a déjà tout chargé.
      if (pret && pret.service.auth.currentUser === pret.courant) return ouvrirFenetre(pret.courant, pret.module, fournisseur);
      return (async () => ouvrirFenetre(await utilisateur(), await import('firebase/auth'), fournisseur))();
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
      // Tout est lu avant de supprimer quoi que ce soit : une liste venue du cache fait échouer l'opération sans rien effacer.
      const photos = await avecDelai(listAll(ref(storage, `users/${uid}/lures`)));
      const listes = [];
      for (const nom of ['tackleBox', 'spots']) {
        const instantane = await avecDelai(getDocs(collection(db, 'users', uid, nom)));
        verifierDuServeur(instantane);
        listes.push(instantane.docs);
      }
      for (const photo of photos.items) await avecDelai(deleteObject(photo));
      for (const documents of listes) for (const document of documents) await avecDelai(deleteDoc(document.ref));
      await avecDelai(deleteDoc(doc(db, 'users', uid)));
    },
    async supprimerCompte() {
      const courant = await utilisateur();
      const { deleteUser } = await import('firebase/auth');
      await deleteUser(courant);
    },
  };
}
