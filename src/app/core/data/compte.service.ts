import { inject, Injectable, InjectionToken, Injector } from '@angular/core';
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
@Injectable({ providedIn: 'root' })
export class CompteService {
  private readonly source = inject(SOURCE_COMPTE);
  private choix: ChoixOnboarding | null = null;
  private enCours: Promise<void> | null = null;
  private ecoute = false;

  /** Ne rejette jamais. */
  async assurerCompte(choix: ChoixOnboarding): Promise<void> {
    this.choix = choix;
    // Une seule tentative à la fois : les appels concurrents attendent la tentative en cours.
    this.enCours ??= this.tenter().finally(() => (this.enCours = null));
    await this.enCours;
  }

  private async tenter(): Promise<void> {
    try {
      const choix = this.choix;
      if (choix === null) return;
      // Un compte existant garde son uid : on ne se reconnecte jamais.
      const uid = (await this.source.uidCourant()) ?? (await this.source.connecterAnonymement());
      if (!(await this.source.profilExiste(uid))) {
        await this.source.ecrireProfil(uid, {
          niveau: choix.niveau,
          especesFavorites: choix.especesFavorites,
          consentements: { analytics: false, video: false },
          createdAt: Date.now(),
          plan: 'free',
        });
      }
      this.choix = null;
    } catch (erreur) {
      console.warn("Le compte anonyme n'a pas pu être créé : nouvel essai au retour du réseau.", erreur);
      this.reessayerEnLigne();
    }
  }

  private reessayerEnLigne(): void {
    if (this.ecoute) return;
    this.ecoute = true;
    window.addEventListener(
      'online',
      () => {
        this.ecoute = false;
        if (this.choix !== null) void this.assurerCompte(this.choix);
      },
      { once: true },
    );
  }
}
