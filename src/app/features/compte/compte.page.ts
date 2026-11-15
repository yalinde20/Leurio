import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { CHOIX_THEME, ThemeService } from '../../shared/theme.service';

@Component({
  selector: 'app-compte',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, RouterLink, RouterOutlet],
  host: { class: 'ion-page' },
  styles: `
    /* Dès que la page enfant est dans le DOM (avant le prochain passage de détection de changements), l'écran « Compte » lui laisse la place. */
    :host:has(> router-outlet + *) > ion-header,
    :host:has(> router-outlet + *) > ion-content {
      display: none;
    }
    .titre-groupe {
      margin: 0 0 6px 4px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--lr-texte-secondaire);
    }
    .groupe {
      margin: 0 0 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      overflow: hidden;
    }
    .rangee {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 52px;
      padding: 10px 16px;
      border-top: 1px solid var(--lr-bordure);
      font-size: 17px;
      color: var(--lr-texte);
      text-decoration: none;
    }
    .rangee:first-child {
      border-top: none;
    }
    .chevron {
      font-size: 22px;
      color: var(--lr-texte-secondaire);
    }
    .valeur {
      margin-left: auto;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    .sous {
      display: block;
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
    .externe {
      flex: none;
      white-space: nowrap;
      font-size: 15px;
      font-weight: 600;
      color: var(--lr-primaire);
    }
  `,
  template: `
    @if (!enfantOuvert()) {
      <ion-header>
        <ion-toolbar>
          <ion-title>Compte</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <h2 class="titre-groupe">Réglages</h2>
        <div class="groupe">
          <a class="rangee" [routerLink]="['/compte', 'preferences']">
            <span>
              Préférences
              <span class="sous">Espèces, niveau, unités</span>
            </span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
          <a class="rangee" [routerLink]="['/compte', 'theme']">
            <span>Thème</span>
            <span class="valeur">{{ libelleTheme() }}</span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
          <a class="rangee" [routerLink]="['/compte', 'consentements']">
            <span>
              Consentements
              <span class="sous">Mesure d’audience, vidéos</span>
            </span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        </div>
        <h2 class="titre-groupe">Informations</h2>
        <div class="groupe">
          <a class="rangee" [routerLink]="['/compte', 'a-propos']">
            <span>À propos et sources</span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
          <a class="rangee" [routerLink]="['/compte', 'confidentialite']">
            <span>Confidentialité</span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        </div>
        <h2 class="titre-groupe">Réglementation</h2>
        <div class="groupe">
          <a class="rangee" href="https://www.cartedepeche.fr" target="_blank" rel="noopener">
            <span>
              Carte de pêche
              <span class="sous">Achète ta carte sur le site officiel</span>
            </span>
            <span class="externe">cartedepeche.fr <span aria-hidden="true">↗</span></span>
          </a>
        </div>
      </ion-content>
    }
    <router-outlet (activate)="enfantOuvert.set(true)" (deactivate)="enfantOuvert.set(false)" />
  `,
})
export class ComptePage {
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  protected readonly libelleTheme = computed(() => CHOIX_THEME.find((c) => c.valeur === this.theme.choix())?.libelle);

  /**
   * Vrai quand une page enfant (Préférences, Thème, Consentements, À propos et sources, Confidentialité) est ouverte : l'écran « Compte » lui laisse la place.
   * Piloté par l'activation de la sortie, pour masquer l'en-tête dans le même passage que l'apparition de l'enfant.
   */
  protected readonly enfantOuvert = signal(this.router.url.split(/[?#]/)[0].startsWith('/compte/'));
}
