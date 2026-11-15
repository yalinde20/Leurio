import { inject, Injectable, signal } from '@angular/core';
import { SOURCE_COMPTE } from './compte.service';
import { SOURCE_PROFIL } from './profil.service';

export type Consentement = 'analytics' | 'video';

/**
 * Les consentements de `users/{uid}.consentements` (US 94, PLAN §4, §7, §9 bis), lisibles par le reste de l'app : Analytics (US 19) ne se charge
 * que si `analytics()` est vrai, un lecteur vidéo tiers (US 10) que si `video()` est vrai. Tout est refusé tant que l'utilisateur n'a pas accepté.
 *
 * `analytics()` et `video()` valent faux aussi tant que la lecture n'est pas finie : un consommateur doit donc appeler et attendre `charger()`
 * (ou lire `charge()`) avant de décider de charger Analytics ou un lecteur tiers, pour ne pas confondre « refusé » et « pas encore lu ».
 */
@Injectable({ providedIn: 'root' })
export class ConsentementsService {
  private readonly compte = inject(SOURCE_COMPTE);
  private readonly profil = inject(SOURCE_PROFIL);

  private readonly _analytics = signal(false);
  private readonly _video = signal(false);
  private readonly _charge = signal(false);
  readonly analytics = this._analytics.asReadonly();
  readonly video = this._video.asReadonly();
  /** Vrai quand la lecture de `users/{uid}` est terminée (même sans compte ou sans document) : les valeurs sont alors fiables. */
  readonly charge = this._charge.asReadonly();

  /** La lecture en cours ou faite, gardée par compte : un second appel la réutilise. */
  private lecture: { uid: string | null; promesse: Promise<void> } | null = null;
  /** Les choix faits pendant cette session : une lecture qui finit après eux ne les écrase pas. */
  private readonly modifies = new Set<Consentement>();

  /** Lit `users/{uid}` (une seule fois par compte) ; sans compte ou sans document, tout reste refusé. */
  async charger(): Promise<void> {
    const uid = await this.compte.uidCourant();
    if (this.lecture?.uid !== uid) {
      this._charge.set(false);
      // Un autre compte : les choix locaux faits pour le précédent ne valent plus.
      if (this.lecture !== null) this.modifies.clear();
      const promesse = this.lire(uid);
      const lecture = { uid, promesse };
      this.lecture = lecture;
      // Une lecture en échec (hors ligne, sans cache) pourra être retentée.
      promesse.catch(() => {
        if (this.lecture === lecture) this.lecture = null;
      });
    }
    return this.lecture!.promesse;
  }

  private async lire(uid: string | null): Promise<void> {
    const stocke = uid === null ? null : await this.profil.lireConsentements(uid);
    if (stocke !== null) {
      if (!this.modifies.has('analytics')) this._analytics.set(stocke.analytics);
      if (!this.modifies.has('video')) this._video.set(stocke.video);
    }
    this._charge.set(true);
  }

  /**
   * Applique tout de suite le choix, attend la lecture (pour écrire l'autre valeur telle qu'elle est stockée), puis écrit les deux valeurs dans
   * `users/{uid}` (sans compte : rien n'est écrit). La promesse se résout à l'accusé du serveur ; hors ligne elle reste en attente jusqu'au retour du réseau.
   */
  async modifier(consentement: Consentement, accepte: boolean): Promise<void> {
    this.modifies.add(consentement);
    (consentement === 'analytics' ? this._analytics : this._video).set(accepte);
    await this.charger();
    const uid = await this.compte.uidCourant();
    if (uid === null) return;
    await this.profil.mettreAJour(uid, { consentements: { analytics: this._analytics(), video: this._video() } });
  }
}
