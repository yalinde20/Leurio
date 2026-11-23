import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Video, VideoHebergee, VideoPropre } from '../../core/data/catalog.types';
import { ConsentementsService } from '../../core/data/consentements.service';

const PLATEFORMES: Record<VideoHebergee['provider'], string> = { youtube: 'YouTube', vimeo: 'Vimeo', dailymotion: 'Dailymotion' };

/**
 * L'adresse du lecteur officiel de la plateforme (PLAN §9 bis), démarrant à `start` secondes. L'identifiant vient du contenu : il est encodé,
 * et l'hôte est toujours l'un des trois codés ici. Seule l'adresse ainsi construite est déclarée sûre pour un <iframe>.
 */
export function adresseLecteur(video: VideoHebergee): string {
  const id = encodeURIComponent(video.id);
  const debut = Number.isFinite(video.start) && (video.start as number) >= 0 ? Math.floor(video.start as number) : 0;
  switch (video.provider) {
    case 'youtube':
      return `https://www.youtube-nocookie.com/embed/${id}?start=${debut}&playsinline=1`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${id}#t=${debut}s`;
    case 'dailymotion':
      return `https://geo.dailymotion.com/player.html?video=${id}&startTime=${debut}`;
  }
}

/**
 * Lecteur vidéo unique de l'app (PLAN §9 bis). La boucle courte « self » (US 9) est lue d'elle-même, muette, sans commandes.
 * Sous elle (US 10), la rubrique « Vidéo complète » lit la première vidéo YouTube, Vimeo ou Dailymotion de la liste, dans le lecteur officiel,
 * et seulement après consentement : tant que `ConsentementsService.video()` n'est pas vrai, aucun <iframe> n'existe et aucune plateforme n'est appelée.
 * Jamais répondu : une carte pose la question ; refusé : la rubrique n'apparaît pas.
 * Tant que le fichier manque, ne se charge pas ou que la lecture est refusée (iOS, économie d'énergie), rien ne s'affiche :
 * ni zone vidéo, ni message. La <video> reste dans le DOM mais invisible (et sans hauteur) jusqu'à `canplay` : iOS ne lance
 * pas une vidéo en `display: none`.
 */
