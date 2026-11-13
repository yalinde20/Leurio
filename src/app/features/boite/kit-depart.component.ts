import { AfterViewInit, Component, computed, ElementRef, inject, OnInit, output, signal, viewChild } from '@angular/core';
import { CatalogService, ElementKit } from '../../core/data/catalog.service';
import { TackleBoxService } from '../../core/data/tackle-box.service';

/**
 * Le kit de départ conseillé (US 103) : une feuille plein écran dans la page (pas d'ion-modal), comme le formulaire de leurre.
 * Le kit et les noms de types viennent du contenu ; un leurre du kit est possédé quand la boîte contient un leurre du même type.
 */
@Component({
  selector: 'app-kit-depart',
  host: { '(keydown.escape)': 'fermer.emit()' },
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: block;
    }
    .feuille {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      outline: none;
      background: var(--lr-fond);
      color: var(--lr-texte);
    }
    .barre {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: max(0px, env(safe-area-inset-top)) 8px 0;
      border-bottom: 1px solid var(--lr-bordure);
      background: var(--lr-surface);
    }
    .barre h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
    }
    .fermer {
      min-width: 80px;
      min-height: 48px;
      padding: 0 8px;
      border: none;
      background: transparent;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 17px;
      text-align: left;
    }
    .cale {
      min-width: 80px;
    }
    .corps {
      flex: 1;
      overflow-y: auto;
      padding: 16px 16px max(16px, env(safe-area-inset-bottom));
    }
    .corps p {
      margin: 0 0 12px;
      font-size: 16px;
    }
    .intro {
      color: var(--lr-texte-secondaire);
    }
    .corps .chargement {
      padding: 8px 0;
      margin: 0;
      color: var(--lr-texte-secondaire);
    }
    .bilan {
      font-weight: 600;
    }
    .erreur {
      font-weight: 600;
      color: var(--lr-danger);
    }
    ul {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      padding: 12px 16px;
      border: 1px solid var(--lr-bordure);
      border-radius: 16px;
      background: var(--lr-surface);
    }
    .tete {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }
    .num {
      margin-right: 6px;
      font-weight: 600;
      color: var(--lr-texte-secondaire);
    }
    li p {
      margin: 6px 0 0;
      line-height: 1.35;
    }
    .possede {
      flex: none;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--lr-primaire);
      color: var(--lr-sur-primaire);
      font-size: 14px;
      font-weight: 600;
    }
  `,
  template: `
    <div #dialogue tabindex="-1" class="feuille" role="dialog" aria-modal="true" aria-labelledby="titre-kit">
      <div class="barre">
        <button type="button" class="fermer" (click)="fermer.emit()">Fermer</button>
        <h2 id="titre-kit">Kit de départ conseillé</h2>
        <span class="cale"></span>
      </div>
      <div class="corps">
        @if (illisible()) {
          <p class="erreur" role="alert">Impossible d'afficher le kit de départ. Réessaie plus tard.</p>
        } @else if (kit(); as elements) {
          @if (boite.leurres() === null) {
            <p class="chargement">Chargement du kit…</p>
          } @else {
          <p class="intro">Les leurres à acheter en premier, dans l’ordre.</p>
          <p class="bilan">{{ nombrePossedes() }} sur {{ elements.length }} dans ta boîte</p>
          <ul>
            @for (element of elements; track $index) {
              <li>
                <div class="tete">
                  <h3>
                    <span class="num">{{ $index + 1 }}.</span>{{ nomDuType(element.typeId) }}
                  </h3>
                  @if (possede(element)) {
                    <span class="possede"><span aria-hidden="true">✓ </span><span>Déjà dans ta boîte</span></span>
                  }
                </div>
                <p>{{ element.raison }}</p>
              </li>
            }
          </ul>
          }
        } @else {
          <p class="chargement">Chargement du kit…</p>
        }
      </div>
    </div>
  `,
})
export class KitDepartComponent implements OnInit, AfterViewInit {
  private readonly catalogue = inject(CatalogService);
  protected readonly boite = inject(TackleBoxService);

  readonly fermer = output<void>();

  protected readonly kit = signal<ElementKit[] | null>(null);
  protected readonly illisible = signal(false);
  private readonly noms = signal(new Map<string, string>());
  private readonly typesPossedes = computed(() => new Set((this.boite.leurres() ?? []).map((l) => l.typeId)));
  protected readonly nombrePossedes = computed(() => (this.kit() ?? []).filter((e) => this.possede(e)).length);

  private readonly dialogue = viewChild.required<ElementRef<HTMLElement>>('dialogue');

  async ngOnInit(): Promise<void> {
    try {
      // Types illisibles : l'identifiant du type s'affiche à la place du nom.
      const types = await this.catalogue.typesDeLeurres().catch(() => []);
      this.noms.set(new Map(types.map((t) => [t.id, t.nom])));
      this.kit.set(await this.catalogue.kitDeDepart());
    } catch {
      this.illisible.set(true);
    }
  }

  ngAfterViewInit(): void {
    this.dialogue().nativeElement.focus();
  }

  protected possede(element: ElementKit): boolean {
    return this.typesPossedes().has(element.typeId);
  }

  protected nomDuType(id: string): string {
    return this.noms().get(id) ?? id;
  }
}
