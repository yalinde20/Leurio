/*
 * US 131, critère 3 : sous les tests automatisés (configuration par défaut, émulateurs), FirebaseService utilise le fournisseur
 * factice habituel et ne construit aucun fournisseur reCAPTCHA : aucun appel à un service externe.
 * firebase/app-check est espionné (le vrai SDK est gardé) ; les autres modules firebase/* sont remplacés par des doubles.
 */
const { construits } = vi.hoisted(() => ({ construits: [] as string[] }));

vi.mock('firebase/app-check', async (importOriginal) => {
  const reel = await importOriginal<typeof import('firebase/app-check')>();
  type Ctor = new (...a: unknown[]) => object;
  const espion = (nom: string, Classe: unknown) =>
    class extends (Classe as Ctor) {
      constructor(...a: unknown[]) {
        super(...a);
        construits.push(nom);
      }
    };
  return {
    ...reel,
    CustomProvider: espion('CustomProvider', reel.CustomProvider),
    ReCaptchaV3Provider: espion('ReCaptchaV3Provider', reel.ReCaptchaV3Provider),
    ReCaptchaEnterpriseProvider: espion('ReCaptchaEnterpriseProvider', reel.ReCaptchaEnterpriseProvider),
    initializeAppCheck: () => ({ double: true }),
  };
});
vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({}), connectAuthEmulator: () => undefined }));
vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}),
  persistentLocalCache: () => ({}),
  persistentMultipleTabManager: () => ({}),
  connectFirestoreEmulator: () => undefined,
}));
vi.mock('firebase/storage', () => ({ getStorage: () => ({}), connectStorageEmulator: () => undefined }));

describe('FirebaseService : App Check sous les tests (US 131)', () => {
  it('critère 3 : given les tests automatisés, when le service Firebase est instancié, then le fournisseur factice est utilisé et aucun reCAPTCHA n\'est construit', async () => {
    construits.length = 0;
    const { FirebaseService } = await import('./firebase.service');
    new FirebaseService();
    expect(construits).toEqual(['CustomProvider']);
  });
});