@Component({
  selector: 'app-video-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .zone {
      position: relative;
      margin-top: 0;
      height: 0;
      overflow: hidden;
      visibility: hidden;
      border-radius: 12px;
      background: var(--lr-sable);
    }
    .zone.prete {
      margin-top: 12px;
      height: auto;
      aspect-ratio: 16 / 9;
      visibility: visible;
    }
    video {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .titre-video {
      margin: 16px 0 8px;
      font-size: 18px;
      font-weight: 700;
      color: var(--lr-texte);
    }
    .consentement {
      padding: 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
    }
    .consentement p {
      margin: 0;
      font-size: 16px;
      line-height: 1.4;
    }
    .boutons {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .bouton {
      flex: 1;
      min-height: 48px;
      border: 2px solid var(--lr-primaire);
      border-radius: 12px;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-size: 17px;
      font-weight: 600;
      font-family: inherit;
    }
    .bouton.secondaire {
      background: transparent;
      color: var(--lr-primaire);
    }
    .lecteur {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      border: none;
      border-radius: 12px;
      background: var(--lr-sable);
    }
    .credit {
      margin: 8px 0 0;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    .credit a,
    .credit .auteur {
      display: inline-flex;
      align-items: center;
      min-height: 48px;
      font-weight: 600;
    }
    .credit a {
      color: var(--lr-primaire);
      text-decoration: underline;
    }
    .credit .auteur {
      color: var(--lr-texte);
    }
    .etiquette {
      position: absolute;
      left: 8px;
      bottom: 8px;
      padding: 4px 8px;
      border-radius: 8px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      font-size: 13px;
      font-weight: 600;
    }
  `,
  template: `
    @if (boucle(); as b) {
      @if (etat() !== 'ecarte') {
        <div class="zone" [class.prete]="etat() === 'prete'" aria-hidden="true">
          <video
            [src]="'assets/' + b.fichier"
            [muted]="true"
            muted
            autoplay
            loop
            playsinline
            preload="auto"
            (canplay)="surCanplay($event)"
            (error)="etat.set('ecarte')"
          ></video>
          <span class="etiquette">Boucle · sans son</span>
        </div>
      }
    }
    @if (tierce(); as t) {
      @if (rubriqueVisible()) {
        <h3 class="titre-video">Vidéo complète</h3>
        @if (consentements.video() === true) {
          <iframe
            class="lecteur"
            [src]="adresse()"
            [title]="'Vidéo ' + plateforme() + ' : ' + (titre() ?? '')"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowfullscreen
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
          @if (t.auteur) {
            <p class="credit">
              Vidéo :
              @if (t.lienAuteur) {
                <a [href]="t.lienAuteur" target="_blank" rel="noopener noreferrer">{{ t.auteur }}</a>
              } @else {
                <span class="auteur">{{ t.auteur }}</span>
              }
            </p>
          }
        } @else {
          <section class="consentement">
            <p>Cette vidéo est hébergée par {{ plateforme() }}. La charger ?</p>
            <div class="boutons">
              <button type="button" class="bouton secondaire" (click)="repondre(false)">Non merci</button>
              <button type="button" class="bouton" (click)="repondre(true)">Charger la vidéo</button>
            </div>
          </section>
        }
      }
    }
  `,
})
export class VideoPlayerComponent {
  readonly videos = input<Video[] | undefined>([]);
  /** Le nom de l'animation, repris dans le titre accessible du lecteur. */
  readonly titre = input<string>();

  private readonly sanitizer = inject(DomSanitizer);
  protected readonly consentements = inject(ConsentementsService);

  /** La première vidéo YouTube, Vimeo ou Dailymotion de la liste : la seule lue. */
  protected readonly tierce = computed(() => (this.videos() ?? []).find((v): v is VideoHebergee => v.provider !== 'self'));
  protected readonly plateforme = computed(() => {
    const t = this.tierce();
    return t ? PLATEFORMES[t.provider] : '';
  });
  /** Pas de rubrique tant que les consentements ne sont pas lus (on ne confond pas « refusé » et « pas encore lu »), ni après un refus. */
  protected readonly rubriqueVisible = computed(() => this.consentements.charge() && this.consentements.reponseVideo() !== false);
  protected readonly adresse = computed<SafeResourceUrl | null>(() => {
    const t = this.tierce();
    return t ? this.sanitizer.bypassSecurityTrustResourceUrl(adresseLecteur(t)) : null;
  });

  constructor() {
    effect(() => {
      if (this.tierce()) this.consentements.charger().catch((erreur) => console.warn("Les consentements n'ont pas pu être lus.", erreur));
    });
  }

  protected repondre(accepte: boolean): void {
    // Le choix s'applique tout de suite ; l'écriture dans users/{uid} part au retour du serveur (ou du réseau).
    this.consentements.modifier('video', accepte).catch((erreur) => console.warn("Le consentement n'a pas pu être envoyé au profil.", erreur));
  }
  protected readonly boucle = computed(() => (this.videos() ?? []).find((v): v is VideoPropre => v.provider === 'self'));

  /** « attente » : invisible ; « prete » : affichée ; « ecarte » : fichier absent ou lecture refusée. Repart de « attente » si la vidéo choisie change. */
  protected readonly etat = linkedSignal<VideoPropre | undefined, 'attente' | 'prete' | 'ecarte'>({
    source: this.boucle,
    computation: () => 'attente',
  });

  protected surCanplay(evenement: Event): void {
    const lecture = (evenement.target as HTMLVideoElement).play?.();
    if (!lecture) {
      this.etat.set('prete');
      return;
    }
    lecture.then(
      () => this.etat.set('prete'),
      () => this.etat.set('ecarte'),
    );
  }
}
