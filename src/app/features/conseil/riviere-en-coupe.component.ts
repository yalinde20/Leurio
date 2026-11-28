import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import type { FamilleLeurre } from '../../core/data/catalog.types';
import { PictogrammeFamilleComponent } from '../../shared/pictogramme-famille/pictogramme-famille.component';
import { AvisCoupComponent } from './avis-coup.component';
import { FeuilleConseilComponent } from './feuille-conseil.component';

export type ZoneNage = 'surface' | 'mi-eau' | 'fond';

const ZONES: { id: ZoneNage; libelle: string }[] = [
  { id: 'surface', libelle: 'Surface' },
  { id: 'mi-eau', libelle: 'Mi-eau' },
  { id: 'fond', libelle: 'Fond' },
];

/** Un coup de la rivière : un conseil du moteur, déjà traduit en noms, avec la zone de nage de son type de leurre (contenu). */
export interface CoupRiviere {
  rang: number;
  type: string;
  animation: string;
  couleur: string;
  taille: string | null;
  zone: ZoneNage;
  famille: FamilleLeurre | null;
  /** « Dans ta boîte » ou « Il te manque » ; `null` tant que la boîte n'est pas lue. */
  boite: { manque: boolean; texte: string } | null;
}

/** Ce que la rivière montre : des coups, ou un message à la place (calcul, erreur, aucun conseil, hors des heures légales). */
export type VueRiviere =
  | { type: 'coups'; coups: CoupRiviere[]; explications: string[] }
  | { type: 'message'; texte: string; explications?: string[] }
  | { type: 'hors heures'; titre: string; heures: string; federation?: { nom: string; url: string } };

/** La demande d'ouverture d'un détail : la page décide de la navigation (le lien garde son href). */
export interface DemandeDetail {
  evenement: MouseEvent;
  rang: number;
}

export interface AvisDonne {
  rang: number;
  utile: boolean;
}

/**
 * La « rivière en coupe » de l'écran Conseil (US 295, PLAN §3) : trois zones, Surface, Mi-eau et Fond, de haut en bas.
 * Le coup « 01 » est posé dans la zone de nage de son leurre ; les coups 02 et 03 s'ouvrent dans une feuille.
 */
