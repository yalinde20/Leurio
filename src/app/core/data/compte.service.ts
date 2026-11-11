import { DestroyRef, inject, Injectable, InjectionToken, Injector } from '@angular/core';
import { creerSourceCompteFirebase } from '../firebase/source-compte';
import type { UserDoc } from '../firebase/user-doc';
import type { ChoixOnboarding } from './onboarding.store';

/** Ce que le service lit et écrit dans Firebase (remplacé par un double dans les tests). */
export interface SourceCompte {
  /** L'identifiant de l'utilisateur connecté, `null` sans compte. */
  uidCourant(): Promise<string | null>;
  /** Crée un compte anonyme et rend son identifiant. */
  connecterAnonymement(): Promise<string>;
  /** Vrai si `users/{uid}` existe ; rejette si on ne peut pas le savoir (hors ligne). */
  profilExiste(uid: string): Promise<boolean>;
  ecrireProfil(uid: string, doc: UserDoc): Promise<void>;
}

export const SOURCE_COMPTE = new InjectionToken<SourceCompte>('SOURCE_COMPTE', {
  providedIn: 'root',
  factory: () => creerSourceCompteFirebase(inject(Injector)),
});

/**
 * Compte anonyme créé en silence (PLAN §3, §4, §7) : aucun écran, aucun message. Un échec reste dans la console
 * et la création est retentée au retour du réseau, puis au lancement suivant.
 */
const DELAI_TENTATIVE_MS = 20_000;
/** Clé du localStorage : l'uid dont le profil `users/{uid}` est déjà écrit (évite toute lecture serveur au lancement). */
export const CLE_PROFIL_ECRIT = 'leurio.compte';

/**
 * Compte anonyme créé en silence (PLAN §3, §4, §7) : aucun écran, aucun message. Un échec reste dans la console
 * et la création est retentée au retour du réseau, quand l'app redevient visible, puis au lancement suivant.
 */
@Injectable({ providedIn: 'root' })
export class CompteService {
  private readonly source = inject(SOURCE_COMPTE);
  private choix: ChoixOnboarding | null = null;
  private uidConnecte: string | null = null;
  private enCours: Promise<void> | null = null;
  private ecoute = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', this.reprendre);
      document.removeEventListener('visibilitychange', this.surVisibilite);
    });
  }

  /** Ne rejette jamais. */
  async assurerCompte(choix: ChoixOnboarding): Promise<void> {
    this.choix = choix;
    // Une seule tentative à la fois : les appels concurrents attendent la tentative en cours.
    this.enCours ??= this.tenterAvecDelai().finally(() => (this.enCours = null));
    await this.enCours;
  }

  private async tenterAvecDelai(): Promise<void> {
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const delai = new Promise<never>((_, rejeter) => {
      minuteur = setTimeout(() => rejeter(new Error('délai dépassé')), DELAI_TENTATIVE_MS);
    });
    try {
      await Promise.race([this.tenter(), delai]);
      if (this.choix === null) this.arreterEcoute();
    } catch (erreur) {
      console.warn("Le compte anonyme n'a pas pu être créé : nouvel essai au retour du réseau.", erreur);
      this.ecouter();
    } finally {
      clearTimeout(minuteur);
    }
  }

  private async tenter(): Promise<void> {
    const choix = this.choix;
    if (choix === null) return;
    // Un compte existant garde son uid : on ne se reconnecte jamais.
    const uid = this.uidConnecte ?? (await this.source.uidCourant()) ?? (await this.source.connecterAnonymement());
    this.uidConnecte = uid;
    if (lireMarqueur() === uid) {
      this.choix = null;
      return;
    }
    if (!(await this.source.profilExiste(uid))) {
      await this.source.ecrireProfil(uid, {
        niveau: choix.niveau,
        especesFavorites: choix.especesFavorites,
        consentements: { analytics: false, video: false },
        createdAt: Date.now(),
        plan: 'free',
      });
    }
    ecrireMarqueur(uid);
    this.choix = null;
  }

  private readonly reprendre = (): void => {
    if (this.choix !== null) void this.assurerCompte(this.choix);
  };

  private readonly surVisibilite = (): void => {
    if (document.visibilityState === 'visible') this.reprendre();
  };

  private ecouter(): void {
    if (this.ecoute) return;
    this.ecoute = true;
    window.addEventListener('online', this.reprendre);
    document.addEventListener('visibilitychange', this.surVisibilite);
  }

  private arreterEcoute(): void {
    this.ecoute = false;
    window.removeEventListener('online', this.reprendre);
    document.removeEventListener('visibilitychange', this.surVisibilite);
  }
}

function lireMarqueur(): string | null {
  try {
    return localStorage.getItem(CLE_PROFIL_ECRIT);
  } catch {
    return null;
  }
}

function ecrireMarqueur(uid: string): void {
  try {
    localStorage.setItem(CLE_PROFIL_ECRIT, uid);
  } catch {
    // Stockage indisponible : on relira simplement le profil au prochain lancement.
  }
}
