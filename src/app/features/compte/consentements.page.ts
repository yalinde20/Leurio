import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToggle, IonToolbar } from '@ionic/angular';
import { Consentement, ConsentementsService } from '../../core/data/consentements.service';
import { BoutonRetourComponent } from '../../shared/bouton-retour/bouton-retour.component';

/**
 * « Consentements » (US 94, PLAN §4, §7, §9 bis) : accepter ou refuser la mesure d'audience et les lecteurs vidéo tiers. Chaque choix s'applique
 * tout de suite (`ConsentementsService`) et s'écrit dans `users/{uid}` ; hors ligne, l'écriture attend le retour du réseau et la page le dit.
 */
@Component({
  selector: 'app-consentements',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonToggle, BoutonRetourComponent, RouterLink],
  host: { class: 'ion-page' },
  styles: `
    .aide {
      margin: 0 4px 16px;
      font-size: 15px;
      line-height: 1.45;
      color: var(--lr-texte-secondaire);
    }
    .aide a {
      color: var(--lr-primaire);
    }
    .groupe {
      margin: 0 0 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      overflow: hidden;
    }
    .rangee {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 64px;
      padding: 10px 16px;
      border-top: 1px solid var(--lr-bordure);
      font-size: 17px;
    }
    .rangee:first-child {
      border-top: none;
    }
    .texte {
      flex: 1;
      min-width: 0;
    }
    .sous {
      display: block;
      margin-top: 2px;
      font-size: 14px;
      line-height: 1.35;
      color: var(--lr-texte-secondaire);
    }
    ion-toggle {
      flex: none;
      min-width: 48px;
      min-height: 48px;
    }
  `,
  template: `
    <ion-header>
      <ion-toolbar>
        <app-bouton-retour slot="start" libelle="Compte" />
        <ion-title>Consentements</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p class="aide">Rien n’est chargé sans ton accord. Tu peux changer d’avis à tout moment ; ton choix vaut sur tous tes appareils.</p>
      <div class="groupe">
        <div class="rangee">
          <span class="texte">
            Mesure d’audience (Analytics)
            <span class="sous">Des statistiques d’usage, envoyées à Google Analytics, pour améliorer l’app. Jamais ta position exacte.</span>
          </span>
          <ion-toggle
            aria-label="Mesure d’audience (Analytics)"
            [checked]="consentements.analytics()"
            (ionChange)="changer('analytics', $event.detail.checked)"
          />
        </div>
        <div class="rangee">
          <span class="texte">
            Lecteurs vidéo tiers
            <span class="sous">
              Les vidéos complètes de YouTube, Vimeo ou Dailymotion. Ces plateformes voient ton adresse IP et peuvent déposer des cookies. Les
              boucles courtes marchent sans.
            </span>
          </span>
          <ion-toggle aria-label="Lecteurs vidéo tiers" [checked]="consentements.video()" (ionChange)="changer('video', $event.detail.checked)" />
        </div>
      </div>
      <p class="aide">Le détail est dans <a [routerLink]="['/compte', 'confidentialite']">Confidentialité</a>.</p>
      @if (enAttente() > 0) {
        <p class="aide">Pas encore synchronisé : ce sera fait au retour du réseau.</p>
      }
    </ion-content>
  `,
})
export class ConsentementsPage implements OnInit {
  protected readonly consentements = inject(ConsentementsService);
  /** Nombre d'écritures dans `users/{uid}` pas encore acquittées par le serveur. */
  protected readonly enAttente = signal(0);

  ngOnInit(): void {
    this.consentements.charger().catch((erreur) => console.warn("Les consentements n'ont pas pu être lus.", erreur));
  }

  protected async changer(consentement: Consentement, accepte: boolean): Promise<void> {
    // Ionic émet aussi `ionChange` quand la valeur est posée par le code : on ignore ce qui ne change rien.
    if (this.consentements[consentement]() === accepte) return;
    this.enAttente.update((n) => n + 1);
    try {
      await this.consentements.modifier(consentement, accepte);
    } catch (erreur) {
      console.warn("Le consentement n'a pas pu être envoyé au profil.", erreur);
    } finally {
      this.enAttente.update((n) => n - 1);
    }
  }
}
