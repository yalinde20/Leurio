import { AfterViewInit, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { SaisieLeurre } from '../../core/data/tackle-box.service';
import { erreurNombre, erreurTexte, nombrePositif } from './saisie-leurre';

/** Un type de leurre proposé dans « Type » : le contenu le fournit, la page le transmet. */
export interface ChoixType {
  id: string;
  nom: string;
}

/**
 * Le formulaire « Ajouter un leurre » (US 99) : une feuille plein écran dans la page (pas d'ion-modal), comme les feuilles des US 83 et 87.
 * Il valide la saisie et rend un leurre prêt à écrire ; l'enregistrement est l'affaire de la page.
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
      padding: max(0px, env(safe-area-inset-top)) 8px 0;
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
    label {
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
        <h2 id="titre-leurre">Ajouter un leurre</h2>
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
            <option value="">Choisis un type</option>
            @for (type of types(); track type.id) {
              <option [value]="type.id">{{ type.nom }}</option>
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
            (input)="marque.set($any($event.target).value)"
            (change)="marque.set($any($event.target).value)"
          />
        </div>
        @if (echec()) {
          <p class="erreur" role="alert">Impossible d'enregistrer le leurre. Réessaie.</p>
        }
        <button type="submit" class="enregistrer" [disabled]="enCours()" [attr.aria-busy]="enCours() ? 'true' : null">Enregistrer</button>
      </form>
    </div>
  `,
})
export class LeurreFormulaireComponent implements AfterViewInit {
  readonly types = input.required<ChoixType[]>();
  /** Affiche un message d'échec d'enregistrement (la page le pilote). */
  readonly echec = input(false);
  /** Un enregistrement est en cours : le bouton est désactivé pour éviter un double ajout. */
  readonly enCours = input(false);
  readonly valide = output<SaisieLeurre>();
  readonly annuler = output<void>();

  protected readonly typeId = signal('');
  protected readonly taille = signal('');
  protected readonly poids = signal('');
  protected readonly couleur = signal('');
  protected readonly marque = signal('');
  /** Les erreurs n'apparaissent qu'après un premier essai d'enregistrement. */
  private readonly tente = signal(false);

  protected readonly erreurType = computed(() => (this.tente() ? erreurTexte(this.typeId()) : null));
  protected readonly erreurTaille = computed(() => (this.tente() ? erreurNombre(this.taille()) : null));
  protected readonly erreurPoids = computed(() => (this.tente() ? erreurNombre(this.poids()) : null));
  protected readonly erreurCouleur = computed(() => (this.tente() ? erreurTexte(this.couleur()) : null));

  private readonly dialogue = viewChild.required<ElementRef<HTMLElement>>('dialogue');

  ngAfterViewInit(): void {
    this.dialogue().nativeElement.focus();
  }

  protected enregistrer(evenement: Event): void {
    evenement.preventDefault();
    this.tente.set(true);
    const tailleCm = nombrePositif(this.taille());
    const poidsG = nombrePositif(this.poids());
    if (erreurTexte(this.typeId()) || tailleCm === null || poidsG === null || erreurTexte(this.couleur())) return;
    this.valide.emit({
      typeId: this.typeId(),
      tailleCm,
      poidsG,
      couleur: this.couleur().trim(),
      marque: this.marque().trim(),
    });
  }
}
