import { Location } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

/**
 * « ‹ Libellé » : revient à l'écran précédent (comme le retour du navigateur ou d'Android), ou à `destination` quand elle est donnée
 * (écrans ouverts par une adresse directe, où il n'y a rien avant). 48 × 48 px au moins.
 */
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
  private readonly router = inject(Router);
  readonly libelle = input.required<string>();
  readonly destination = input<string>();

  protected retour(): void {
    const destination = this.destination();
    if (destination) void this.router.navigateByUrl(destination);
    else this.location.back();
  }
}
