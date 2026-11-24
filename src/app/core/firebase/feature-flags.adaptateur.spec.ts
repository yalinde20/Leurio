// Adaptateur du vrai SDK Remote Config (US 21, critère 3). Le double modélise le SDK : les valeurs persistées ne sont chargées
// que par `ensureInitialized`, et `fetchAndActivate` n'en charge aucune et rejette sans réseau.
import type { FirebaseApp } from 'firebase/app';
import { adapterSdkRemoteConfig, creerPortFeatureFlags, SdkRemoteConfig } from './feature-flags';

function creerSdk(appareil: {
  enLigne: boolean;
  persiste: Record<string, boolean>;
  serveur: Record<string, boolean>;
}) {
  const appels: string[] = [];
  let actives: Record<string, boolean> = {};
  const defaut: Record<string, boolean> = {};
  const rc = {
    get defaultConfig() {
      return defaut;
    },
    set defaultConfig(v: Record<string, boolean>) {
      Object.assign(defaut, v);
    },
    settings: {},
  };
  const sdk = {
    isSupported: async () => true,
    getRemoteConfig: () => rc,
    ensureInitialized: async () => {
      appels.push('ensureInitialized');
      actives = { ...appareil.persiste };
    },
    fetchAndActivate: async () => {
      appels.push('fetchAndActivate');
      if (!appareil.enLigne) throw new Error('réseau');
      appareil.persiste = { ...appareil.serveur };
      actives = { ...appareil.persiste };
      return true;
    },
    getValue: (_rc: unknown, cle: string) => {
      const distant = cle in actives;
      return {
        asBoolean: () => (distant ? actives[cle] : (defaut[cle] ?? false)),
        getSource: () => (distant ? 'remote' : 'default'),
      };
    },
  } as unknown as SdkRemoteConfig;
  return { sdk, appels };
}

describe('US 21 : adaptateur du SDK Remote Config', () => {
  it('given le SDK, when on requête, then ensureInitialized est appelé avant fetchAndActivate (critère 3)', async () => {
    const { sdk, appels } = creerSdk({ enLigne: true, persiste: {}, serveur: {} });
    await adapterSdkRemoteConfig(sdk).fetchAndActivate(undefined as never);
    expect(appels).toEqual(['ensureInitialized', 'fetchAndActivate']);
  });

  it("given des valeurs reçues en ligne, when l'app est relancée hors ligne, then elle lit les dernières valeurs reçues (critère 3)", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const appareil = { enLigne: true, persiste: {}, serveur: { flagDeTest: true } };
    const lancer = () => {
      const { sdk } = creerSdk(appareil);
      return creerPortFeatureFlags(
        { emulateurs: false },
        async () => ({ module: adapterSdkRemoteConfig(sdk), app: 'app' as unknown as FirebaseApp }),
        {
          flagDeTest: false,
        },
      );
    };
    await lancer().initialiser();
    appareil.enLigne = false;
    const relance = lancer();
    await relance.initialiser();
    expect(relance.estActif('flagDeTest')).toBe(true);
    warn.mockRestore();
  });

  it('given un nom hérité de Object, when on le lit, then il est désactivé', async () => {
    const port = creerPortFeatureFlags({ emulateurs: true }, vi.fn());
    expect(port.estActif('toString')).toBe(false);
  });
});
