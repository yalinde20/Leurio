import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { AppCheck, initializeAppCheck } from 'firebase/app-check';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  Firestore,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { FirebaseStorage, connectStorageEmulator, getStorage } from 'firebase/storage';
import { choisirFournisseurAppCheck } from './app-check';
import { config, emulateurs } from './config';
import { EMULATEURS } from './emulateurs';
import { exposerPourLesTests } from './hook-test';

/** Durée maximale des nouvelles tentatives de Storage (envoi et suppression d'une photo), en millisecondes. */
const DELAI_MAX_STORAGE_MS = 20_000;

/**
 * Seul point d'entrée de Firebase dans l'app (PLAN §4, §5) : Auth, Firestore, Storage et App Check.
 * Firestore garde un cache local persistant (IndexedDB) pour lire et écrire hors ligne (PLAN §4).
 * Sur les émulateurs, aucune requête ne part vers un vrai projet ni vers un service Google.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app: FirebaseApp = initializeApp(config.firebase);
  readonly appCheck: AppCheck = this.initialiserAppCheck();
  readonly auth: Auth = getAuth(this.app);
  readonly db: Firestore = initializeFirestore(this.app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  readonly storage: FirebaseStorage = getStorage(this.app);

  constructor() {
    if (emulateurs) {
      const { hote } = EMULATEURS;
      connectAuthEmulator(this.auth, `http://${hote}:${EMULATEURS.auth}`, { disableWarnings: true });
      connectFirestoreEmulator(this.db, hote, EMULATEURS.firestore);
      connectStorageEmulator(this.storage, hote, EMULATEURS.storage);
    }
    // Sans réseau, Storage réessaie 2 à 10 minutes par défaut : on abandonne vite pour que l'écran réponde.
    this.storage.maxUploadRetryTime = DELAI_MAX_STORAGE_MS;
    this.storage.maxOperationRetryTime = DELAI_MAX_STORAGE_MS;
  }

  /** Expose les instances aux tests e2e, sur les émulateurs seulement. */
  exposerPourLesTests(): void {
    if (emulateurs) {
      exposerPourLesTests(this);
    }
  }

  private initialiserAppCheck(): AppCheck {
    const provider = choisirFournisseurAppCheck(
      { natif: Capacitor.isNativePlatform(), emulateurs, cleSite: config.appCheckSiteKey },
      () => import('@capacitor-firebase/app-check').then((m) => m.FirebaseAppCheck),
    );
    return initializeAppCheck(this.app, { provider, isTokenAutoRefreshEnabled: !emulateurs });
  }
}
