import { Component, input } from '@angular/core';
import { LigneBoite } from './conseil-format';

/** La ligne « Dans ta boîte », « À la place, dans ta boîte » ou « Il te manque » d'un conseil (US 105), sur la carte et dans le détail. */
@Component({
  selector: 'app-ligne-boite',
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 10px 0 0;
      padding: 10px 12px;
      border: 1px solid transparent;
      border-radius: 12px;
      background: var(--lr-sable);
      color: var(--lr-texte);
      font-size: 16px;
      line-height: 1.35;
    }
    :host(.manque) {
      border: 1px dashed var(--lr-accent);
      background: transparent;
    }
    svg {
      flex: none;
      width: 20px;
      height: 20px;
      margin-top: 1px;
      color: var(--lr-primaire);
    }
    :host(.manque) svg {
      color: var(--lr-accent);
    }
    b {
      font-weight: 700;
    }
  `,
  host: { '[class.manque]': 'ligne().manque' },
  template: `
    @if (ligne().manque) {
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    } @else {
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="8" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path
          d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M3 13h18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
      </svg>
    }
    <span
      ><b>{{ ligne().libelle }}</b> {{ ligne().texte }}</span
    >
  `,
})
export class LigneBoiteComponent {
  readonly ligne = input.required<LigneBoite>();
}
