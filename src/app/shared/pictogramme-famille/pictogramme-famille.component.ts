import { Component, effect, ElementRef, inject, input, ViewEncapsulation, viewChild } from '@angular/core';
import { CatalogService, FamilleLeurre } from '../../core/data/catalog.service';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Formes que le pictogramme d'une famille peut contenir ; tout le reste du fichier est ignoré. */
const FORMES = new Set(['path', 'circle', 'ellipse', 'line', 'rect', 'polyline', 'polygon']);
/** Attributs de géométrie recopiés ; ni style, ni couleur, ni script : les couleurs viennent des tokens du thème. */
const ATTRIBUTS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform', 'data-point']);

/**
 * Pictogramme d'une famille de leurres (US 293), lu depuis le SVG que référence lure-families.json.
 * Le SVG est parsé puis reconstruit par `createElementNS` en ne gardant que des formes et attributs de géométrie connus :
 * aucun HTML n'est injecté, donc pas de contournement du DomSanitizer. Le trait suit `--lr-trait`, le point (`data-point`) `--lr-accent`.
 */
@Component({
  selector: 'app-pictogramme-famille',
  encapsulation: ViewEncapsulation.None,
  styles: `
    app-pictogramme-famille {
      display: inline-flex;
    }
    app-pictogramme-famille svg {
      fill: none;
      stroke: var(--lr-trait);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    app-pictogramme-famille svg [data-point] {
      fill: var(--lr-accent);
      stroke: none;
    }
  `,
  template: `<svg #svg viewBox="0 0 64 64" width="100%" height="100%" role="img" [attr.aria-label]="famille().nom"></svg>`,
})
export class PictogrammeFamilleComponent {
  private readonly catalogue = inject(CatalogService);
  readonly famille = input.required<FamilleLeurre>();
  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private chargement = 0;

  constructor() {
    effect(() => {
      const chemin = this.famille().pictogramme;
      const svg = this.svg().nativeElement;
      const numero = ++this.chargement;
      this.lire(chemin).then(
        (formes) => {
          if (numero === this.chargement) svg.replaceChildren(...formes);
        },
        // Fichier illisible : le pictogramme reste vide, le nom accessible de la famille demeure.
        () => undefined,
      );
    });
  }

  private async lire(chemin: string): Promise<Element[]> {
    const texte = await this.catalogue.pictogramme(chemin);
    const document = new DOMParser().parseFromString(texte, 'image/svg+xml');
    return [...document.querySelectorAll('*')]
      .filter((e) => FORMES.has(e.localName))
      .map((source) => {
        const forme = globalThis.document.createElementNS(SVG_NS, source.localName);
        for (const { name, value } of [...source.attributes]) if (ATTRIBUTS.has(name)) forme.setAttribute(name, value);
        return forme;
      });
  }
}
