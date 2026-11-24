// Rapports de plantage Crashlytics (US 18, PLAN §4). Seule l'app native Android et iOS de production les envoie ;
// le web, le développement et les tests ont un port inerte. Le plugin natif n'est chargé qu'à la demande.
import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { emulateurs } from './config';
import packageJson from '../../../../package.json';

export interface PortPlantages {
  activerCollecte(actif: boolean): Promise<void>;
  enregistrer(erreur: { message: string; pile?: string }): Promise<void>;
  definirVersion(version: string): Promise<void>;
  envoyerRapportsEnAttente(): Promise<void>;
}

/** Sous-ensemble de `FirebaseCrashlytics` utilisé ici. */
export interface PluginCrashlytics {
  setEnabled(options: { enabled: boolean }): Promise<void>;
  recordException(options: { message: string; stacktrace?: string }): Promise<void>;
  setCustomKey(options: { key: string; value: string; type: 'string' }): Promise<void>;
  sendUnsentReports(): Promise<void>;
}

const portInerte: PortPlantages = {
  // Une collecte désactivée reste désactivée : on ne l'active jamais ici.
  activerCollecte: () => Promise.resolve(),
  enregistrer: () => Promise.resolve(),
  definirVersion: () => Promise.resolve(),
  envoyerRapportsEnAttente: () => Promise.resolve(),
};

/**
 * Actif seulement dans l'app native de production. Aucune vérification du réseau : sans réseau, le SDK natif garde
 * le rapport et l'envoie au lancement suivant.
 */
export function creerPortPlantages(plugin: PluginCrashlytics, contexte: { natif: boolean; emulateurs: boolean }): PortPlantages {
  if (!contexte.natif || contexte.emulateurs) {
    return {
      ...portInerte,
      // Seule la désactivation est transmise au plugin.
      activerCollecte: () => (contexte.natif ? plugin.setEnabled({ enabled: false }) : Promise.resolve()),
    };
  }
  return {
    activerCollecte: (actif) => plugin.setEnabled({ enabled: actif }),
    enregistrer: (erreur) => plugin.recordException({ message: erreur.message, stacktrace: erreur.pile }),
    definirVersion: (version) => plugin.setCustomKey({ key: 'version', value: version, type: 'string' }),
    envoyerRapportsEnAttente: () => plugin.sendUnsentReports(),
  };
}

/** Au lancement : active la collecte, pose la version, envoie les rapports en attente. Ne fait jamais échouer le démarrage. */
export async function initialiserPlantages(port: PortPlantages, version: string): Promise<void> {
  try {
    await port.activerCollecte(true);
    await port.definirVersion(version);
    await port.envoyerRapportsEnAttente();
  } catch (erreur) {
    console.error('Crashlytics n’a pas pu démarrer : l’app continue sans.', erreur);
  }
}

export const VERSION_APP = new InjectionToken<string>('VERSION_APP', {
  providedIn: 'root',
  factory: () => packageJson.version,
});

/** Le plugin attend des images de pile : on lit les lignes « at fonction (fichier:ligne:colonne) » de la pile texte. */
export function imagesDePile(pile?: string): { functionName?: string; fileName?: string; lineNumber?: number }[] | undefined {
  if (!pile) return undefined;
  const images = pile
    .split('\n')
    .map((ligne) => /^\s*at\s+(?:(.*?)\s+\()?(.*?):(\d+):\d+\)?\s*$/.exec(ligne))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ functionName: m[1] || undefined, fileName: m[2], lineNumber: Number(m[3]) }));
  return images.length > 0 ? images : undefined;
}

/** Plugin chargé à la demande : jamais dans le bundle initial du web. */
const pluginALaDemande: PluginCrashlytics = {
  setEnabled: async (o) => (await import('@capacitor-firebase/crashlytics')).FirebaseCrashlytics.setEnabled(o),
  recordException: async (o) =>
    (await import('@capacitor-firebase/crashlytics')).FirebaseCrashlytics.recordException({
      message: o.message,
      stacktrace: imagesDePile(o.stacktrace),
    }),
  setCustomKey: async (o) => (await import('@capacitor-firebase/crashlytics')).FirebaseCrashlytics.setCustomKey(o),
  sendUnsentReports: async () => (await import('@capacitor-firebase/crashlytics')).FirebaseCrashlytics.sendUnsentReports(),
};

export const PLANTAGES = new InjectionToken<PortPlantages>('PLANTAGES', {
  providedIn: 'root',
  factory: () => creerPortPlantages(pluginALaDemande, { natif: Capacitor.isNativePlatform(), emulateurs }),
});
