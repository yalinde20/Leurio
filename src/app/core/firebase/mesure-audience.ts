// Mesure d'audience Firebase Analytics (US 19, PLAN §4, §7). Elle ne se charge qu'après le consentement « Analytics » du compte :
// `firebase/analytics` n'est importé que dans `initialiser()`, jamais dans le bundle initial ni avant le consentement.
// Le build web ou natif avec un identifiant de mesure (FIREBASE_MEASUREMENT_ID) envoie ses événements ; seuls les émulateurs
// (développement, tests, e2e) et les builds sans identifiant ont un port inerte : aucun appel à Google.
import { inject, InjectionToken, Injector } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import { config, emulateurs } from './config';

export type ParametresEvenement = Record<string, string | number | boolean>;

export interface PortAnalytics {
  /** Initialise Analytics et active la collecte ; sans effet si déjà fait (la collecte est alors simplement réactivée). */
  initialiser(): Promise<void>;
  envoyer(nom: string, parametres: ParametresEvenement): Promise<void>;
  /** Coupe la collecte : plus aucun événement n'est envoyé. */
  desactiver(): Promise<void>;
}

/** Sous-ensemble de `firebase/analytics` utilisé ici (remplacé par un double dans les tests). */
export interface ModuleAnalytics {
  isSupported(): Promise<boolean>;
  initializeAnalytics(app: FirebaseApp, options?: { config?: Record<string, unknown> }): unknown;
  setAnalyticsCollectionEnabled(analytics: never, enabled: boolean): void;
  logEvent(analytics: never, nom: string, parametres?: ParametresEvenement): void;
}

const portInerte: PortAnalytics = {
  initialiser: () => Promise.resolve(),
  envoyer: () => Promise.resolve(),
  desactiver: () => Promise.resolve(),
};

/**
 * Inerte sur les émulateurs ou sans identifiant de mesure. Sinon, le module et l'app Firebase sont chargés par `charger` au premier
 * `initialiser()` seulement. Une erreur (navigateur non pris en charge, réseau, bloqueur de publicités) n'est jamais relancée.
 */
export function creerPortAnalytics(
  contexte: { emulateurs: boolean; measurementId?: string },
  charger: () => Promise<{ module: ModuleAnalytics; app: FirebaseApp }>,
): PortAnalytics {
  if (contexte.emulateurs || !contexte.measurementId) return portInerte;
  let pret: Promise<{ module: ModuleAnalytics; analytics: never } | null> | null = null;

  const demarrer = async () => {
    const { module, app } = await charger();
    if (!(await module.isSupported())) return null;
    const analytics = module.initializeAnalytics(app, {
      // Pas de page vue automatique (le service envoie screen_view), ni signaux Google ni publicité personnalisée.
      config: { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false },
    }) as never;
    return { module, analytics };
  };
  const garder = (erreur: unknown) => console.error('Analytics n’a pas pu démarrer : l’app continue sans.', erreur);

  return {
    async initialiser() {
      try {
        pret ??= demarrer();
        const ctx = await pret;
        ctx?.module.setAnalyticsCollectionEnabled(ctx.analytics, true);
      } catch (erreur) {
        pret = null;
        garder(erreur);
      }
    },
    async envoyer(nom, parametres) {
      try {
        const ctx = await pret;
        ctx?.module.logEvent(ctx.analytics, nom, parametres);
      } catch (erreur) {
        garder(erreur);
      }
    },
    async desactiver() {
      try {
        const ctx = await pret;
        ctx?.module.setAnalyticsCollectionEnabled(ctx.analytics, false);
      } catch (erreur) {
        garder(erreur);
      }
    },
  };
}

export const ANALYTICS = new InjectionToken<PortAnalytics>('ANALYTICS', {
  providedIn: 'root',
  factory: () => {
    const injector = inject(Injector);
    return creerPortAnalytics({ emulateurs, measurementId: config.firebase.measurementId }, async () => {
      // Chargés au premier `initialiser()` seulement, donc après le consentement.
      const [module, { FirebaseService }] = await Promise.all([import('firebase/analytics'), import('./firebase.service')]);
      return { module: module as unknown as ModuleAnalytics, app: injector.get(FirebaseService).app };
    });
  },
});
