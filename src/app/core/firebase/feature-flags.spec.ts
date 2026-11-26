// Tests d'acceptation de l'US 21 : feature flags Remote Config (PLAN §4). Écrits avant l'implémentation.
//
// Interface attendue, dans `src/app/core/firebase/feature-flags.ts` (sur le modèle de mesure-audience.ts) :
//   - `FLAGS` : flags déclarés et leur valeur par défaut, dont le flag de test `flagDeTest: false`.
//   - `ModuleRemoteConfig` : sous-ensemble de `firebase/remote-config` utilisé, remplacé par un double ici :
//       getRemoteConfig(app): RemoteConfig                      (l'implémentation y pose defaultConfig = flags et un fetchTimeoutMillis)
//       fetchAndActivate(rc): Promise<boolean>                  (rejette sans réseau ; recharge d'abord les valeurs activées persistées)
//       getValue(rc, cle): { asBoolean(): boolean; getSource(): 'remote' | 'default' | 'static' }
//       isSupported(): Promise<boolean>
//   - `PortFeatureFlags` : `initialiser(): Promise<void>` (ne rejette jamais, rend la main en 10 s au plus même si le
//     réseau ne répond pas) et `estActif(nom: string): boolean` (synchrone, la valeur par défaut tant qu'on n'a rien reçu).
//   - `creerPortFeatureFlags(contexte: { emulateurs: boolean }, charger: () => Promise<{ module: ModuleRemoteConfig; app: FirebaseApp }>,
//        flags: Record<string, boolean> = FLAGS): PortFeatureFlags`
//     Inerte (valeurs par défaut, `charger` jamais appelé) sur les émulateurs. Un flag absent de la config distante vaut sa valeur par défaut.
//   - `FEATURE_FLAGS` : InjectionToken<PortFeatureFlags> (root) ; `appConfig` appelle `initialiser()` au démarrage sans l'attendre.
import type { FirebaseApp } from 'firebase/app';
import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig } from '../../app.config';
import { CLE_FLAGS_EMULATEURS, creerPortFeatureFlags, FEATURE_FLAGS, FLAGS, ModuleRemoteConfig, PortFeatureFlags } from './feature-flags';

type Source = 'remote' | 'default' | 'static';
interface RC {
  defaultConfig: Record<string, boolean>;
  settings: Record<string, unknown>;
}

/** Appareil simulé : le serveur Remote Config, le réseau et le stockage persistant (IndexedDB du SDK) partagé entre deux lancements. */
function creerAppareil(serveur: Record<string, boolean> = {}) {
  const etat = { enLigne: true, serveur, persiste: {} as Record<string, boolean>, reponse: 'normale' as 'normale' | 'muette' };
  function module(): ModuleRemoteConfig {
    let actives: Record<string, boolean> = {};
    return {
      isSupported: async () => true,
      getRemoteConfig: () => ({ defaultConfig: {}, settings: {} }) as RC,
      fetchAndActivate: async () => {
        actives = { ...etat.persiste }; // le SDK recharge d'abord les valeurs activées au lancement précédent
        if (etat.reponse === 'muette') return new Promise<boolean>(() => undefined);
        if (!etat.enLigne) throw new Error('réseau');
        etat.persiste = { ...etat.serveur };
        actives = { ...etat.persiste };
        return true;
      },
      getValue: (rc: RC, cle: string) => {
        const source: Source = cle in actives ? 'remote' : cle in rc.defaultConfig ? 'default' : 'static';
        const valeur = cle in actives ? actives[cle] : (rc.defaultConfig[cle] ?? false);
        return { asBoolean: () => valeur, getSource: () => source };
      },
    } as unknown as ModuleRemoteConfig;
  }
  const lancer = (flags: Record<string, boolean> = FLAGS): PortFeatureFlags => {
    const m = module();
    return creerPortFeatureFlags({ emulateurs: false }, async () => ({ module: m, app: 'app' as unknown as FirebaseApp }), flags);
  };
  return { etat, lancer };
}

