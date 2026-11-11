import { AfterViewInit, Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
import type { SpotEnregistre } from '../../core/data/spots.service';

/** Où en est la lecture des spots enregistrés. */
export type EtatSpots = 'chargement' | 'pret' | 'erreur';

/**
 * La feuille « Lieu du conseil » (US 87) : un dialogue en bas de l'écran, dans la page (pas d'ion-modal).
 * « Ma position » est toujours proposée en premier, puis les spots par ordre alphabétique.
 * Elle ne lit rien : la page lui donne les spots et l'état de leur lecture.
 */
@Component({
  selector: 'app-lieu-feuille',
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
    .message {
      margin: 0;
      padding: 12px 4px;
      border-top: 1px solid var(--lr-bordure);
      font-size: 16px;
      color: var(--lr-texte-secondaire);
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
    <div #dialogue tabindex="-1" class="feuille" role="dialog" aria-modal="true" aria-labelledby="titre-lieu">
      <div class="poignee"></div>
      <h2 id="titre-lieu">Lieu du conseil</h2>
      <div role="radiogroup" aria-labelledby="titre-lieu">
        <button
          type="button"
          role="radio"
          class="option"
          [attr.aria-checked]="choisi() === null"
          (click)="choisir.emit(null)"
        >
          <span>Ma position</span>
          <span aria-hidden="true">{{ choisi() === null ? '✓' : '' }}</span>
        </button>
        @for (spot of spotsTries(); track spot.id) {
          <button
            type="button"
            role="radio"
            class="option"
            [attr.aria-checked]="spot.id === choisi()"
            (click)="choisir.emit(spot)"
          >
            <span>{{ spot.nom }}</span>
            <span aria-hidden="true">{{ spot.id === choisi() ? '✓' : '' }}</span>
          </button>
        }
      </div>
      @switch (etat()) {
        @case ('chargement') {
          <p class="message">Chargement des spots…</p>
        }
        @case ('erreur') {
          <p class="message">Tes spots ne sont pas disponibles pour le moment.</p>
        }
        @default {
          @if (spots().length === 0) {
            <p class="message">Aucun spot enregistré</p>
          }
        }
      }
      <button type="button" class="annuler" (click)="annuler.emit()">Annuler</button>
    </div>
  `,
})
export class LieuFeuilleComponent implements AfterViewInit {
  readonly spots = input.required<SpotEnregistre[]>();
  readonly etat = input<EtatSpots>('pret');
  /** Identifiant du spot choisi, `null` pour « Ma position ». */
  readonly choisi = input<string | null>(null);
  /** `null` pour « Ma position ». */
  readonly choisir = output<SpotEnregistre | null>();
  readonly annuler = output<void>();

  protected readonly spotsTries = computed(() =>
    [...this.spots()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
  );

  private readonly dialogue = viewChild.required<ElementRef<HTMLElement>>('dialogue');

  ngAfterViewInit(): void {
    this.dialogue().nativeElement.focus();
  }
}
