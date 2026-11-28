import { Component, input, output } from '@angular/core';

/** L'avis « Ce conseil t'a aidé ? » 👍 / 👎 d'un coup (US 88) ; une fois donné, « Merci pour ton retour ! » prend la place des boutons. */
@Component({
  selector: 'app-avis-coup',
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      min-height: 48px;
    }
    .avis {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--lr-texte-secondaire);
      font-size: 14px;
      line-height: 1.1;
    }
    .question {
      max-width: 110px;
      margin-right: 2px;
    }
    button {
      flex: none;
      width: 48px;
      height: 48px;
      border: 1px solid var(--lr-bordure);
      border-radius: 24px;
      background: var(--lr-surface);
      font-family: inherit;
      font-size: 20px;
      line-height: 1;
    }
    .merci {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 48px;
      margin: 0;
      color: var(--lr-ok);
      font-size: 14px;
      font-weight: 600;
    }
    .merci svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
  template: `
    @if (donne()) {
      <p class="merci" role="status" tabindex="-1" [id]="'merci-' + rang()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Merci pour ton retour !
      </p>
    } @else {
      <div class="avis">
        <span class="question">Ce conseil t'a aidé ?</span>
        <button type="button" aria-label="Oui, ce conseil m'a aidé" (click)="avis.emit(true)">👍</button>
        <button type="button" aria-label="Non, ce conseil ne m'a pas aidé" (click)="avis.emit(false)">👎</button>
      </div>
    }
  `,
})
export class AvisCoupComponent {
  readonly rang = input.required<number>();
  readonly donne = input(false);
  /** `true` = utile (👍), `false` = pas utile (👎). */
  readonly avis = output<boolean>();
}
