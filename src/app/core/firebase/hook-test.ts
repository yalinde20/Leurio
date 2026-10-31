// Point d'accès des tests e2e aux instances Firebase, sur les émulateurs seulement (US 36).
// Appelé derrière la constante `emulateurs` : le build de production réel retire ce fichier.
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, waitForPendingWrites } from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';
import { getToken } from 'firebase/app-check';
import type { FirebaseService } from './firebase.service';

export function exposerPourLesTests(f: FirebaseService): void {
  (window as unknown as { leurioFirebase: unknown }).leurioFirebase = {
    app: f.app,
    auth: f.auth,
    db: f.db,
    storage: f.storage,
    appCheck: f.appCheck,
    sdk: {
      auth: { signInAnonymously },
      firestore: { doc, getDoc, setDoc, waitForPendingWrites },
      storage: { ref, uploadString },
      appCheck: { getToken },
    },
  };
}
