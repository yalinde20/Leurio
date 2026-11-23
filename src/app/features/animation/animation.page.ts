import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { Animation, CatalogService } from '../../core/data/catalog.service';
import { ConseilDetailStore } from '../conseil/conseil-detail.store';
import { BoutonRetourComponent } from '../../shared/bouton-retour/bouton-retour.component';
import { VideoPlayerComponent } from '../../shared/video-player/video-player.component';

/**
 * La fiche d'une animation (US 86, US 8) : geste, vitesse et erreur à éviter, lus dans techniques.json. La boucle courte « self » est lue sous le texte (US 9) ; sans fichier lisible, la fiche n'a que ses textes.
 * Une animation absente du contenu (ou un contenu illisible) affiche « Cette animation n'est pas encore décrite ».
 */
@Component({
  selector: 'app-animation',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, BoutonRetourComponent, VideoPlayerComponent],
  host: { class: 'ion-page' },
  styles: `
    .carte {
      margin-bottom: 12px;
      padding: 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
    }
    h2 {
      margin: 0 0 12px;
      font-size: 22px;
      font-weight: 700;
    }
    h3 {
      margin: 12px 0 4px;
      font-size: 16px;
      font-weight: 600;
    }
    .message-vide {
      color: var(--lr-texte-secondaire);
    }
    p {
      margin: 0;
      font-size: 16px;
      line-height: 1.4;
    }
  `,
  template: `
    <ion-header>
      <ion-toolbar>
        <app-bouton-retour slot="start" libelle="Détail" />
        <ion-title>Animation</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      @if (animation(); as a) {
        <section class="carte">
          <h2>{{ a.nom }}</h2>
          <h3>Le geste</h3>
          <p>{{ a.geste }}</p>
          <h3>Vitesse</h3>
          <p>{{ a.vitesse }}</p>
          <h3>Erreur à éviter</h3>
          <p>{{ a.erreurAEviter }}</p>
        </section>
        <app-video-player [videos]="a.videos" [titre]="a.nom" />
      } @else if (absente()) {
        <section class="carte">
          <h2>Animation</h2>
          <p class="message-vide">Cette animation n'est pas encore décrite</p>
        </section>
      }
    </ion-content>
  `,
})
export class AnimationPage implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly catalogue = inject(CatalogService);
  private readonly store = inject(ConseilDetailStore);

  protected readonly animation = signal<Animation | null>(null);
  /** Le conseil renvoie vers une animation que le contenu ne décrit pas (ou qu'il ne peut pas lire). */
  protected readonly absente = signal(false);

  async ngOnInit(): Promise<void> {
    const rang = Number(this.route.snapshot.paramMap.get('rang'));
    const id = this.store.details().find((d) => d.rang === rang)?.animationId;
    if (!id) {
      // Rechargement ou lien direct, sans conseil en mémoire : retour à l'écran « Conseil ».
      void this.router.navigateByUrl('/conseil', { replaceUrl: true });
      return;
    }
    try {
      const trouvee = (await this.catalogue.animations()).find((a) => a.id === id);
      if (trouvee) {
        this.animation.set(trouvee);
        return;
      }
    } catch {
      // Contenu illisible : même message que pour une animation absente du contenu.
    }
    this.absente.set(true);
  }
}
