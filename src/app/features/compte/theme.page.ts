import { Component, inject } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { BoutonRetourComponent } from '../../shared/bouton-retour/bouton-retour.component';
import { CHOIX_THEME, ThemeService } from '../../shared/theme.service';

/** « Thème » (US 92, PLAN §3, §11) : suivre le téléphone, ou forcer clair ou sombre. Le choix s'applique tout de suite et reste sur l'appareil. */
@Component({
  selector: 'app-theme',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, BoutonRetourComponent],
  host: { class: 'ion-page' },
  styles: `
    .choix {
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      overflow: hidden;
    }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 52px;
      padding: 10px 16px;
      border-top: 1px solid var(--lr-bordure);
      font-size: 17px;
      cursor: pointer;
    }
    label:first-child {
      border-top: none;
    }
    input {
      position: absolute;
      opacity: 0;
    }
    label:has(input:focus-visible) {
      outline: 2px solid var(--lr-primaire);
      outline-offset: -2px;
    }
    .coche {
      font-size: 20px;
      font-weight: 700;
      color: var(--lr-primaire);
    }
    .aide {
      margin: 12px 4px 0;
      font-size: 15px;
      line-height: 1.45;
      color: var(--lr-texte-secondaire);
    }
  `,
  template: `
    <ion-header>
      <ion-toolbar>
        <app-bouton-retour slot="start" libelle="Compte" />
        <ion-title>Thème</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="choix" role="radiogroup" aria-label="Thème">
        @for (c of choix; track c.valeur) {
          <label>
            <input type="radio" name="theme" [value]="c.valeur" [checked]="theme.choix() === c.valeur" (change)="theme.choisir(c.valeur)" />
            <span>{{ c.libelle }}</span>
            @if (theme.choix() === c.valeur) {
              <span class="coche" aria-hidden="true">✓</span>
            }
          </label>
        }
      </div>
      <p class="aide">
        « Suivre le téléphone » change avec le mode clair ou sombre du téléphone. « Clair » se lit mieux en plein soleil ; « Sombre » n’éblouit pas à l’aube ni la nuit.
      </p>
    </ion-content>
  `,
})
export class ThemePage {
  protected readonly theme = inject(ThemeService);
  protected readonly choix = CHOIX_THEME;
}