@Component({
  selector: 'app-riviere-en-coupe',
  imports: [PictogrammeFamilleComponent, AvisCoupComponent, FeuilleConseilComponent],
  styles: `
    :host {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
    }
    .riviere {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      /* Les zones vides se réduisent à leur nom (34 px), celle du coup garde au moins son contenu ; le reste se partage. */
      border-top: 1.5px solid var(--lr-trait);
      color: var(--lr-texte);
    }
    .zone {
      position: relative;
      flex: 1 1 34px;
      min-height: 34px;
      display: flex;
      min-height: 0;
      flex-direction: column;
      justify-content: center;
      gap: 0;
      padding: 0 16px;
      box-sizing: border-box;
    }
    .zone.avec-contenu {
      flex: 1 1 auto;
      min-height: min-content;
      padding: 6px 16px 4px;
    }
    .entete {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-height: 24px;
    }
    .zone.surface {
      background: var(--lr-eau-surface);
    }
    .zone.mi-eau {
      border-top: 1px dashed var(--lr-bordure);
      background: var(--lr-eau-mi);
    }
    .zone.fond {
      border-top: 1px dashed var(--lr-bordure);
      background: var(--lr-eau-fond);
    }
    /* Écran court : les zones vides restent à leur nom, la zone du coup prend tout le reste. */
    @media (max-height: 700px) {
      .zone:not(.avec-contenu) {
        flex-grow: 0;
      }
      .zone.avec-contenu {
        flex-grow: 1;
      }
    }
    .lit {
      flex: 0 0 18px;
      border-top: 1.5px solid var(--lr-trait);
      background: var(--lr-lit);
    }
    .lbl {
      font-family: var(--lr-police-titre);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--lr-texte-secondaire);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      height: 24px;
      padding: 0 8px;
      border-radius: 12px;
      background: var(--lr-sable);
      color: var(--lr-attention);
      font-size: 12px;
      font-weight: 700;
    }
    .coup {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 72px;
      box-sizing: border-box;
      padding: 8px 12px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
      color: var(--lr-texte);
      text-decoration: none;
    }
    .num {
      font-family: var(--lr-police-titre);
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
      color: var(--lr-primaire);
    }
    .picto {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border: 2px solid var(--lr-primaire);
      border-radius: 50%;
      box-sizing: border-box;
    }
    .picto app-pictogramme-famille {
      width: 36px;
      height: 36px;
    }
    .texte {
      flex: 1;
      min-width: 0;
    }
    .nom,
    .det,
    .boite {
      display: block;
    }
    .nom {
      font-family: var(--lr-police-titre);
      font-size: 22px;
      font-weight: 700;
      line-height: 24px;
    }
    .det {
      font-size: 14px;
      line-height: 18px;
      color: var(--lr-texte-secondaire);
    }
    .boite {
      font-size: 13px;
      font-weight: 600;
      color: var(--lr-ok);
    }
    .boite.manque {
      color: var(--lr-primaire);
    }
    .chevron {
      flex: none;
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0 8px;
      min-height: 48px;
    }
    .autres {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      min-height: 48px;
      padding: 0 4px;
      border: 0;
      background: none;
      color: var(--lr-texte);
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
    }
    .autres .chevron {
      width: 16px;
      height: 16px;
    }
    .message {
      align-self: center;
      max-width: 300px;
      margin: 0;
      text-align: center;
      font-size: 15px;
      color: var(--lr-texte-secondaire);
    }
    .message b {
      display: block;
      color: var(--lr-danger);
    }
    .message small {
      display: block;
      font-size: 13px;
    }
    .lien-federation {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      color: var(--lr-primaire);
      font-size: 16px;
      font-weight: 700;
      text-decoration: underline;
    }
    .note-riviere {
      margin: 0 0 4px;
    }
    .note {
      margin: 8px 0 0;
      font-size: 13px;
      line-height: 1.35;
      color: var(--lr-texte-secondaire);
    }
    .actions app-avis-coup {
      margin-left: auto;
    }
    .coup-feuille {
      margin-top: 6px;
    }
    .coup-feuille .picto {
      width: 44px;
      height: 44px;
    }
    .coup-feuille .picto app-pictogramme-famille {
      width: 30px;
      height: 30px;
    }
    .coup-feuille .nom {
      font-size: 20px;
    }
  `,
  template: `
    <section class="riviere" aria-label="Rivière en coupe">
      @for (z of zones; track z.id) {
        <div class="zone" [class]="z.id" [class.avec-contenu]="z.id === zoneContenu()" role="group" [attr.aria-label]="z.libelle">
          @if (z.id === zoneContenu()) {
            <div class="entete">
              <span class="lbl" aria-hidden="true">{{ z.libelle }}</span>
              @if (moinsPrecis()) {
                <span class="badge">Conseil moins précis</span>
              }
            </div>
          } @else {
            <span class="lbl" aria-hidden="true">{{ z.libelle }}</span>
          }
          @if (z.id === 'mi-eau') {
            @switch (vue().type) {
              @case ('message') {
                <p class="message">{{ texteMessage() }}</p>
                @if (explicationsMessage().length > 0) {
                  <p class="note note-riviere" role="note">{{ explicationsMessage().join(' ') }}</p>
                }
              }
              @case ('hors heures') {
                <p class="message" role="alert">
                  <b>{{ horsHeures()?.titre }}</b>
                  {{ horsHeures()?.heures }}
                  <small>À vérifier dans l'arrêté de ton département.</small>
                  @if (horsHeures()?.federation; as f) {
                    <a class="lien-federation" [href]="f.url" target="_blank" rel="noopener">{{ f.nom }} ↗</a>
                  }
                </p>
              }
            }
          }
          @if (premier(); as c) {
            @if (c.zone === z.id) {
              <a class="coup" id="coup-1" [href]="'/conseil/detail/' + c.rang" (click)="detail.emit({ evenement: $event, rang: c.rang })">
                <span class="num">01</span>
                <span class="picto" aria-hidden="true">
                  @if (c.famille; as f) {
                    <app-pictogramme-famille [famille]="f" />
                  }
                </span>
                <span class="texte">
                  <span class="nom">{{ c.type }} · {{ c.animation }}</span>
                  <span class="det">{{ precisions(c) }}</span>
                  @if (c.boite; as b) {
                    <span class="boite" [class.manque]="b.manque">{{ b.texte }}</span>
                  }
                </span>
                <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </a>
              <div class="actions">
                @if (autres().length > 0) {
                  <button #autresCoups id="autres-coups" type="button" class="autres" aria-haspopup="dialog" (click)="autresOuvert.set(true)">
                    {{ libelleAutres() }}
                    <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                }
                <app-avis-coup [rang]="c.rang" [donne]="avisDonnes().has(c.rang)" (avis)="avis.emit({ rang: c.rang, utile: $event })" />
              </div>
              @if (autres().length === 0 && explications().length > 0) {
                <p class="note note-riviere" role="note">{{ explications().join(' ') }}</p>
              }
            }
          }
        </div>
      }
      <div class="lit"></div>
    </section>
    @if (autresOuvert() && autres().length > 0) {
      <app-feuille-conseil [titre]="libelleAutres()" (ferme)="fermerAutres()">
        @for (c of autres(); track c.rang) {
          <a
            class="coup coup-feuille"
            [id]="'coup-' + c.rang"
            [href]="'/conseil/detail/' + c.rang"
            (click)="detail.emit({ evenement: $event, rang: c.rang })"
          >
            <span class="num">{{ c.rang < 10 ? '0' + c.rang : c.rang }}</span>
            <span class="picto" aria-hidden="true">
              @if (c.famille; as f) {
                <app-pictogramme-famille [famille]="f" />
              }
            </span>
            <span class="texte">
              <span class="nom">{{ c.type }} · {{ c.animation }}</span>
              <span class="det">{{ precisions(c) }}</span>
            </span>
            <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </a>
          <app-avis-coup [rang]="c.rang" [donne]="avisDonnes().has(c.rang)" (avis)="avis.emit({ rang: c.rang, utile: $event })" />
        }
        @if (explications().length > 0) {
          <p class="note" role="note">{{ explications().join(' ') }}</p>
        }
      </app-feuille-conseil>
    }
  `,
})
export class RiviereEnCoupeComponent {
  readonly vue = input.required<VueRiviere>();
  readonly moinsPrecis = input(false);
  readonly avisDonnes = input<ReadonlySet<number>>(new Set());
  readonly detail = output<DemandeDetail>();
  readonly avis = output<AvisDonne>();

