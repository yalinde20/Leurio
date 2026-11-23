import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { Video, VideoPropre } from '../../core/data/catalog.types';

/**
 * Lecteur vidéo unique de l'app (PLAN §9 bis). Première étape (US 9) : la boucle courte « self », lue d'elle-même,
 * muette, sans commandes. Les autres fournisseurs sont ignorés pour l'instant.
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
  `,
})
export class VideoPlayerComponent {
  readonly videos = input<Video[] | undefined>([]);
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
