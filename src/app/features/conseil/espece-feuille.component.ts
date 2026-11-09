import { AfterViewInit, Component, ElementRef, input, output, viewChild } from '@angular/core';

/** Une ligne de la feuille : `code` vaut `null` pour « Toutes les espèces ». */
export interface ChoixEspece {
  code: string | null;
  nom: string;
}

/**
 * La feuille « Espèce visée » (US 83) : un dialogue en bas de l'écran, dans la page (pas d'ion-modal).
 * Elle ne connaît pas le contenu : la page lui donne les lignes, dans l'ordre à afficher.
 */
@Component({
  selector: 'app-espece-feuille',
  host: { '(keydown.escape)': 'annuler.emit()' },
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: flex;
      align-items: flex-end;
      background: var(--lr-voile);
    }
    .feuille {
      width: 100%;
      box-sizing: border-box;
      max-height: 85%;
      overflow-y: auto;
      padding: 8px 16px max(16px, env(safe-area-inset-bottom));
      border-top: 1px solid var(--lr-bordure);
      border-radius: 16px 16px 0 0;
      outline: none;
      background: var(--lr-surface);
      color: var(--lr-texte);
    }
    .poignee {
      width: 36px;
      height: 5px;
      margin: 0 auto 12px;
      border-radius: 3px;
      background: var(--lr-bordure);
    }
    h2 {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 700;
    }
    .option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 48px;
      padding: 0 4px;
      border: none;
      border-top: 1px solid var(--lr-bordure);
      background: transparent;
      color: inherit;
      font-family: inherit;
      font-size: 17px;
      text-align: left;
    }
    .option:first-child {
      border-top: none;
    }
    .option[aria-checked='true'] {
      font-weight: 700;
      color: var(--lr-primaire);
    }
    .annuler {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 48px;
      margin-top: 12px;
      border: 1px solid var(--lr-primaire);
      border-radius: 12px;
      background: transparent;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 17px;
      font-weight: 600;
    }
  `,
  template: `
    <div #dialogue tabindex="-1" class="feuille" role="dialog" aria-modal="true" aria-labelledby="titre-espece">
      <div class="poignee"></div>
      <h2 id="titre-espece">Espèce visée</h2>
      <div role="radiogroup" aria-labelledby="titre-espece">
        @for (choix of choix(); track choix.code) {
          <button
            type="button"
            role="radio"
            class="option"
            [attr.aria-checked]="choix.code === choisie()"
            (click)="choisir.emit(choix.code)"
          >
            <span>{{ choix.nom }}</span>
            <span aria-hidden="true">{{ choix.code === choisie() ? '✓' : '' }}</span>
          </button>
        }
      </div>
      <button type="button" class="annuler" (click)="annuler.emit()">Annuler</button>
    </div>
  `,
})
export class EspeceFeuilleComponent implements AfterViewInit {
  readonly choix = input.required<ChoixEspece[]>();
  /** Code de l'espèce choisie, `null` pour « Toutes les espèces ». */
  readonly choisie = input<string | null>(null);
  readonly choisir = output<string | null>();
  readonly annuler = output<void>();

  private readonly dialogue = viewChild.required<ElementRef<HTMLElement>>('dialogue');

  ngAfterViewInit(): void {
    this.dialogue().nativeElement.focus();
  }
}
