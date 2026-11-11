import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { SaisieLeurre, TackleBoxService } from '../../core/data/tackle-box.service';
import { LeurreFormulaireComponent } from './leurre-formulaire.component';

@Component({
  selector: 'app-boite',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, LeurreFormulaireComponent],
  host: { class: 'ion-page' },
  styles: `
    .contenu {
      padding: 16px;
    }
    .chargement {
      margin: 0;
      padding: 8px 0;
      font-size: 16px;
      color: var(--lr-texte-secondaire);
    }
    .vide {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60%;
      gap: 8px;
      text-align: center;
    }
    .vide p {
      margin: 0;
      font-size: 17px;
    }
    .ajouter {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 0 24px;
      border: none;
      border-radius: 12px;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-family: inherit;
      font-size: 17px;
      font-weight: 600;
    }
    .ajouter.haut {
      width: 100%;
      margin-bottom: 16px;
    }
    .liste {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .leurre {
      padding: 12px 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
    }
    .leurre h3 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 700;
    }
    .leurre p {
      margin: 0;
    }
    .details {
      font-size: 16px;
    }
    .marque {
      margin-top: 2px !important;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    .attente {
      margin-top: 6px !important;
      font-size: 14px;
      color: var(--lr-texte-secondaire);
    }
  `,
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Boîte</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="contenu">
        @if (boite.leurres(); as leurres) {
          @if (leurres.length === 0) {
            <div class="vide">
              <p>Ta boîte est vide.</p>
              <button type="button" class="ajouter" (click)="ouvrir()">Ajouter un leurre</button>
            </div>
          } @else {
            <button type="button" class="ajouter haut" (click)="ouvrir()">Ajouter un leurre</button>
            <ul class="liste">
              @for (leurre of leurres; track leurre.id) {
                <li class="leurre">
                  <h3>{{ nomDuType(leurre.typeId) }}</h3>
                  <p class="details">{{ leurre.tailleCm }} cm · {{ leurre.poidsG }} g · {{ leurre.couleur }}</p>
                  @if (leurre.marque) {
                    <p class="marque">{{ leurre.marque }}</p>
                  }
                  @if (leurre.enAttente) {
                    <p class="attente">Pas encore synchronisé : il le sera au retour du réseau.</p>
                  }
                </li>
              }
            </ul>
          }
        } @else {
          <p class="chargement">Chargement de ta boîte…</p>
        }
      </div>
    </ion-content>
    @if (formulaireOuvert()) {
      <app-leurre-formulaire [types]="types()" [echec]="echec()" (valide)="enregistrer($event)" (annuler)="fermer()" />
    }
  `,
})
export class BoitePage implements OnInit {
  protected readonly boite = inject(TackleBoxService);
  private readonly catalogue = inject(CatalogService);

  private readonly typesDuContenu = signal<TypeLeurre[]>([]);
  protected readonly types = computed(() => this.typesDuContenu().map(({ id, nom }) => ({ id, nom })));
  private readonly noms = computed(() => new Map(this.typesDuContenu().map((t) => [t.id, t.nom])));
  protected readonly formulaireOuvert = signal(false);
  protected readonly echec = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      this.typesDuContenu.set(await this.catalogue.typesDeLeurres());
    } catch {
      // Contenu illisible : la liste montre alors l'identifiant du type, et « Type » reste vide.
    }
  }

  protected nomDuType(id: string): string {
    return this.noms().get(id) ?? id;
  }

  protected ouvrir(): void {
    this.echec.set(false);
    this.formulaireOuvert.set(true);
  }

  protected fermer(): void {
    this.formulaireOuvert.set(false);
  }

  protected async enregistrer(saisie: SaisieLeurre): Promise<void> {
    try {
      await this.boite.ajouter(saisie);
      this.fermer();
    } catch {
      this.echec.set(true);
    }
  }
}
