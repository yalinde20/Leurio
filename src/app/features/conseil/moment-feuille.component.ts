import { Component, ElementRef, afterNextRender, inject, input, OnInit, output, signal } from '@angular/core';
import { HEURES_MOMENT, JOURS_MOMENT, JourMoment, momentDe, momentValide } from './moment-format';

const MESSAGE_MOMENT_REFUSE = 'Choisis un moment dans les 48 h à venir.';

/** La feuille « Moment du conseil » : « Maintenant », ou un jour et une heure dans les 48 h à venir. */
@Component({
  selector: 'app-moment-feuille',
  styles: `
    .voile {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      background: var(--lr-voile);
    }
    .feuille {
      max-height: 100%;
      overflow-y: auto;
      padding: 8px 16px max(16px, env(safe-area-inset-bottom));
      border-top: 1px solid var(--lr-bordure);
      border-radius: 16px 16px 0 0;
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
    .feuille h2 {
      margin: 0 0 12px;
      font-size: 20px;
      font-weight: 700;
    }
    .btn-sec,
    .btn-prim {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 48px;
      border-radius: 12px;
      font-size: 17px;
      font-weight: 600;
      font-family: inherit;
    }
    .btn-sec {
      border: 1px solid var(--lr-primaire);
      background: transparent;
      color: var(--lr-primaire);
    }
    .btn-prim {
      border: none;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
    }
    .lbl {
      display: block;
      margin: 16px 0 6px;
      font-size: 15px;
      font-weight: 600;
    }
    .segments {
      display: flex;
      overflow: hidden;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
    }
    .segment {
      flex: 1;
      min-height: 48px;
      border: none;
      border-left: 1px solid var(--lr-bordure);
      background: transparent;
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 15px;
    }
    .segment:first-child {
      border-left: none;
    }
    .segment[aria-checked='true'] {
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-weight: 700;
    }
    .heure {
      width: 100%;
      min-height: 48px;
      padding: 0 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 12px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 17px;
      font-weight: 600;
    }
    .erreur {
      margin: 12px 0 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--lr-danger);
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }
  `,
  template: `
    <div class="voile">
      <div
        class="feuille"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-moment"
        (keydown.escape)="ferme.emit()"
      >
        <div class="poignee"></div>
        <h2 id="titre-moment" tabindex="-1">Moment du conseil</h2>
        <button type="button" class="btn-sec" (click)="maintenant.emit()">Maintenant</button>
        <span class="lbl" id="lbl-jour">Jour</span>
        <div class="segments" role="radiogroup" aria-labelledby="lbl-jour">
          @for (j of jours; track j.id) {
            <button
              type="button"
              role="radio"
              class="segment"
              [attr.aria-checked]="jour() === j.id"
              (click)="jour.set(j.id)"
            >
              {{ j.libelle }}
            </button>
          }
        </div>
        <label class="lbl" for="heure-moment">Heure</label>
        <select
          id="heure-moment"
          class="heure"
          (change)="heure.set(+$any($event.target).value)"
        >
          @for (h of heures; track h) {
            <option [value]="h" [selected]="h === heure()">{{ h }} h</option>
          }
        </select>
        @if (erreur()) {
          <p class="erreur" role="alert">{{ erreur() }}</p>
        }
        <div class="actions">
          <button type="button" class="btn-sec" (click)="ferme.emit()">Annuler</button>
          <button type="button" class="btn-prim" (click)="valider()">Valider</button>
        </div>
      </div>
    </div>
  `,
})
export class MomentFeuilleComponent implements OnInit {
  readonly jourInitial = input<JourMoment>('aujourdhui');
  readonly heureInitiale = input(0);
  /** « Maintenant » : l'instant présent. */
  readonly maintenant = output<void>();
  /** Un moment valide : strictement futur et dans les 48 h. */
  readonly valide = output<Date>();
  /** Annuler ou Échap. */
  readonly ferme = output<void>();

  protected readonly jours = JOURS_MOMENT;
  protected readonly heures = HEURES_MOMENT;
  protected readonly jour = signal<JourMoment>('aujourdhui');
  protected readonly heure = signal(0);
  protected readonly erreur = signal<string | null>(null);

  constructor() {
    const hote = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // Les entrées sont lues une fois : le brouillon est ensuite à la feuille.
    afterNextRender(() => hote.querySelector<HTMLElement>('#titre-moment')?.focus());
  }

  ngOnInit(): void {
    this.jour.set(this.jourInitial());
    this.heure.set(this.heureInitiale());
  }

  protected valider(): void {
    const maintenant = new Date();
    const date = momentDe(this.jour(), this.heure(), maintenant);
    if (!momentValide(date, maintenant)) {
      this.erreur.set(MESSAGE_MOMENT_REFUSE);
      return;
    }
    this.valide.emit(date);
  }
}
