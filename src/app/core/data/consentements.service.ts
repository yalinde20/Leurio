import { inject, Injectable, signal } from '@angular/core';
import { SOURCE_COMPTE } from './compte.service';
import { SOURCE_PROFIL } from './profil.service';

export type Consentement = 'analytics' | 'video';

/**
 * Les consentements de `users/{uid}.consentements` (US 94, PLAN §4, §7, §9 bis), lisibles par le reste de l'app : Analytics (US 19) ne se charge
 * que si `analytics()` est vrai, un lecteur vidéo tiers (US 10) que si `video()` est vrai. Tout est refusé tant que l'utilisateur n'a pas accepté.
 */
@Injectable({ providedIn: 'root' })
export class ConsentementsService {
  private readonly compte = inject(SOURCE_COMPTE);
  private readonly profil = inject(SOURCE_PROFIL);

  private readonly _analytics = signal(false);
  private readonly _video = signal(false);
  readonly analytics = this._analytics.asReadonly();
  readonly video = this._video.asReadonly();

  /** Lit `users/{uid}` ; sans compte ou sans document, tout reste refusé. */
  async charger(): Promise<void> {
    const uid = await this.compte.uidCourant();
    if (uid === null) return;
    const stocke = await this.profil.lireConsentements(uid);
    if (stocke === null) return;
    this._analytics.set(stocke.analytics);
    this._video.set(stocke.video);
  }

  /**
   * Applique tout de suite le choix, puis écrit les deux valeurs dans `users/{uid}` (sans compte : rien n'est écrit). La promesse se résout
   * à l'accusé du serveur ; hors ligne elle reste en attente jusqu'au retour du réseau.
   */
  async modifier(consentement: Consentement, accepte: boolean): Promise<void> {
    (consentement === 'analytics' ? this._analytics : this._video).set(accepte);
    const uid = await this.compte.uidCourant();
    if (uid === null) return;
    await this.profil.mettreAJour(uid, { consentements: { analytics: this._analytics(), video: this._video() } });
  }
}
