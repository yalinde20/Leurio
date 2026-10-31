import { Injectable } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { AppCheck, CustomProvider, ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  Firestore,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { FirebaseStorage, connectStorageEmulator, getStorage } from 'firebase/storage';
import { config, emulateurs } from './config';
import { EMULATEURS } from './emulateurs';
import { exposerPourLesTests } from './hook-test';

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
  }

  /** Expose les instances aux tests e2e, sur les émulateurs seulement. */
  exposerPourLesTests(): void {
    if (emulateurs) {
      exposerPourLesTests(this);
    }
  }

  private initialiserAppCheck(): AppCheck {
    if (emulateurs) {
      // Mode débogage de l'environnement de test (décision du propriétaire, US 36) : un fournisseur
      // local rend un jeton factice, sans FIREBASE_APPCHECK_DEBUG_TOKEN, car le vrai jeton de débogage
      // s'échange avec googleapis.com. Il servira contre le vrai projet (phase 5, application stricte).
      return initializeAppCheck(this.app, {
        provider: new CustomProvider({
          getToken: async () => ({ token: 'jeton-app-check-local', expireTimeMillis: Date.now() + 60 * 60 * 1000 }),
        }),
        isTokenAutoRefreshEnabled: false,
      });
    }
    // L'application stricte (enforcement) viendra plus tard : ici App Check est seulement initialisé.
    return initializeAppCheck(this.app, {
      provider: new ReCaptchaV3Provider(config.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}
