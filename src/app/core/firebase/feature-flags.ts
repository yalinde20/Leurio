// Feature flags Firebase Remote Config (US 21, PLAN §4). Le propriétaire ouvre ou ferme une fonctionnalité à distance, sans nouvelle version.
// `firebase/remote-config` n'est importé que dans le chargeur de `FEATURE_FLAGS`, jamais dans le bundle initial.
// Sans réponse (hors ligne, serveur muet, module introuvable) : les dernières valeurs reçues, que le SDK garde dans IndexedDB,
// puis à défaut la valeur par défaut déclarée dans `FLAGS`. Aucun émulateur Remote Config n'existe : sur les émulateurs
// (développement, tests, e2e) le port est inerte et n'appelle jamais Google.
import { inject, InjectionToken, Injector } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import { emulateurs } from './config';

/**
 * Flags déclarés et leur valeur par défaut. Config de l'app, pas du contenu de pêche : une constante TypeScript suffit.
 * Un flag lu doit être déclaré ici ; pour en ouvrir un, créer le paramètre du même nom dans Remote Config.
 */
export const FLAGS = {
  /** Flag de test de l'US 21 : aucune fonctionnalité derrière. */
  flagDeTest: false,
  /** Photos de leurres dans Cloud Storage, absent du forfait gratuit (US 287) : fermé, la suppression du compte n'appelle pas Storage. */
  photosLeurres: false,
};

/**
 * Sur les émulateurs seulement, les e2e forcent des flags : JSON `{"photosLeurres": true}` sous cette clé de `localStorage`.
 * Aucun émulateur Remote Config n'existe ; hors émulateurs, la clé est ignorée.
 */
export const CLE_FLAGS_EMULATEURS = 'leurio.flags-emulateurs';

function flagsForces(flags: Record<string, boolean>): Record<string, boolean> {
  try {
    const brut = localStorage.getItem(CLE_FLAGS_EMULATEURS);
    const valeurs: unknown = brut ? JSON.parse(brut) : null;
    if (typeof valeurs !== 'object' || valeurs === null) return {};
    return Object.fromEntries(Object.entries(valeurs).filter(([nom, v]) => Object.hasOwn(flags, nom) && typeof v === 'boolean'));
  } catch {
    return {};
  }
}

/** Durée maximale d'attente de Remote Config au lancement ; passé ce délai, l'app garde ce qu'elle a. */
const DELAI_MAX_MS = 10_000;
/** Délai propre au SDK pour la requête, plus court que `DELAI_MAX_MS`. */
const DELAI_REQUETE_MS = 8_000;
/** Un flag ouvert ou fermé à distance est pris en compte au lancement suivant au plus tard une heure après. */
const INTERVALLE_MIN_MS = 3_600_000;

export interface PortFeatureFlags {
  /** Récupère les valeurs distantes. Ne rejette jamais et rend la main en 10 s au plus. */
  initialiser(): Promise<void>;
  /**
   * Synchrone : la dernière valeur reçue, sinon la valeur par défaut ; un flag non déclaré est désactivé.
   * Le flag est lu à la dernière valeur chargée : il peut changer une fois `initialiser()` terminé.
   */
  estActif(nom: string): boolean;
}

/** Sous-ensemble de `firebase/remote-config` utilisé ici (remplacé par un double dans les tests). */
export interface ModuleRemoteConfig {
  isSupported(): Promise<boolean>;
  getRemoteConfig(app: FirebaseApp): RemoteConfigMinimal;
  /**
   * Rejette sans réseau. Le module fourni doit avoir chargé les valeurs activées au lancement précédent avant de requêter, pour que
   * `getValue` les lise même si la requête échoue : `adapterSdkRemoteConfig` le garantit pour le vrai SDK.
   */
  fetchAndActivate(remoteConfig: never): Promise<boolean>;
  getValue(
    remoteConfig: never,
    cle: string,
  ): { asBoolean(): boolean; getSource(): 'remote' | 'default' | 'static' };
}

