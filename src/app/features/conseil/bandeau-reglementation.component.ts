import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Espece, Federation } from '../../core/data/catalog.types';
import type { Categorie } from '../../core/regulation/calendar';
import { composerReglementation } from './bandeau-reglementation-format';

/** Bandeau « Réglementation » de l'écran Conseil (US 80, PLAN §6) : tout est calculé en local, sans réseau. */
@Component({
  selector: 'app-bandeau-reglementation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      margin-top: 12px;
    }
    .carte {
      background: var(--lr-surface);
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      padding: 16px;
      color: var(--lr-texte);
    }
    h3 {
      margin: 0 0 12px;
      font-size: 20px;
      font-weight: 700;
    }
    dl {
      margin: 0;
    }
    .ligne {
      padding: 10px 0;
      border-top: 1px solid var(--lr-bordure);
    }
    .ligne:first-child {
      border-top: none;
      padding-top: 0;
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
    .mention {
      display: block;
      color: var(--lr-texte-secondaire);
      font-size: 14px;
    }
    .lien-federation {
      display: flex;
      align-items: center;
      min-height: 48px;
      font-size: 15px;
      font-weight: 600;
      color: var(--lr-primaire);
      text-decoration: underline;
    }
  `,
  template: `
    <section class="carte">
      <h3>Réglementation</h3>
      <dl>
        @for (l of lignes(); track $index) {
          <div class="ligne">
            @if (l.alerte) {
              <span class="alerte">{{ l.valeur }}</span>
            } @else {
              <dt>{{ l.libelle }} :</dt>
              &ngsp;
              <dd [class.ferme]="l.ferme">{{ l.valeur }}</dd>
            }
          </div>
        }
        <div class="ligne">
          <span class="mention">À vérifier dans l'arrêté de ton département</span>
          @if (federation(); as f) {
            <a class="lien-federation" [href]="f.url" target="_blank" rel="noopener"
              >Voir la fédération de ton département</a
            >
          }
        </div>
      </dl>
    </section>
  `,
})
export class BandeauReglementationComponent {
  readonly categorie = input<Categorie | null>(null);
  readonly espece = input<Espece | null>(null);
  /** Les fiches du contenu : « Toutes les espèces » (`espece` nul) en tire les alertes de chaque espèce. */
  readonly especes = input<readonly Espece[]>([]);
  readonly date = input<Date>(new Date());
  readonly federation = input<Federation | undefined>(undefined);

  protected readonly lignes = computed(() =>
    composerReglementation(this.categorie(), this.espece(), this.date(), this.especes()),
  );
}
