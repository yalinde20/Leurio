// Rapports de plantage Crashlytics (US 18, PLAN §4). Seule l'app native Android et iOS de production les envoie ;
// le web, le développement et les tests ont un port inerte. Le plugin natif n'est chargé qu'à la demande.
import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { config, emulateurs } from './config';
import { version } from '../../../../package.json';

export interface PortPlantages {
  activerCollecte(actif: boolean): Promise<void>;
  enregistrer(erreur: { message: string; pile?: string }): Promise<void>;
  definirVersion(version: string): Promise<void>;
  /** Identifiant du build (commit court et date), posé comme la version avant chaque rapport. */
  definirBuild?(build: string): Promise<void>;
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
  // La collecte est désactivée par défaut dans la config native (Info.plist, AndroidManifest) : on ne l'active jamais ici.
  activerCollecte: () => Promise.resolve(),
  enregistrer: () => Promise.resolve(),
  definirVersion: () => Promise.resolve(),
  envoyerRapportsEnAttente: () => Promise.resolve(),
};

/**
 * Actif seulement dans l'app native de production. La collecte native est désactivée par défaut et activée ici seulement
 * (setEnabled(true) puis sendUnsentReports au lancement). Aucune vérification du réseau : sans réseau, le SDK natif garde
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
    definirBuild: (build) => plugin.setCustomKey({ key: 'build', value: build, type: 'string' }),
    envoyerRapportsEnAttente: () => plugin.sendUnsentReports(),
  };
}

/** Au lancement : active la collecte, pose la version, envoie les rapports en attente. Ne fait jamais échouer le démarrage. */
export async function initialiserPlantages(port: PortPlantages, version: string, build: string = config.build): Promise<void> {
  try {
    await port.activerCollecte(true);
    await port.definirVersion(version);
    await port.definirBuild?.(build);
    await port.envoyerRapportsEnAttente();
  } catch (erreur) {
    console.error('Crashlytics n’a pas pu démarrer : l’app continue sans.', erreur);
  }
}

export const VERSION_APP = new InjectionToken<string>('VERSION_APP', {
  providedIn: 'root',
  factory: () => version,
});

export const BUILD_APP = new InjectionToken<string>('BUILD_APP', {
  providedIn: 'root',
  factory: () => config.build,
});

/**
 * Le plugin attend des images de pile : on lit les lignes de la pile texte, au format V8 (« at fonction (fichier:ligne:colonne) »)
 * ou Safari / WKWebView (« fonction@fichier:ligne:colonne », ou « fichier:ligne:colonne » si anonyme).
 */
export function imagesDePile(pile?: string): { functionName?: string; fileName?: string; lineNumber?: number }[] | undefined {
  if (!pile) return undefined;
  const images = pile
    .split('\n')
    .map((ligne) => /^\s*at\s+(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?\s*$/.exec(ligne) ?? /^\s*(?:(.*?)@)?(.*):(\d+):(\d+)\s*$/.exec(ligne))
    .filter((m): m is RegExpExecArray => m !== null)
    // Un bundle minifié tient sur la ligne 1 et StackFrame n'a pas de colonne : on garde alors la colonne dans le nom du fichier.
    .map((m) => ({ functionName: m[1] || undefined, fileName: m[3] === '1' ? `${m[2]}:1:${m[4]}` : m[2], lineNumber: Number(m[3]) }));
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
