import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, Injector, afterNextRender, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { AccesPhotoRefuse, OriginePhoto, SOURCE_PHOTO } from '../../core/data/photo-leurre';
import { Leurre, SaisieLeurre } from '../../core/data/tackle-box.service';
import { FEATURE_FLAGS } from '../../core/firebase/feature-flags';
import { erreurNombre, erreurTexte, nombrePositif } from './saisie-leurre';

/** Un type de leurre proposé dans « Type » : le contenu le fournit, la page le transmet. */
export interface ChoixType {
  id: string;
  nom: string;
}

/**
 * Le formulaire « Ajouter un leurre » (US 99) : une feuille plein écran dans la page (pas d'ion-modal), comme les feuilles des US 83 et 87.
 * Il valide la saisie et rend un leurre prêt à écrire ; l'enregistrement est l'affaire de la page.
 * Avec `leurre`, c'est « Modifier le leurre » (US 101) : prérempli, avec un bouton « Supprimer » et sa confirmation.
 * La photo (US 102) est choisie ici mais envoyée par le service à l'enregistrement : `valide` porte la photo à envoyer (`Blob`) ou à retirer (`null`).
 */
@Component({
  selector: 'app-leurre-formulaire',
  host: { '(keydown.escape)': 'annuler.emit()' },
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: block;
    }
    .feuille {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      outline: none;
      background: var(--lr-fond);
      color: var(--lr-texte);
    }
    .barre {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: max(0px, var(--ion-safe-area-top, env(safe-area-inset-top))) 8px 0;
      border-bottom: 1px solid var(--lr-bordure);
      background: var(--lr-surface);
    }
    .barre h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
    }
    .annuler {
      min-width: 80px;
      min-height: 48px;
      padding: 0 8px;
      border: none;
      background: transparent;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 17px;
      text-align: left;
    }
    .cale {
      min-width: 80px;
    }
    form {
      flex: 1;
      overflow-y: auto;
      padding: 16px 16px max(16px, env(safe-area-inset-bottom));
    }
    .groupe {
      margin-bottom: 14px;
    }
    .deux {
      display: flex;
      gap: 12px;
    }
    .deux .groupe {
      flex: 1;
      min-width: 0;
    }
    label,
    .etiquette {
      display: block;
      margin-bottom: 6px;
      font-size: 15px;
      font-weight: 600;
    }
    input,
    select {
      width: 100%;
      min-height: 48px;
      box-sizing: border-box;
      padding: 8px 12px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 17px;
    }
    [aria-invalid='true'] {
      border: 2px solid var(--lr-danger);
    }
    .erreur {
      margin: 6px 0 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--lr-danger);
    }
    .supprimer {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 48px;
      margin-top: 12px;
      border: 1px solid var(--lr-danger);
      border-radius: 12px;
      background: transparent;
      color: var(--lr-danger);
      font-family: inherit;
      font-size: 17px;
      font-weight: 600;
    }
    .voile {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--lr-voile);
    }
    .alerte {
      width: 280px;
      max-width: calc(100% - 32px);
      overflow: hidden;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      text-align: center;
    }
    .alerte h3 {
      margin: 0;
      padding: 18px 16px 14px;
      font-size: 17px;
      font-weight: 600;
    }
    .actions {
      display: flex;
      border-top: 1px solid var(--lr-bordure);
    }
    .actions button {
      flex: 1;
      min-height: 48px;
      border: none;
      background: transparent;
      font-family: inherit;
      font-size: 17px;
    }
    .actions button + button {
      border-left: 1px solid var(--lr-bordure);
    }
    .actions .refuser {
      color: var(--lr-primaire);
    }
    .actions .confirmer {
      color: var(--lr-danger);
      font-weight: 600;
    }
    .bouton-photo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      min-height: 48px;
      border: 1px dashed var(--lr-primaire);
      border-radius: 12px;
      background: transparent;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 17px;
      font-weight: 600;
    }
    .bouton-photo svg {
      width: 22px;
      height: 22px;
    }
    .apercu {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    img {
      flex: none;
      width: 96px;
      height: 96px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      object-fit: cover;
    }
    .actions-photo {
      flex: 1;
      display: grid;
      gap: 8px;
    }
    .lien-photo {
      display: flex;
      align-items: center;
      min-height: 48px;
      padding: 0 12px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: transparent;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 16px;
      font-weight: 600;
    }
    .lien-photo.retirer {
      color: var(--lr-danger);
    }
    .choix {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 8px max(16px, env(safe-area-inset-bottom));
      background: var(--lr-voile);
      outline: none;
    }
    .choix-groupe {
      overflow: hidden;
      border: 1px solid var(--lr-bordure);
      border-radius: 14px;
      background: var(--lr-surface);
      color: var(--lr-texte);
    }
    .choix h3 {
      margin: 0;
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 400;
      text-align: center;
      color: var(--lr-texte-secondaire);
    }
    .choix button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 56px;
      border: none;
      border-top: 1px solid var(--lr-bordure);
      background: transparent;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 19px;
    }
    .choix .annuler-choix {
      border-top: none;
      font-weight: 600;
    }
    .enregistrer:disabled {
      opacity: 0.6;
    }
    .enregistrer {
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
      font-family: inherit;
      font-size: 17px;
      font-weight: 600;
    }
  `,
  template: `
    <div #dialogue tabindex="-1" class="feuille" role="dialog" aria-modal="true" aria-labelledby="titre-leurre">
      <div class="barre">
        <button type="button" class="annuler" (click)="annuler.emit()">Annuler</button>
        <h2 id="titre-leurre">{{ leurre() ? 'Modifier le leurre' : 'Ajouter un leurre' }}</h2>
        <span class="cale"></span>
      </div>
      <form novalidate (submit)="enregistrer($event)">
        <div class="groupe">
          <label for="leurre-type">Type</label>
          <select
            id="leurre-type"
            [attr.aria-invalid]="erreurType() ? 'true' : null"
            [attr.aria-describedby]="erreurType() ? 'erreur-type' : null"
            (change)="typeId.set($any($event.target).value)"
            (input)="typeId.set($any($event.target).value)"
          >
            <option value="" [selected]="typeId() === ''">Choisis un type</option>
            @for (type of types(); track type.id) {
              <option [value]="type.id" [selected]="type.id === typeId()">{{ type.nom }}</option>
            }
          </select>
          @if (erreurType(); as message) {
            <p id="erreur-type" class="erreur" role="alert">{{ message }}</p>
          }
        </div>
        <div class="deux">
          <div class="groupe">
            <label for="leurre-taille">Taille (cm)</label>
            <input
              id="leurre-taille"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder="Ex. : 10"
              [value]="taille()"
              [attr.aria-invalid]="erreurTaille() ? 'true' : null"
              [attr.aria-describedby]="erreurTaille() ? 'erreur-taille' : null"
              (input)="taille.set($any($event.target).value)"
              (change)="taille.set($any($event.target).value)"
            />
            @if (erreurTaille(); as message) {
              <p id="erreur-taille" class="erreur" role="alert">{{ message }}</p>
            }
          </div>
          <div class="groupe">
            <label for="leurre-poids">Poids (g)</label>
            <input
              id="leurre-poids"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder="Ex. : 12"
              [value]="poids()"
              [attr.aria-invalid]="erreurPoids() ? 'true' : null"
              [attr.aria-describedby]="erreurPoids() ? 'erreur-poids' : null"
              (input)="poids.set($any($event.target).value)"
              (change)="poids.set($any($event.target).value)"
            />
            @if (erreurPoids(); as message) {
              <p id="erreur-poids" class="erreur" role="alert">{{ message }}</p>
            }
          </div>
        </div>
        <div class="groupe">
          <label for="leurre-couleur">Couleur</label>
          <input
            id="leurre-couleur"
            type="text"
            autocomplete="off"
            placeholder="Ex. : gardon"
            [value]="couleur()"
            [attr.aria-invalid]="erreurCouleur() ? 'true' : null"
            [attr.aria-describedby]="erreurCouleur() ? 'erreur-couleur' : null"
            (input)="couleur.set($any($event.target).value)"
            (change)="couleur.set($any($event.target).value)"
          />
          @if (erreurCouleur(); as message) {
            <p id="erreur-couleur" class="erreur" role="alert">{{ message }}</p>
          }
        </div>
        <div class="groupe">
          <label for="leurre-marque">Marque (facultatif)</label>
          <input
            id="leurre-marque"
            type="text"
            autocomplete="off"
            placeholder="Ex. : Sakura"
            [value]="marque()"
            (input)="marque.set($any($event.target).value)"
            (change)="marque.set($any($event.target).value)"
          />
        </div>
        @if (photosActives || apercu()) {
        <div class="groupe" role="group" aria-labelledby="etiquette-photo">
          <span id="etiquette-photo" class="etiquette">Photo (facultatif)</span>
          @if (apercu(); as source) {
            <div class="apercu">
              <img [src]="source" alt="Photo du leurre" />
              <div class="actions-photo">
                @if (photosActives) {
                  <button #changer type="button" class="lien-photo" (click)="ouvrirChoix()">Changer la photo</button>
                }
                <button type="button" class="lien-photo retirer" (click)="retirerPhoto()">Retirer la photo</button>
              </div>
            </div>
          } @else {
            <button type="button" class="bouton-photo" (click)="ouvrirChoix()">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                <circle cx="12" cy="13" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8" />
              </svg>
              Ajouter une photo
            </button>
          }
          @if (messagePhoto(); as message) {
            <p class="erreur" role="alert">{{ message }}</p>
          }
        </div>
        }
        @if (echec()) {
          <p class="erreur" role="alert">Impossible d'enregistrer le leurre. Réessaie.</p>
        }
        @if (echecPhoto()) {
          <p class="erreur" role="alert">Impossible d'envoyer la photo. Réessaie.</p>
        }
        @if (echecSuppression()) {
          <p class="erreur" role="alert">Impossible de supprimer le leurre. Réessaie.</p>
        }
        <button type="submit" class="enregistrer" [disabled]="enCours()" [attr.aria-busy]="enCours() ? 'true' : null">{{ enCours() && envoiPhoto() ? 'Envoi de la photo…' : 'Enregistrer' }}</button>
        @if (leurre()) {
          <button #supprimer type="button" class="supprimer" [disabled]="enCours()" (click)="confirmer.set(true)">Supprimer</button>
        }
      </form>
    </div>
    @if (choixPhoto()) {
      <div
        #choix
        class="choix"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-photo"
        tabindex="-1"
        (keydown.escape)="$event.stopPropagation(); fermerChoix()"
        (keydown.tab)="pieger($event)"
      >
        <div class="choix-groupe">
          <h3 id="titre-photo">Photo du leurre</h3>
          <button type="button" (click)="choisirPhoto('camera')">Prendre une photo</button>
          <button type="button" (click)="choisirPhoto('galerie')">Choisir dans la galerie</button>
        </div>
        <div class="choix-groupe">
          <button type="button" class="annuler-choix" (click)="fermerChoix()">Annuler</button>
        </div>
      </div>
    }
    @if (confirmer()) {
      <div class="voile">
        <div
          #alerte
          class="alerte"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titre-confirmation"
          tabindex="-1"
          (keydown.escape)="$event.stopPropagation(); fermerConfirmation()"
          (keydown.tab)="pieger($event)"
        >
          <h3 id="titre-confirmation">Supprimer ce leurre ?</h3>
          <div class="actions">
            <button #refuser type="button" class="refuser" (click)="fermerConfirmation()">Annuler</button>
            <button type="button" class="confirmer" (click)="confirmerSuppression()">Supprimer</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class LeurreFormulaireComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly types = input.required<ChoixType[]>();
  /** Affiche un message d'échec d'enregistrement (la page le pilote). */
  readonly echec = input(false);
  /** Un enregistrement est en cours : le bouton est désactivé pour éviter un double ajout. */
  readonly enCours = input(false);
  /** Le leurre à modifier ; absent, le formulaire ajoute un leurre. */
  readonly leurre = input<Leurre | null>(null);
  /** Affiche un message d'échec de suppression (la page le pilote). */
  readonly echecSuppression = input(false);
  /** L'envoi de la photo a échoué à l'enregistrement (la page le pilote) : le formulaire reste ouvert avec la photo. */
  readonly echecPhoto = input(false);
  readonly valide = output<SaisieLeurre>();
  readonly supprimer = output<void>();
  readonly annuler = output<void>();

  protected readonly typeId = signal('');
  protected readonly taille = signal('');
  protected readonly poids = signal('');
  protected readonly couleur = signal('');
  protected readonly marque = signal('');
  protected readonly confirmer = signal(false);
  /** La feuille « Photo du leurre » est ouverte. */
  protected readonly choixPhoto = signal(false);
  /** Refus d'accès ou hors ligne, à afficher sous le bouton de la photo. */
  protected readonly messagePhoto = signal<string | null>(null);
  /** Choix du pêcheur : `undefined` = photo actuelle gardée, `Blob` = nouvelle photo, `null` = photo retirée. */
  private readonly photo = signal<Blob | null | undefined>(undefined);
  private readonly urlNouvellePhoto = signal<string | null>(null);
  /** Ce que l'aperçu montre : la nouvelle photo, sinon la photo actuelle du leurre (sauf si elle est retirée). */
  protected readonly apercu = computed(() => {
    const photo = this.photo();
    if (photo === undefined) return this.leurre()?.photoUrl ?? null;
    return photo === null ? null : this.urlNouvellePhoto();
  });
  /** Une nouvelle photo part avec l'enregistrement : le bouton le dit pendant l'envoi. */
  protected readonly envoiPhoto = computed(() => this.photo() instanceof Blob);
  /** Les erreurs n'apparaissent qu'après un premier essai d'enregistrement. */
  private readonly tente = signal(false);

  protected readonly erreurType = computed(() => (this.tente() ? erreurTexte(this.typeId()) : null));
  protected readonly erreurTaille = computed(() => (this.tente() ? erreurNombre(this.taille()) : null));
  protected readonly erreurPoids = computed(() => (this.tente() ? erreurNombre(this.poids()) : null));
  protected readonly erreurCouleur = computed(() => (this.tente() ? erreurTexte(this.couleur()) : null));

  private readonly dialogue = viewChild.required<ElementRef<HTMLElement>>('dialogue');

  private readonly boutonSupprimer = viewChild<ElementRef<HTMLElement>>('supprimer');
  private readonly alerte = viewChild<ElementRef<HTMLElement>>('alerte');
  private readonly choix = viewChild<ElementRef<HTMLElement>>('choix');
  private readonly changer = viewChild<ElementRef<HTMLElement>>('changer');
  private readonly injector = inject(Injector);
  private readonly boutonRefuser = viewChild<ElementRef<HTMLElement>>('refuser');
  /** La confirmation vient d'être acceptée : le focus revient sur « Supprimer » quand la suppression est finie (échec compris). */
  private focusSupprimerApres = false;
  private readonly sourcePhoto = inject(SOURCE_PHOTO);
  /** Sans stockage (forfait Spark, flag `photosLeurres` désactivé), aucune photo ne peut être ajoutée ni remplacée (US 288) ; lu à l'ouverture, la valeur par défaut est la sûre. */
  protected readonly photosActives = inject(FEATURE_FLAGS).estActif('photosLeurres');
  /** Le bouton qui a ouvert la feuille de choix, pour lui rendre le focus à sa fermeture sans choix. */
  private declencheurPhoto: Element | null = null;

  constructor() {
    // Le focus passe à la confirmation quand elle s'ouvre.
    effect(() => this.boutonRefuser()?.nativeElement.focus());
    // Le focus passe au premier bouton de la feuille de choix de la photo quand elle s'ouvre (Maj+Tab reste piégé dans la feuille).
    effect(() => this.choix()?.nativeElement.querySelector('button')?.focus());
    // La confirmation s'est fermée en emportant le focus : on le rend à « Supprimer » dès qu'il est de nouveau actif.
    effect(() => {
      const bouton = this.boutonSupprimer();
      if (this.focusSupprimerApres && !this.enCours() && bouton) {
        this.focusSupprimerApres = false;
        bouton.nativeElement.focus();
      }
    });
  }

  ngOnInit(): void {
    const l = this.leurre();
    if (!l) return;
    this.typeId.set(l.typeId);
    this.taille.set(String(l.tailleCm).replace('.', ','));
    this.poids.set(String(l.poidsG).replace('.', ','));
    this.couleur.set(l.couleur);
    this.marque.set(l.marque ?? '');
  }

  ngAfterViewInit(): void {
    this.dialogue().nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.liberer();
  }

  /** Hors ligne, le stockage des photos n'est pas disponible (PLAN §4) : on le dit au lieu d'ouvrir le choix. */
  protected ouvrirChoix(): void {
    if (!this.sourcePhoto.enLigne()) {
      this.messagePhoto.set('Photo indisponible hors ligne : ajoute-la plus tard.');
      return;
    }
    this.messagePhoto.set(null);
    this.declencheurPhoto = document.activeElement;
    this.choixPhoto.set(true);
  }

  protected fermerChoix(): void {
    this.choixPhoto.set(false);
    if (this.declencheurPhoto instanceof HTMLElement) {
      const declencheur = this.declencheurPhoto;
      queueMicrotask(() => declencheur.focus());
    }
    this.declencheurPhoto = null;
  }

  protected async choisirPhoto(origine: OriginePhoto): Promise<void> {
    this.choixPhoto.set(false);
    const declencheur = this.declencheurPhoto;
    this.declencheurPhoto = null;
    let choisie = false;
    try {
      // Appelé sans attendre dans le geste du toucher : Safari exige que le sélecteur de fichier s'ouvre pendant ce geste.
      const photo = await this.sourcePhoto.choisir(origine);
      if (photo) {
        this.garder(photo);
        choisie = true;
      }
    } catch (erreur) {
      if (erreur instanceof AccesPhotoRefuse) this.messagePhoto.set("Accès à l'appareil photo refusé.");
      else console.warn("La photo n'a pas pu être récupérée.", erreur);
    }
    // La feuille s'est fermée en emportant le focus : « Changer la photo » le reprend si une photo est choisie, sinon le bouton d'origine.
    if (choisie) afterNextRender(() => this.changer()?.nativeElement.focus(), { injector: this.injector });
    else if (declencheur instanceof HTMLElement && declencheur.isConnected) declencheur.focus();
  }

  protected retirerPhoto(): void {
    this.messagePhoto.set(null);
    this.liberer();
    // Une nouvelle photo pas encore enregistrée est seule écartée : l'ancienne photo du leurre, s'il en a une, redevient celle d'origine.
    const nouvelleEnAttente = this.photo() instanceof Blob;
    this.photo.set(!nouvelleEnAttente && this.leurre()?.photoUrl ? null : undefined);
  }

  private garder(photo: Blob): void {
    this.liberer();
    this.urlNouvellePhoto.set(URL.createObjectURL(photo));
    this.photo.set(photo);
  }

  private liberer(): void {
    const url = this.urlNouvellePhoto();
    if (url) URL.revokeObjectURL(url);
    this.urlNouvellePhoto.set(null);
  }

  protected fermerConfirmation(): void {
    this.confirmer.set(false);
    // Le bouton « Supprimer » du formulaire reprend le focus.
    queueMicrotask(() => this.boutonSupprimer()?.nativeElement.focus());
  }

  protected confirmerSuppression(): void {
    this.confirmer.set(false);
    this.focusSupprimerApres = true;
    this.supprimer.emit();
  }

  /** Garde le focus clavier dans la confirmation ou la feuille de choix (dialogue modal). */
  protected pieger(evenement: Event): void {
    const boutons = [...(evenement.currentTarget as HTMLElement).querySelectorAll('button')];
    const premier = boutons[0];
    const dernier = boutons[boutons.length - 1];
    const maj = (evenement as KeyboardEvent).shiftKey;
    if (maj && document.activeElement === premier) {
      evenement.preventDefault();
      dernier?.focus();
    } else if (!maj && document.activeElement === dernier) {
      evenement.preventDefault();
      premier?.focus();
    }
  }

  protected enregistrer(evenement: Event): void {
    evenement.preventDefault();
    this.tente.set(true);
    const tailleCm = nombrePositif(this.taille());
    const poidsG = nombrePositif(this.poids());
    if (erreurTexte(this.typeId()) || tailleCm === null || poidsG === null || erreurTexte(this.couleur())) return;
    // Le réseau a pu tomber depuis le choix de la photo : on ne lance pas un envoi qui réessaierait longtemps (PLAN §4).
    if (this.photo() instanceof Blob && !this.sourcePhoto.enLigne()) {
      this.messagePhoto.set('Photo indisponible hors ligne : ajoute-la plus tard.');
      return;
    }
    this.valide.emit({
      typeId: this.typeId(),
      tailleCm,
      poidsG,
      couleur: this.couleur().trim(),
      marque: this.marque().trim(),
      ...(this.photo() === undefined ? {} : { photo: this.photo() }),
    });
  }
}
