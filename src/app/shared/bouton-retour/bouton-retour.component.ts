import { Location } from '@angular/common';
import { Component, inject, input } from '@angular/core';

/** « ‹ Libellé » : revient à l'écran précédent (comme le retour du navigateur ou d'Android). 48 × 48 px au moins. */
@Component({
  selector: 'app-bouton-retour',
  styles: `
    button {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 48px;
      min-height: 48px;
      padding: 0 8px;
      border: none;
      background: transparent;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 17px;
    }
    .chevron {
      font-size: 28px;
      line-height: 1;
    }
  `,
  template: `
    <button type="button" (click)="retour()">
      <span class="chevron" aria-hidden="true">‹</span>{{ libelle() }}
    </button>
  `,
})
export class BoutonRetourComponent {
  private readonly location = inject(Location);
  readonly libelle = input.required<string>();

  protected retour(): void {
    this.location.back();
  }
}
