import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Video, VideoPropre } from '../../core/data/catalog.types';

/**
 * Lecteur vidéo unique de l'app (PLAN §9 bis). Première étape (US 9) : la boucle courte « self », lue d'elle-même,
 * muette, sans commandes. Les autres fournisseurs sont ignorés pour l'instant.
 * Tant que le fichier manque ou ne se charge pas, rien ne s'affiche : ni zone vidéo, ni message.
 */
@Component({
  selector: 'app-video-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .zone {
      position: relative;
      margin-top: 12px;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: 12px;
      background: var(--lr-sable);
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
      @if (!enErreur()) {
        <div class="zone">
          <video [src]="'assets/' + b.fichier" [muted]="true" muted autoplay loop playsinline preload="auto" (error)="enErreur.set(true)"></video>
          <span class="etiquette">Boucle · sans son</span>
        </div>
      }
    }
  `,
})
export class VideoPlayerComponent {
  readonly videos = input<Video[] | undefined>([]);
  protected readonly enErreur = signal(false);
  protected readonly boucle = computed(() => (this.videos() ?? []).find((v): v is VideoPropre => v.provider === 'self'));
}
