import { effect, inject, Injectable, Injector } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ANALYTICS, ParametresEvenement } from '../firebase/mesure-audience';
import { ConsentementsService } from './consentements.service';

/** Les clés qui disent une position : jamais envoyées, même par erreur (US 19, critère 4). Le département, lui, peut l'être. */
const CLE_DE_POSITION = /lat|lng|lon|latitude|longitude|coord|position/i;

/** Retire des paramètres toute clé de position et toute valeur qui n'est pas un texte, un nombre ou un booléen. */
export function assainirParametres(parametres: Record<string, unknown>): ParametresEvenement {
  const propres: ParametresEvenement = {};
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (CLE_DE_POSITION.test(cle)) continue;
    if (typeof valeur === 'string' || typeof valeur === 'number' || typeof valeur === 'boolean') propres[cle] = valeur;
  }
  return propres;
}

/**
 * Mesure d'audience (US 19, PLAN §4, §7) : Analytics n'est initialisé qu'une fois le consentement lu et accepté dans « Compte »,
 * et coupé dès qu'il est retiré. Sans consentement lu et accepté, un événement est abandonné (jamais mis en attente).
 */
@Injectable({ providedIn: 'root' })
export class MesureAudienceService {
  private readonly consentements = inject(ConsentementsService);
  private readonly port = inject(ANALYTICS);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  private demarre = false;
  private actif = false;

  /** Lit les consentements, puis suit leur valeur et les changements d'écran. Ne lève jamais d'erreur : l'app démarre toujours. */
  demarrer(): void {
    if (this.demarre) return;
    this.demarre = true;
    effect(
      () => {
        const accepte = this.consentements.charge() && this.consentements.analytics();
        if (accepte && !this.actif) {
          this.actif = true;
          void this.port.initialiser();
        } else if (!accepte && this.actif) {
          this.actif = false;
          void this.port.desactiver();
        }
      },
      { injector: this.injector },
    );
    this.router.events.subscribe((evenement) => {
      if (evenement instanceof NavigationEnd) this.envoyer('screen_view', { page: evenement.urlAfterRedirects });
    });
    this.consentements.charger().catch((erreur) => console.error('Les consentements n’ont pas pu être lus : Analytics reste coupé.', erreur));
  }

  /** Envoie l'événement si Analytics est accepté, sans latitude ni longitude ; sinon l'abandonne. */
  envoyer(nom: string, parametres: Record<string, unknown> = {}): void {
    if (!this.consentements.charge() || !this.consentements.analytics()) return;
    void this.port.envoyer(nom, assainirParametres(parametres));
  }
}