describe('US 21 : feature flags Remote Config', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('given le flag de test déclaré « désactivé », when Remote Config renvoie « activé », then l\'app lit ce flag comme activé (critère 1)', async () => {
    expect(FLAGS.flagDeTest).toBe(false);
    const { lancer } = creerAppareil({ flagDeTest: true });
    const port = lancer();
    expect(port.estActif('flagDeTest')).toBe(false);
    await port.initialiser();
    expect(port.estActif('flagDeTest')).toBe(true);
  });

  it('given un flag déclaré « activé », when Remote Config renvoie « désactivé », then l\'app lit ce flag comme désactivé (critère 1)', async () => {
    const { lancer } = creerAppareil({ ouvert: false });
    const port = lancer({ ouvert: true });
    await port.initialiser();
    expect(port.estActif('ouvert')).toBe(false);
  });

  it('given les émulateurs, when on initialise, then rien n\'est chargé et les valeurs par défaut sont lues (critère 2)', async () => {
    const charger = vi.fn();
    const port = creerPortFeatureFlags({ emulateurs: true }, charger);
    await port.initialiser();
    expect(charger).not.toHaveBeenCalled();
    expect(port.estActif('flagDeTest')).toBe(FLAGS.flagDeTest);
  });

  it('given un premier lancement hors ligne, when on initialise, then la valeur par défaut est utilisée et rien n\'échoue (critère 2)', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { lancer, etat } = creerAppareil({ flagDeTest: true, ouvert: false });
    etat.enLigne = false;
    const port = lancer({ ...FLAGS, ouvert: true });
    await expect(port.initialiser()).resolves.toBeUndefined();
    expect(port.estActif('flagDeTest')).toBe(false);
    expect(port.estActif('ouvert')).toBe(true);
    erreur.mockRestore();
    warn.mockRestore();
  });

  it('given un module Remote Config qui ne se charge pas, when on initialise, then la valeur par défaut est utilisée et rien n\'échoue (critère 2)', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const port = creerPortFeatureFlags({ emulateurs: false }, () => Promise.reject(new Error('chunk introuvable')));
    await expect(port.initialiser()).resolves.toBeUndefined();
    expect(port.estActif('flagDeTest')).toBe(false);
    erreur.mockRestore();
    warn.mockRestore();
  });

  it('given un serveur Remote Config qui ne répond pas, when on initialise, then l\'initialisation rend la main en 10 s avec la valeur par défaut (critère 2)', async () => {
    vi.useFakeTimers();
    const { lancer, etat } = creerAppareil({ flagDeTest: true });
    etat.reponse = 'muette';
    const port = lancer();
    let fini = false;
    const attente = port.initialiser().then(() => (fini = true));
    await vi.advanceTimersByTimeAsync(10_000);
    await attente;
    expect(fini).toBe(true);
    expect(port.estActif('flagDeTest')).toBe(false);
  });

  it('given l\'app qui démarre, when Remote Config ne répond pas, then le démarrage de l\'app n\'est pas bloqué et l\'initialisation est lancée (critère 2)', async () => {
    const initialiser = vi.fn(() => new Promise<void>(() => undefined));
    const port: PortFeatureFlags = { initialiser, estActif: () => false };
    TestBed.configureTestingModule({ providers: [...(appConfig.providers as never[]), { provide: FEATURE_FLAGS, useValue: port }] });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    expect(initialiser).toHaveBeenCalledTimes(1);
  });

  it('given des valeurs reçues lors d\'un lancement en ligne, when l\'app est relancée hors ligne, then elle utilise les dernières valeurs reçues (critère 3)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { lancer, etat } = creerAppareil({ flagDeTest: true });
    const premier = lancer();
    await premier.initialiser();
    expect(premier.estActif('flagDeTest')).toBe(true);

    etat.enLigne = false;
    const relance = lancer();
    await relance.initialiser();
    expect(relance.estActif('flagDeTest')).toBe(true);
    warn.mockRestore();
    erreur.mockRestore();
  });

  it('given des valeurs reçues puis changées côté serveur, when l\'app est relancée hors ligne, then elle garde celles reçues en dernier et non les valeurs par défaut (critère 3)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { lancer, etat } = creerAppareil({ flagDeTest: true });
    await lancer().initialiser();
    etat.serveur = { flagDeTest: false };
    await lancer().initialiser(); // reçu en ligne : désactivé
    etat.enLigne = false;
    const relance = lancer({ flagDeTest: true }); // le défaut dit « activé » : seule la valeur reçue (désactivé) peut donner false
    await relance.initialiser();
    expect(relance.estActif('flagDeTest')).toBe(false);
    warn.mockRestore();
    erreur.mockRestore();
  });

  it('given un flag absent de la configuration distante, when l\'app le lit, then elle obtient sa valeur par défaut (critère 4)', async () => {
    const { lancer } = creerAppareil({ autre: true }); // le flag de test et « ouvert » n'existent pas côté serveur
    const port = lancer({ ...FLAGS, ouvert: true });
    await port.initialiser();
    expect(port.estActif('flagDeTest')).toBe(false);
    expect(port.estActif('ouvert')).toBe(true);
  });

  it('given un nom de flag jamais déclaré, when l\'app le lit, then il est désactivé (critère 4)', async () => {
    const { lancer } = creerAppareil({ inconnu: true });
    const port = lancer();
    await port.initialiser();
    expect(port.estActif('inconnu')).toBe(false);
  });
});

describe('US 288 : flags forcés sur émulateurs (e2e)', () => {
  const inutile = async (): Promise<never> => {
    throw new Error('inerte');
  };
  const flags = { photosLeurres: false, autre: false };
  afterEach(() => localStorage.removeItem(CLE_FLAGS_EMULATEURS));

  it('given une clé valide sur émulateurs, when on lit un flag déclaré, then la valeur forcée est rendue', () => {
    localStorage.setItem(CLE_FLAGS_EMULATEURS, JSON.stringify({ photosLeurres: true }));
    const port = creerPortFeatureFlags({ emulateurs: true }, inutile, flags);
    expect(port.estActif('photosLeurres')).toBe(true);
    expect(port.estActif('autre')).toBe(false);
  });

  it('given un flag non déclaré forcé, when on le lit, then il reste désactivé', () => {
    localStorage.setItem(CLE_FLAGS_EMULATEURS, JSON.stringify({ inconnu: true }));
    expect(creerPortFeatureFlags({ emulateurs: true }, inutile, flags).estActif('inconnu')).toBe(false);
  });

  it('given une clé absente ou illisible, when on lit un flag, then la valeur par défaut est rendue', () => {
    const port = creerPortFeatureFlags({ emulateurs: true }, inutile, flags);
    expect(port.estActif('photosLeurres')).toBe(false);
    for (const brut of ['pas du json', 'null', '[true]', '{"photosLeurres":"oui"}']) {
      localStorage.setItem(CLE_FLAGS_EMULATEURS, brut);
      expect(port.estActif('photosLeurres')).toBe(false);
    }
  });

  it('given la clé hors émulateurs, when on lit un flag, then elle est ignorée', () => {
    localStorage.setItem(CLE_FLAGS_EMULATEURS, JSON.stringify({ photosLeurres: true }));
    expect(creerPortFeatureFlags({ emulateurs: false }, inutile, flags).estActif('photosLeurres')).toBe(false);
  });
});
