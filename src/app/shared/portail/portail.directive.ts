import { afterNextRender, Directive, ElementRef, inject, OnDestroy } from '@angular/core';

/**
 * Place l'élément sous `document.body` : un voile `position: fixed` couvre alors toute la fenêtre, onglets compris
 * (`.ion-page` a `contain: layout`, ce qui rattache sinon le `fixed` à la page). Les liaisons Angular et les styles
 * du composant (attributs d'encapsulation) continuent de s'appliquer ; l'élément est retiré avec sa vue.
 */
@Directive({ selector: '[appPortail]' })
export class PortailDirective implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    // Après l'insertion de la vue : déplacer l'élément plus tôt le remettrait à sa place d'origine.
    afterNextRender(() => {
      if (this.element.parentNode === document.body) return;
      // Déplacer un nœud lui fait perdre le focus : on le rend à l'élément qui l'avait.
      const focus = document.activeElement instanceof HTMLElement && this.element.contains(document.activeElement) ? document.activeElement : null;
      document.body.appendChild(this.element);
      focus?.focus();
    });
  }

  ngOnDestroy(): void {
    this.element.remove();
  }
}
