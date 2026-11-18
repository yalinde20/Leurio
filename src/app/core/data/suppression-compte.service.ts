import { inject, Injectable, InjectionToken, Injector } from '@angular/core';
import { creerSourceSuppressionFirebase } from '../firebase/source-suppression';
import { CompteService, CLE_PROFIL_ECRIT } from './compte.service';
import type { FournisseurLiaison } from './liaison-compte';
import { OnboardingStore } from './onboarding.store';
import { SaisieTempEauStore } from './saisie-temp-eau.store';

/** Suppression du compte et de toutes les données de l'utilisateur dans Firebase (PLAN §2.5, §4, §7). Les documents `feedback`, anonymes, restent. */
export interface SourceSuppression {
  /**
   * Le fournisseur avec lequel se reconnecter avant de supprimer (compte lié dont la connexion date de plus de 5 minutes) ;
   * `null` sinon (compte anonyme ou connexion récente).
   */
  reconnexionRequise(): Promise<FournisseurLiaison | null>;
  /** Reconnexion par fenêtre ; rejette avec un objet portant `code`. */
  reconnecter(fournisseur: 'google' | 'apple'): Promise<void>;
  /** Reconnexion par mot de passe ; rejette avec un objet portant `code`. */
  reconnecterEmail(motDePasse: string): Promise<void>;
  /** Supprime les photos de `users/{uid}/lures` dans Storage, les documents de `users/{uid}/tackleBox` et `users/{uid}/spots`, puis `users/{uid}`. */
  supprimerDonnees(): Promise<void>;
  /** Supprime le compte d'authentification ; rejette avec `{ code: 'auth/requires-recent-login' }` si la connexion n'est plus récente. */
  supprimerCompte(): Promise<void>;
}

export const SOURCE_SUPPRESSION = new InjectionToken<SourceSuppression>('SOURCE_SUPPRESSION', {
  providedIn: 'root',
  factory: () => creerSourceSuppressionFirebase(inject(Injector)),
});

/**
 * Remet le téléphone dans l'état du premier lancement après la suppression du compte (US 98) : l'onboarding est refait
 * et un nouveau compte anonyme est créé. Effacés : l'onboarding terminé (niveau, espèces favorites), le marqueur du profil écrit
 * (`leurio.compte`) et la température d'eau saisie. Gardés : le thème et les unités, réglages de l'appareil sans donnée personnelle.
 */
@Injectable({ providedIn: 'root' })
export class SuppressionCompteService {
  private readonly onboarding = inject(OnboardingStore);
  private readonly compte = inject(CompteService);
  private readonly saisieTempEau = inject(SaisieTempEauStore);

  /**
   * Dès que les données Firebase sont effacées : oublie le marqueur du profil écrit et l'uid en cache, pour qu'un échec de la suppression
   * du compte d'authentification ne laisse pas un marqueur pointer vers un profil supprimé. Ne lève jamais d'erreur.
   */
  oublierProfil(): void {
    this.compte.reinitialiser();
    try {
      localStorage.removeItem(CLE_PROFIL_ECRIT);
    } catch {
      // Stockage inaccessible : rien d'autre à faire.
    }
  }

  /** Ne lève jamais d'erreur : un stockage inaccessible est ignoré. */
  effacerEtatLocal(): void {
    this.onboarding.effacer();
    this.saisieTempEau.effacer();
    this.oublierProfil();
  }
}
