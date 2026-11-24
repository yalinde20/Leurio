import { CustomProvider, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

/** Jeton d'App Check tel que le rend le plugin natif. */
interface JetonNatif {
  token: string;
  expireTimeMillis?: number;
}

/** Partie du plugin `@capacitor-firebase/app-check` utilisée par l'app. */
export interface PluginAppCheckNatif {
  initialize(options?: { isTokenAutoRefreshEnabled?: boolean }): Promise<void>;
  getToken(options?: { forceRefresh?: boolean }): Promise<JetonNatif>;
}

/** Où tourne l'app : ce qui décide du fournisseur d'App Check. */
export interface ContexteAppCheck {
  /** Vrai sur Android et iOS (Capacitor). */
  natif: boolean;
  /** Vrai sur les émulateurs, en développement et dans les tests. */
  emulateurs: boolean;
  /** Clé de site reCAPTCHA Enterprise, utilisée sur le web en production. */
  cleSite: string;
}

const UNE_HEURE_MS = 60 * 60 * 1000;

/**
 * Choisit le fournisseur d'App Check (US 20) :
 * - émulateurs, développement, tests : fournisseur local factice, sans plugin ni reCAPTCHA ;
 * - Android et iOS en production : attestation native (Play Integrity, App Attest) via le plugin Capacitor ;
 * - web en production : reCAPTCHA Enterprise.
 * Le plugin n'est chargé qu'au premier jeton demandé sur natif.
 */
export function choisirFournisseurAppCheck(
  contexte: ContexteAppCheck,
  chargerPlugin: () => Promise<PluginAppCheckNatif>,
): CustomProvider | ReCaptchaEnterpriseProvider {
  if (contexte.emulateurs) {
    // Mode débogage de l'environnement de test (décision du propriétaire, US 36) : un fournisseur
    // local rend un jeton factice, sans FIREBASE_APPCHECK_DEBUG_TOKEN, car le vrai jeton de débogage
    // s'échange avec googleapis.com.
    return new CustomProvider({
      getToken: async () => ({ token: 'jeton-app-check-local', expireTimeMillis: Date.now() + UNE_HEURE_MS }),
    });
  }
  if (contexte.natif) {
    return fournisseurNatif(chargerPlugin);
  }
  return new ReCaptchaEnterpriseProvider(contexte.cleSite);
}

/** Fournisseur qui relaie le jeton du plugin natif ; le plugin est initialisé une seule fois. */
function fournisseurNatif(chargerPlugin: () => Promise<PluginAppCheckNatif>): CustomProvider {
  let pret: Promise<PluginAppCheckNatif> | undefined;
  const preparer = (): Promise<PluginAppCheckNatif> => {
    // La promesse est gardée : des demandes simultanées n'initialisent pas le plugin deux fois.
    pret ??= chargerPlugin()
      .then(async (plugin) => {
        await plugin.initialize({ isTokenAutoRefreshEnabled: true });
        return plugin;
      })
      .catch((erreur: unknown) => {
        // Un échec n'est pas définitif : la demande suivante réessaie.
        pret = undefined;
        throw erreur;
      });
    return pret;
  };
  return new CustomProvider({
    getToken: async () => {
      const plugin = await preparer();
      const { token, expireTimeMillis } = await plugin.getToken();
      return { token, expireTimeMillis: expireTimeMillis ?? Date.now() + UNE_HEURE_MS };
    },
  });
}