interface RemoteConfigMinimal {
  defaultConfig: Record<string, string | number | boolean>;
  settings: { fetchTimeoutMillis: number; minimumFetchIntervalMillis: number };
}

/** Sous-ensemble du SDK `firebase/remote-config` que l'adaptateur utilise. */
export interface SdkRemoteConfig extends ModuleRemoteConfig {
  ensureInitialized(remoteConfig: never): Promise<void>;
}

/**
 * Adapte le vrai SDK : `fetchAndActivate` seul ne charge pas les valeurs persistées (IndexedDB), seul `ensureInitialized` le fait.
 * On l'attend donc avant la requête, qui échoue sans réseau : `getValue` rend alors les dernières valeurs reçues (critère 3).
 */
export function adapterSdkRemoteConfig(sdk: SdkRemoteConfig): ModuleRemoteConfig {
  return {
    isSupported: () => sdk.isSupported(),
    getRemoteConfig: (app) => sdk.getRemoteConfig(app),
    getValue: (rc, cle) => sdk.getValue(rc, cle),
    fetchAndActivate: async (rc) => {
      await sdk.ensureInitialized(rc);
      return sdk.fetchAndActivate(rc);
    },
  };
}

export function creerPortFeatureFlags(
  contexte: { emulateurs: boolean },
  charger: () => Promise<{ module: ModuleRemoteConfig; app: FirebaseApp }>,
  flags: Record<string, boolean> = FLAGS,
): PortFeatureFlags {
  let pret: { module: ModuleRemoteConfig; remoteConfig: never } | null = null;

  const demarrer = async () => {
    const { module, app } = await charger();
    if (!(await module.isSupported())) return;
    const remoteConfig = module.getRemoteConfig(app);
    remoteConfig.defaultConfig = { ...flags };
    remoteConfig.settings.fetchTimeoutMillis = DELAI_REQUETE_MS;
    remoteConfig.settings.minimumFetchIntervalMillis = INTERVALLE_MIN_MS;
    pret = { module, remoteConfig: remoteConfig as never };
    await module.fetchAndActivate(remoteConfig as never);
  };

  return {
    async initialiser() {
      if (contexte.emulateurs) return;
      let minuteur: ReturnType<typeof setTimeout> | undefined;
      try {
        const delai = new Promise<void>(
          (resolve) =>
            (minuteur = setTimeout(() => {
              console.warn(
                'Remote Config met trop de temps : l’app continue avec les valeurs qu’elle a.',
              );
              resolve();
            }, DELAI_MAX_MS)),
        );
        await Promise.race([demarrer(), delai]);
      } catch (erreur) {
        console.warn(
          'Remote Config n’a pas répondu : l’app garde les dernières valeurs reçues ou les valeurs par défaut.',
          erreur,
        );
      } finally {
        clearTimeout(minuteur);
      }
    },
    estActif(nom) {
      if (!Object.hasOwn(flags, nom)) return false;
      const defaut = flags[nom];
      if (contexte.emulateurs) return flagsForces(flags)[nom] ?? defaut;
      if (!pret) return defaut;
      try {
        const valeur = pret.module.getValue(pret.remoteConfig, nom);
        return valeur.getSource() === 'remote' ? valeur.asBoolean() : defaut;
      } catch {
        return defaut;
      }
    },
  };
}

/** Les flags y sont lus à la dernière valeur chargée : ils peuvent changer une fois `initialiser()` terminé. */
export const FEATURE_FLAGS = new InjectionToken<PortFeatureFlags>('FEATURE_FLAGS', {
  providedIn: 'root',
  factory: () => {
    const injector = inject(Injector);
    return creerPortFeatureFlags({ emulateurs }, async () => {
      const [sdk, { FirebaseService }] = await Promise.all([
        import('firebase/remote-config'),
        import('./firebase.service'),
      ]);
      const module = adapterSdkRemoteConfig(sdk);
      return { module, app: injector.get(FirebaseService).app };
    });
  },
});
