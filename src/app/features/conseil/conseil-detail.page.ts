import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { BoutonRetourComponent } from '../../shared/bouton-retour/bouton-retour.component';
import { ConseilDetailStore } from './conseil-detail.store';

/** Le détail d'un conseil du top 3 (US 86) : tout vient du top 3 déjà calculé, rien n'est recalculé. */
@Component({
  selector: 'app-conseil-detail',
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
    .entete {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }
    .rang {
      flex: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-weight: 700;
      font-size: 16px;
    }
    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
    }
    .sous-titre {
      margin: 0 0 12px;
      font-size: 16px;
      color: var(--lr-texte-secondaire);
    }
    dl {
      margin: 0;
    }
    .ligne {
      padding: 6px 0;
      border-top: 1px solid var(--lr-bordure);
    }
    .ligne:first-child {
      border-top: none;
    }
    dt,
    dd {
      display: inline;
      margin: 0;
      font-size: 16px;
    }
    dt {
      font-weight: 600;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 700;
    }
    ul {
      margin: 0;
      padding-left: 20px;
    }
    li {
      margin: 0 0 8px;
      font-size: 16px;
      line-height: 1.4;
    }
    .bouton {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 48px;
      margin-top: 16px;
      border: none;
      border-radius: 12px;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-size: 17px;
      font-weight: 600;
      font-family: inherit;
    }
  `,
  template: `
    <ion-header>
      <ion-toolbar>
        <app-bouton-retour slot="start" libelle="Conseil" />
        <ion-title>Détail du conseil</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      @if (detail(); as d) {
        <section class="carte">
          <div class="entete">
            <span class="rang">{{ d.rang }}</span>
            <h2>{{ d.type }}</h2>
          </div>
          <p class="sous-titre">
            Animation : {{ d.animation }}@if (d.espece; as e) { · espèce : {{ e.toLowerCase() }}}@if (toutesEspeces()) { (espèce choisie : toutes)}
          </p>
          <dl>
            <div class="ligne">
              <dt>Couleur :</dt>
              <dd>{{ d.couleur }}</dd>
            </div>
            @if (d.taille; as t) {
              <div class="ligne">
                <dt>{{ t.libelle }} :</dt>
                <dd>{{ t.valeur }}</dd>
              </div>
            }
            @if (d.poidsTete; as p) {
              <div class="ligne">
                <dt>Poids de tête :</dt>
                <dd>{{ p }}</dd>
              </div>
            }
            @if (d.postes; as p) {
              <div class="ligne">
                <dt>Où le lancer :</dt>
                <dd>{{ p }}</dd>
              </div>
            }
          </dl>
        </section>
        <section class="carte">
          <h3>Pourquoi ce conseil</h3>
          <ul>
            @for (phrase of d.pourquoi; track $index) {
              <li>{{ phrase }}</li>
            }
          </ul>
        </section>
        <button type="button" class="bouton" (click)="voirAnimation()">Voir l'animation</button>
      }
    </ion-content>
  `,
})
export class ConseilDetailPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(ConseilDetailStore);

  private readonly rang = Number(this.route.snapshot.paramMap.get('rang'));
  protected readonly toutesEspeces = this.store.toutesEspeces;
  protected readonly detail = computed(() => this.store.details().find((d) => d.rang === this.rang) ?? null);

  constructor() {
    // Rechargement ou lien direct : le top 3 n'existe plus, on retourne à l'écran « Conseil ».
    if (!this.detail()) void this.router.navigateByUrl('/conseil', { replaceUrl: true });
  }

  protected voirAnimation(): void {
    void this.router.navigate(['animation'], { relativeTo: this.route });
  }
}