  protected readonly zones = ZONES;
  protected readonly autresOuvert = signal(false);
  private readonly boutonAutres = viewChild<ElementRef<HTMLButtonElement>>('autresCoups');

  private readonly coups = computed(() => {
    const v = this.vue();
    return v.type === 'coups' ? v.coups : [];
  });
  protected readonly premier = computed(() => this.coups()[0] ?? null);
  protected readonly autres = computed(() => this.coups().slice(1));
  protected readonly explications = computed(() => {
    const v = this.vue();
    return v.type === 'coups' ? v.explications : [];
  });
  protected readonly libelleAutres = computed(() => {
    const n = this.autres().length;
    return n === 1 ? '1 autre coup' : `${n} autres coups`;
  });
  /** La zone qui porte le contenu (coup 01, message ou alerte) : elle prend la place, les autres se réduisent à leur nom. */
  protected readonly zoneContenu = computed<ZoneNage>(() => this.premier()?.zone ?? 'mi-eau');
  protected readonly explicationsMessage = computed(() => {
    const v = this.vue();
    return v.type === 'message' ? (v.explications ?? []) : [];
  });

  protected texteMessage(): string {
    const v = this.vue();
    return v.type === 'message' ? v.texte : '';
  }

  protected horsHeures(): { titre: string; heures: string; federation?: { nom: string; url: string } } | null {
    const v = this.vue();
    return v.type === 'hors heures' ? v : null;
  }

  protected precisions(c: CoupRiviere): string {
    return [c.taille, c.couleur].filter((x) => x).join(' · ');
  }

  protected fermerAutres(): void {
    this.autresOuvert.set(false);
    queueMicrotask(() => this.boutonAutres()?.nativeElement.focus());
  }
}
