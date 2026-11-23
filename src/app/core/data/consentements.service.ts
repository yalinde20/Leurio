import { computed, inject, Injectable, signal } from '@angular/core';
import { SOURCE_COMPTE } from './compte.service';
import { SOURCE_PROFIL } from './profil.service';

export type Consentement = 'analytics' | 'video';

/**
 * Les consentements de `users/{uid}.consentements` (US 94, PLAN §4, §7, §9 bis), lisibles par le reste de l'app : Analytics (US 19) ne se charge
 * que si `analytics()` est vrai, un lecteur vidéo tiers (US 10) que si `video()` est vrai. Tout est refusé tant que l'utilisateur n'a pas accepté.
 *
 * `analytics()` et `video()` valent faux (et `reponseVideo()` null) aussi tant que la lecture n'est pas finie : un consommateur doit donc appeler et attendre `charger()`
 * (ou lire `charge()`) avant de décider de charger Analytics ou un lecteur tiers, pour ne pas confondre « refusé » et « pas encore lu ».
 */
@Injectable({ providedIn: 'root' })
export class ConsentementsService {
  private readonly compte = inject(SOURCE_COMPTE);
  private readonly profil = inject(SOURCE_PROFIL);

  private readonly _analytics = signal(false);
  private readonly _reponseVideo = signal<boolean | null>(null);
  private readonly _charge = signal(false);
  readonly analytics = this._analytics.asReadonly();
  /** Vrai seulement si la vidéo tierce est acceptée : seul cas où un lecteur tiers peut se charger. */
  readonly video = computed(() => this._reponseVideo() === true);
  /** Tri-état (US 10) : `null` = jamais répondu (on demande), `false` = refusé (on ne redemande pas), `true` = accepté. */
  readonly reponseVideo = this._reponseVideo.asReadonly();
  /** Vrai quand la lecture de `users/{uid}` est terminée (même sans compte ou sans document) : les valeurs sont alors fiables. */
  readonly charge = this._charge.asReadonly();

  /** La lecture en cours ou faite, gardée par compte : un second appel la réutilise. */
  private lecture: { uid: string | null; promesse: Promise<void> } | null = null;
  /** Les choix faits pendant cette session : une lecture qui finit après eux ne les écrase pas. */
  private readonly modifies = new Set<Consentement>();
  /** Numéro de la lecture courante : une lecture d'un compte précédent qui finit en retard est ignorée. */
  private generation = 0;

  /** Lit `users/{uid}` (une seule fois par compte) ; sans compte ou sans document, tout reste refusé. */
  async charger(): Promise<void> {
    const uid = await this.compte.uidCourant();
    if (this.lecture?.uid !== uid) {
      // Un autre compte : ni ses valeurs ni les choix locaux faits pour le précédent ne valent plus.
      if (this.lecture !== null) this.remettreAZero();
      this.generation++;
      const generation = this.generation;
      const promesse = this.lire(uid, generation);
      const lecture = { uid, promesse };
      this.lecture = lecture;
      // Une lecture en échec (hors ligne, sans cache) pourra être retentée.
      promesse.catch(() => {
        if (this.lecture === lecture) this.lecture = null;
      });
    }
    return this.lecture!.promesse;
  }

  /** Oublie tout ce qui venait d'un compte (suppression du compte, changement de compte) : plus rien n'est accepté ni lu. */
  oublier(): void {
    this.generation++;
    this.lecture = null;
    this.remettreAZero();
  }

  private remettreAZero(): void {
    this._charge.set(false);
    this._analytics.set(false);
    this._reponseVideo.set(null);
    this.modifies.clear();
  }

  private async lire(uid: string | null, generation: number): Promise<void> {
    const stocke = uid === null ? null : await this.profil.lireConsentements(uid);
    // Le compte a changé (ou été oublié) pendant la lecture : ces valeurs ne sont plus celles du compte courant.
    if (generation !== this.generation) return;
    // Sans document : jamais répondu, rien d'accepté (sauf choix fait pendant cette session).
    if (!this.modifies.has('analytics')) this._analytics.set(stocke?.analytics ?? false);
    if (!this.modifies.has('video')) this._reponseVideo.set(stocke?.video ?? null);
    this._charge.set(true);
  }

  /**
   * Applique tout de suite le choix, attend la lecture (pour écrire l'autre valeur telle qu'elle est stockée), puis écrit les deux valeurs dans
   * `users/{uid}` (sans compte : rien n'est écrit). La promesse se résout à l'accusé du serveur ; hors ligne elle reste en attente jusqu'au retour du réseau.
   */
  async modifier(consentement: Consentement, accepte: boolean): Promise<void> {
    this.modifies.add(consentement);
    if (consentement === 'analytics') this._analytics.set(accepte);
    else this._reponseVideo.set(accepte);
    await this.charger();
    const uid = await this.compte.uidCourant();
    if (uid === null) return;
    await this.profil.mettreAJour(uid, { consentements: { analytics: this._analytics(), video: this._reponseVideo() } });
  }
}
