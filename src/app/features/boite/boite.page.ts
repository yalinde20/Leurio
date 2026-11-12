import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { Leurre, SaisieLeurre, TackleBoxService } from '../../core/data/tackle-box.service';
import { LeurreFormulaireComponent } from './leurre-formulaire.component';

/** Familles distinctes du contenu, dans l'ordre de première apparition. */
export function famillesDesTypes(types: readonly Pick<TypeLeurre, 'famille'>[]): string[] {
  return [...new Set(types.map((t) => t.famille).filter((f): f is string => !!f))];
}

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
    .erreur-lecture {
      margin: 0;
      padding: 8px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--lr-danger);
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
    .filtre {
      display: flex;
      gap: 8px;
      margin: 0 -16px 12px;
      padding: 0 16px 4px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .puce {
      position: relative;
      flex: none;
      display: flex;
      align-items: center;
      min-height: 48px;
      padding: 0 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 999px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      font-size: 16px;
      white-space: nowrap;
    }
    .puce.choisie {
      border-color: var(--lr-primaire);
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-weight: 600;
    }
    .puce input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
    .puce:has(input:focus-visible) {
      outline: 2px solid var(--lr-primaire);
      outline-offset: 2px;
    }
    .aucun {
      margin: 24px 0 0;
      text-align: center;
      font-size: 17px;
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
        @if (boite.erreur()) {
          <p class="erreur-lecture" role="alert">Impossible de lire ta boîte. Réessaie plus tard.</p>
        } @else if (boite.leurres(); as leurres) {
          @if (leurres.length === 0) {
            <div class="vide">
              <p>Ta boîte est vide.</p>
              <button type="button" class="ajouter" (click)="ouvrir()">Ajouter un leurre</button>
            </div>
          } @else {
            <button type="button" class="ajouter haut" (click)="ouvrir()">Ajouter un leurre</button>
            @if (familles().length > 0) {
              <div class="filtre" role="radiogroup" aria-label="Famille">
                @for (famille of optionsFamille(); track famille ?? 'toutes') {
                  <label class="puce" [class.choisie]="famille === familleChoisie()">
                    <input type="radio" name="famille" [checked]="famille === familleChoisie()" (change)="familleChoisie.set(famille)" />
                    {{ famille ?? 'Toutes' }}
                  </label>
                }
              </div>
            }
            @let affiches = visibles(leurres);
            @if (affiches.length > 0) {
              <ul class="liste">
                @for (leurre of affiches; track leurre.id) {
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
            } @else {
              <p class="aucun">Aucun leurre de cette famille.</p>
            }
          }
        } @else {
          <p class="chargement">Chargement de ta boîte…</p>
        }
      </div>
    </ion-content>
    @if (formulaireOuvert()) {
      <app-leurre-formulaire [types]="types()" [echec]="echec()" [enCours]="enCours()" (valide)="enregistrer($event)" (annuler)="fermer()" />
    }
  `,
})
export class BoitePage implements OnInit {
  protected readonly boite = inject(TackleBoxService);
  private readonly catalogue = inject(CatalogService);

  private readonly typesDuContenu = signal<TypeLeurre[]>([]);
  protected readonly types = computed(() => this.typesDuContenu().map(({ id, nom }) => ({ id, nom })));
  private readonly noms = computed(() => new Map(this.typesDuContenu().map((t) => [t.id, t.nom])));
  protected readonly familles = computed(() => famillesDesTypes(this.typesDuContenu()));
  protected readonly optionsFamille = computed(() => [null, ...this.familles()]);
  /** Famille choisie ; null = « Toutes ». Repart de « Toutes » à chaque ouverture de l'onglet. */
  protected readonly familleChoisie = signal<string | null>(null);
  private readonly famillesParType = computed(() => new Map(this.typesDuContenu().map((t) => [t.id, t.famille])));
  protected readonly formulaireOuvert = signal(false);
  protected readonly echec = signal(false);
  protected readonly enCours = signal(false);
  private declencheur: Element | null = null;

  async ngOnInit(): Promise<void> {
    // Les onglets recréent la page à chaque visite : revenir sur la Boîte relit la boîte après une erreur.
    this.boite.reessayer();
    try {
      this.typesDuContenu.set(await this.catalogue.typesDeLeurres());
    } catch {
      // Contenu illisible : la liste montre alors l'identifiant du type, et « Type » reste vide.
    }
  }

  protected visibles(leurres: Leurre[]): Leurre[] {
    const famille = this.familleChoisie();
    if (famille === null) return leurres;
    return leurres.filter((l) => this.famillesParType().get(l.typeId) === famille);
  }

  protected nomDuType(id: string): string {
    return this.noms().get(id) ?? id;
  }

  protected ouvrir(): void {
    this.echec.set(false);
    this.declencheur = document.activeElement;
    this.formulaireOuvert.set(true);
  }

  protected fermer(): void {
    this.formulaireOuvert.set(false);
    // Le bouton d'ouverture est dans le DOM ; s'il a été remplacé (état vide -> liste), on ne rend pas le focus.
    if (this.declencheur instanceof HTMLElement && this.declencheur.isConnected) this.declencheur.focus();
    this.declencheur = null;
  }

  protected async enregistrer(saisie: SaisieLeurre): Promise<void> {
    if (this.enCours()) return;
    this.enCours.set(true);
    this.echec.set(false);
    try {
      await this.boite.ajouter(saisie);
      this.fermer();
    } catch {
      this.echec.set(true);
    } finally {
      this.enCours.set(false);
    }
  }
}
