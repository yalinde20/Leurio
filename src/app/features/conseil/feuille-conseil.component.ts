import { AfterViewInit, Component, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';

/**
 * Feuille du bas de l'écran Conseil (US 295) : un dialogue dans la page (pas d'ion-modal), fermé par « Fermer »,
 * la touche Échap ou un tap sur le voile. Le contenu est projeté ; le titre nomme le dialogue.
 */
@Component({
  selector: 'app-feuille-conseil',
  host: { '(keydown.escape)': 'ferme.emit()', '(click)': 'surVoile($event)', '[style.padding-bottom.px]': 'clavier()' },
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
      padding: 10px 20px max(16px, env(safe-area-inset-bottom));
      border-radius: 24px 24px 0 0;
      outline: none;
      background: var(--lr-surface);
      color: var(--lr-texte);
    }
    .poignee {
      width: 40px;
      height: 5px;
      margin: 0 auto 8px;
      border-radius: 3px;
      background: var(--lr-bordure);
    }
    h2 {
      margin: 0 0 6px;
      font-family: var(--lr-police-titre);
      font-size: 24px;
      font-weight: 700;
    }
    .fermer {
      display: block;
      min-width: 48px;
      min-height: 48px;
      margin: 4px 0 0 auto;
      padding: 0 8px;
      border: 0;
      background: none;
      color: var(--lr-primaire);
      font-family: inherit;
      font-size: 16px;
      font-weight: 600;
    }
  `,
  template: `
    <div #dialogue tabindex="-1" class="feuille" role="dialog" aria-modal="true" [attr.aria-label]="titre()">
      <div class="poignee"></div>
      <h2>{{ titre() }}</h2>
      <ng-content />
      <button type="button" class="fermer" (click)="ferme.emit()">Fermer</button>
    </div>
  `,
})
export class FeuilleConseilComponent implements AfterViewInit {
  readonly titre = input.required<string>();
  readonly ferme = output<void>();

  /**
   * Hauteur du clavier : sur iOS (Safari, PWA, Capacitor sans plugin Clavier) le clavier recouvre la page sans la redimensionner,
   * mais `visualViewport` rétrécit. La feuille remonte de cette hauteur pour que « Valider » ne soit pas recouvert.
   */
  protected readonly clavier = signal(0);

  constructor() {
    const vue = window.visualViewport;
    if (!vue) return;
    // Pincer pour zoomer change aussi `visualViewport` : ce n'est pas le clavier.
    const mesurer = () => this.clavier.set(vue.scale !== 1 ? 0 : Math.max(0, Math.round(window.innerHeight - vue.height - vue.offsetTop)));
    vue.addEventListener('resize', mesurer);
    vue.addEventListener('scroll', mesurer);
    inject(DestroyRef).onDestroy(() => {
      vue.removeEventListener('resize', mesurer);
      vue.removeEventListener('scroll', mesurer);
    });
    mesurer();
  }

  private readonly dialogue = viewChild.required<ElementRef<HTMLElement>>('dialogue');

  /** Un tap sur le voile (hors de la feuille) ferme la feuille. */
  protected surVoile(evenement: MouseEvent): void {
    if (evenement.target === evenement.currentTarget) this.ferme.emit();
  }

  ngAfterViewInit(): void {
    const dialogue = this.dialogue().nativeElement;
    // Un champ de la feuille qui a déjà pris le focus le garde.
    if (!dialogue.contains(document.activeElement)) dialogue.focus();
  }
}
