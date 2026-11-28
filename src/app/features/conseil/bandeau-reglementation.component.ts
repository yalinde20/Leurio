import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Espece, Federation } from '../../core/data/catalog.types';
import type { Categorie } from '../../core/regulation/calendar';
import { UnitesService } from '../../shared/unites.service';
import { composerReglementation } from './bandeau-reglementation-format';

/** Contenu de la feuille « Réglementation » de l'écran Conseil (US 80, US 295, PLAN §6) : tout est calculé en local, sans réseau. */
@Component({
  selector: 'app-bandeau-reglementation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      background: var(--lr-surface);
      color: var(--lr-texte);
    }
    dl {
      margin: 0;
    }
    .ligne {
      min-height: 48px;
      box-sizing: border-box;
      padding: 10px 0;
      border-top: 1px solid var(--lr-bordure);
    }
    .ligne:first-child {
      border-top: none;
    }
    dt,
    dd {
      display: inline;
      margin: 0;
      font-size: 16px;
    }
    dt {
      font-weight: 600;
    }
    .ferme,
    .alerte {
      color: var(--lr-danger);
      font-weight: 700;
    }
    .alerte {
      display: block;
      font-size: 16px;
    }
    .ouvert {
      color: var(--lr-ok);
      font-weight: 700;
    }
    .mention {
      display: block;
      color: var(--lr-texte-secondaire);
      font-size: 14px;
    }
    .lien-federation {
      display: flex;
      align-items: center;
      min-height: 48px;
      font-size: 16px;
      font-weight: 700;
      color: var(--lr-primaire);
      text-decoration: underline;
    }
  `,
  template: `
    <dl>
      @for (l of lignes(); track $index) {
        <div class="ligne">
          @if (l.alerte) {
            <span class="alerte">{{ l.valeur }}</span>
          } @else {
            <dt>{{ l.libelle }} :</dt>
            &ngsp;
            <dd [class.ferme]="l.ferme" [class.ouvert]="l.valeur === 'Ouvert'">{{ l.valeur }}</dd>
          }
        </div>
      }
      @if (heuresLegales(); as heures) {
        <div class="ligne">
          <dt>Heures légales :</dt>
          &ngsp;
          <dd>{{ heures }}</dd>
        </div>
      }
      <div class="ligne">
        <span class="mention">À vérifier dans l'arrêté de ton département</span>
        @if (federation(); as f) {
          <a class="lien-federation" [href]="f.url" target="_blank" rel="noopener">{{ f.nom }} ↗</a>
        }
      </div>
    </dl>
  `,
})
export class BandeauReglementationComponent {
  readonly categorie = input<Categorie | null>(null);
  readonly espece = input<Espece | null>(null);
  /** Les fiches du contenu : « Toutes les espèces » (`espece` nul) en tire les alertes de chaque espèce. */
  readonly especes = input<readonly Espece[]>([]);
  readonly date = input<Date>(new Date());
  readonly federation = input<Federation | undefined>(undefined);
  /** « 7 h 02 – 18 h 31 », si la page le donne. */
  readonly heuresLegales = input<string | null>(null);

  private readonly unites = inject(UnitesService);

  protected readonly lignes = computed(() =>
    composerReglementation(this.categorie(), this.espece(), this.date(), this.especes(), this.unites.choix()),
  );
}
