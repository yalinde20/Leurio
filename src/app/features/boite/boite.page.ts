import { afterNextRender, Component, computed, effect, ElementRef, inject, Injector, OnInit, signal, viewChild } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { CatalogService, FamilleLeurre, TypeLeurre } from '../../core/data/catalog.service';
import { EchecEnvoiPhoto } from '../../core/data/photo-leurre';
import { Leurre, SaisieLeurre, TackleBoxService } from '../../core/data/tackle-box.service';
import { PictogrammeFamilleComponent } from '../../shared/pictogramme-famille/pictogramme-famille.component';
import { formaterLongueur, formaterPoids } from '../../shared/unites';
import { UnitesService } from '../../shared/unites.service';
import { KitDepartComponent } from './kit-depart.component';
import { LeurreFormulaireComponent } from './leurre-formulaire.component';

@Component({
  selector: 'app-boite',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, LeurreFormulaireComponent, KitDepartComponent, PictogrammeFamilleComponent],
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
    .ajouter.kit {
      border: 1px solid var(--lr-primaire);
      background: transparent;
      color: var(--lr-primaire);
    }
    .ajouter.kit.haut {
      margin-top: -8px;
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
      position: relative;
      padding: 0 40px 12px 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
    }
    .leurre:has(.toucher:active) {
      background: var(--lr-sable);
    }
    .leurre::after {
      content: '›';
      position: absolute;
      top: 50%;
      right: 16px;
      transform: translateY(-50%);
      font-size: 22px;
      color: var(--lr-texte-secondaire);
    }
    .toucher {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: 48px;
      padding: 0;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
    }
    .toucher::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 16px;
    }
    .toucher:focus-visible {
      outline: none;
    }
    .toucher:focus-visible::after {
      outline: 2px solid var(--lr-primaire);
      outline-offset: 2px;
    }
    .avec-vignette {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 40px 12px 12px;
    }
    .vignette {
      flex: none;
      width: 56px;
      height: 56px;
      border: 1px solid var(--lr-bordure);
      border-radius: 10px;
      object-fit: cover;
    }
    .vignette-famille {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: var(--lr-sable);
    }
    .vignette-famille app-pictogramme-famille {
      width: 46px;
      height: 46px;
    }
    .corps {
      flex: 1;
      min-width: 0;
    }
    .leurre h3 {
      margin: 0;
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
      font-weight: 500;
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
    <ion-content [attr.inert]="formulaireOuvert() || kitOuvert() ? '' : null">
      <div class="contenu">
        @if (boite.erreur()) {
          <p class="erreur-lecture" role="alert">Impossible de lire ta boîte. Réessaie plus tard.</p>
        } @else if (boite.leurres(); as leurres) {
          @if (leurres.length === 0) {
            <div class="vide">
              <p>Ta boîte est vide.</p>
              <button #ajouter type="button" class="ajouter" (click)="ouvrir()">Ajouter un leurre</button>
              <button type="button" class="ajouter kit" (click)="ouvrirKit($event)">Kit de départ conseillé</button>
            </div>
          } @else {
            <button #ajouter type="button" class="ajouter haut" (click)="ouvrir()">Ajouter un leurre</button>
            <button type="button" class="ajouter kit haut" (click)="ouvrirKit($event)">Kit de départ conseillé</button>
            @if (famillesDuContenu().length > 0) {
              <div class="filtre" role="radiogroup" aria-label="Famille">
                @for (famille of optionsFamille(); track famille?.id ?? 'toutes') {
                  <label class="puce" [class.choisie]="(famille?.id ?? null) === familleChoisie()">
                    <input type="radio" name="famille" [checked]="(famille?.id ?? null) === familleChoisie()" (change)="familleChoisie.set(famille?.id ?? null)" />
                    {{ famille?.nom ?? 'Toutes' }}
                  </label>
                }
              </div>
            }
            @let affiches = visibles(leurres);
            @if (affiches.length > 0) {
              <ul class="liste">
                @for (leurre of affiches; track leurre.id) {
                  <li class="leurre" [class.avec-vignette]="leurre.photoUrl || familleDe(leurre.typeId)">
                    @if (leurre.photoUrl) {
                      <img class="vignette" [src]="leurre.photoUrl" alt="Photo du leurre" />
                    } @else if (familleDe(leurre.typeId); as famille) {
                      <span class="vignette-famille"><app-pictogramme-famille [famille]="famille" /></span>
                    }
                    <div class="corps">
                      <h3>
                        <button type="button" class="toucher" [attr.aria-describedby]="'details-' + leurre.id" (click)="modifier(leurre)">{{ nomDuType(leurre.typeId) }}</button>
                      </h3>
                      <p class="details" [id]="'details-' + leurre.id">{{ taille(leurre.tailleCm) }} · {{ poids(leurre.poidsG) }} · {{ leurre.couleur }}</p>
                      @if (leurre.marque) {
                        <p class="marque">{{ leurre.marque }}</p>
                      }
                      @if (leurre.enAttente) {
                        <p class="attente">Pas encore synchronisé : il le sera au retour du réseau.</p>
                      }
                    </div>
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
      <app-leurre-formulaire
        [types]="types()"
        [leurre]="leurreModifie()"
        [echec]="echec()"
        [echecSuppression]="echecSuppression()"
        [echecPhoto]="echecPhoto()"
        [enCours]="enCours()"
        (valide)="enregistrer($event)"
        (supprimer)="supprimer()"
        (annuler)="fermer()"
      />
    }
    @if (kitOuvert()) {
      <app-kit-depart (fermer)="fermerKit()" />
    }
  `,
})
export class BoitePage implements OnInit {
  protected readonly boite = inject(TackleBoxService);
  private readonly catalogue = inject(CatalogService);
  private readonly unites = inject(UnitesService);

  private readonly typesDuContenu = signal<TypeLeurre[]>([]);
  protected readonly types = computed(() => this.typesDuContenu().map(({ id, nom }) => ({ id, nom })));
  private readonly noms = computed(() => new Map(this.typesDuContenu().map((t) => [t.id, t.nom])));
  protected readonly famillesDuContenu = signal<FamilleLeurre[]>([]);
  /** Puces du filtre : null = « Toutes », puis les familles dans l'ordre du contenu. */
  protected readonly optionsFamille = computed<(FamilleLeurre | null)[]>(() => [null, ...this.famillesDuContenu()]);
  /** Identifiant de la famille choisie ; null = « Toutes ». Repart de « Toutes » à chaque ouverture de l'onglet. */
  protected readonly familleChoisie = signal<string | null>(null);
  private readonly famillesParType = computed(() => new Map(this.typesDuContenu().map((t) => [t.id, t.famille])));
  private readonly famillesParId = computed(() => new Map(this.famillesDuContenu().map((f) => [f.id, f])));
  protected readonly formulaireOuvert = signal(false);
  protected readonly echec = signal(false);
  protected readonly echecPhoto = signal(false);
  protected readonly enCours = signal(false);
  protected readonly echecSuppression = signal(false);
  /** Le leurre dont le formulaire est ouvert ; null = formulaire d'ajout. */
  protected readonly leurreModifie = signal<Leurre | null>(null);
  private declencheur: Element | null = null;
  protected readonly kitOuvert = signal(false);
  private declencheurKit: HTMLElement | null = null;
  private readonly injector = inject(Injector);
  private readonly boutonAjouter = viewChild<ElementRef<HTMLElement>>('ajouter');

  constructor() {
    // Un leurre supprimé ailleurs pendant qu'on le modifie : on ferme le formulaire plutôt que d'écrire dans un document absent.
    effect(() => {
      const leurre = this.leurreModifie();
      const leurres = this.boite.leurres();
      if (this.formulaireOuvert() && leurre && leurres && !leurres.some((l) => l.id === leurre.id)) this.fermerApresSuppression();
    });
  }

  async ngOnInit(): Promise<void> {
    // Les onglets recréent la page à chaque visite : revenir sur la Boîte relit la boîte après une erreur.
    this.boite.reessayer();
    try {
      this.typesDuContenu.set(await this.catalogue.typesDeLeurres());
    } catch {
      // Contenu illisible : la liste montre alors l'identifiant du type, et « Type » reste vide.
      return;
    }
    try {
      this.famillesDuContenu.set(await this.catalogue.famillesDeLeurres());
    } catch {
      // Familles illisibles : le filtre est masqué, la liste reste celle de l'US 99.
    }
  }

  protected visibles(leurres: Leurre[]): Leurre[] {
    const famille = this.familleChoisie();
    if (famille === null) return leurres;
    return leurres.filter((l) => this.famillesParType().get(l.typeId) === famille);
  }

  /** Famille du type de leurre, pour son pictogramme (US 293) ; absente si le contenu des familles est illisible. */
  protected familleDe(typeId: string): FamilleLeurre | undefined {
    const id = this.famillesParType().get(typeId);
    return id === undefined ? undefined : this.famillesParId().get(id);
  }

  protected taille(cm: number): string {
    return formaterLongueur(cm, this.unites.choix()).replace(/\s/g, ' ');
  }

  protected poids(g: number): string {
    return formaterPoids(g, this.unites.choix()).replace(/\s/g, ' ');
  }

  protected nomDuType(id: string): string {
    return this.noms().get(id) ?? id;
  }

  protected ouvrir(): void {
    this.leurreModifie.set(null);
    this.ouvrirFormulaire();
  }

  protected ouvrirKit(evenement: Event): void {
    this.declencheurKit = evenement.currentTarget as HTMLElement;
    this.kitOuvert.set(true);
  }

  protected fermerKit(): void {
    this.kitOuvert.set(false);
    if (this.declencheurKit?.isConnected) this.declencheurKit.focus();
    this.declencheurKit = null;
  }

  protected modifier(leurre: Leurre): void {
    this.leurreModifie.set(leurre);
    this.ouvrirFormulaire();
  }

  private ouvrirFormulaire(): void {
    this.echec.set(false);
    this.echecPhoto.set(false);
    this.echecSuppression.set(false);
    this.declencheur = document.activeElement;
    this.formulaireOuvert.set(true);
  }

  protected fermer(): void {
    this.formulaireOuvert.set(false);
    // Le bouton d'ouverture est dans le DOM ; s'il a été remplacé (état vide -> liste), on ne rend pas le focus.
    if (this.declencheur instanceof HTMLElement && this.declencheur.isConnected) this.declencheur.focus();
    this.declencheur = null;
  }

  /** La ligne du leurre n'existe plus : le focus va sur « Ajouter un leurre » (présent à l'état vide comme dans la liste). */
  private fermerApresSuppression(): void {
    if (!this.formulaireOuvert()) return;
    this.formulaireOuvert.set(false);
    this.declencheur = null;
    afterNextRender(() => this.boutonAjouter()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async enregistrer(saisie: SaisieLeurre): Promise<void> {
    if (this.enCours()) return;
    this.enCours.set(true);
    this.echec.set(false);
    this.echecPhoto.set(false);
    this.echecSuppression.set(false);
    try {
      const leurre = this.leurreModifie();
      await (leurre ? this.boite.modifier(leurre.id, saisie) : this.boite.ajouter(saisie));
      this.fermer();
    } catch (erreur) {
      (erreur instanceof EchecEnvoiPhoto ? this.echecPhoto : this.echec).set(true);
    } finally {
      this.enCours.set(false);
    }
  }

  protected async supprimer(): Promise<void> {
    const leurre = this.leurreModifie();
    if (!leurre || this.enCours()) return;
    this.enCours.set(true);
    this.echec.set(false);
    this.echecSuppression.set(false);
    try {
      await this.boite.supprimer(leurre.id);
      this.fermerApresSuppression();
    } catch {
      this.echecSuppression.set(true);
    } finally {
      this.enCours.set(false);
    }
  }
}
