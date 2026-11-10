import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { Animation, CatalogService } from '../../core/data/catalog.service';
import { ConseilDetailStore } from '../conseil/conseil-detail.store';
import { BoutonRetourComponent } from '../../shared/bouton-retour/bouton-retour.component';

/** La fiche d'une animation (US 86) : geste, vitesse et erreur à éviter. La vidéo arrivera avec le ticket 20. */
@Component({
  selector: 'app-animation',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, BoutonRetourComponent],
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
    p {
      margin: 0;
      font-size: 16px;
      line-height: 1.4;
    }
    .video-attente {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 180px;
      padding: 16px;
      border-radius: 12px;
      background: var(--lr-sable);
      color: var(--lr-texte-secondaire);
      font-size: 15px;
      text-align: center;
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
          <h3>La vitesse</h3>
          <p>{{ a.vitesse }}</p>
          <h3>L'erreur à éviter</h3>
          <p>{{ a.erreurAEviter }}</p>
        </section>
        <div class="video-attente">La vidéo de l'animation arrive bientôt.</div>
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

  async ngOnInit(): Promise<void> {
    const rang = Number(this.route.snapshot.paramMap.get('rang'));
    const id = this.store.details().find((d) => d.rang === rang)?.animationId;
    try {
      const trouvee = id ? (await this.catalogue.animations()).find((a) => a.id === id) : undefined;
      if (trouvee) {
        this.animation.set(trouvee);
        return;
      }
    } catch {
      // Contenu illisible : même sortie que pour une animation introuvable.
    }
    // Rechargement, lien direct ou animation introuvable : retour à l'écran « Conseil ».
    void this.router.navigateByUrl('/conseil', { replaceUrl: true });
  }
}
