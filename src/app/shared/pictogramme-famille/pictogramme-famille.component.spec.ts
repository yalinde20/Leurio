// US 293 : le pictogramme d'une famille est un SVG en ligne, reconstruit depuis le fichier que référence le contenu.
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CatalogService, FamilleLeurre } from '../../core/data/catalog.service';
import { PictogrammeFamilleComponent } from './pictogramme-famille.component';

const FAMILLE: FamilleLeurre = { id: 'souples', nom: 'Souples', pictogramme: 'pictogrammes/souples.svg', sources: ['test'], dateVerif: '2026-11-12' };

@Component({ imports: [PictogrammeFamilleComponent], template: `<app-pictogramme-famille [famille]="famille" />` })
class Hote {
  famille = FAMILLE;
}

async function afficher(svg: Promise<string>) {
  const lus: string[] = [];
  TestBed.configureTestingModule({
    providers: [{ provide: CatalogService, useValue: { pictogramme: (c: string) => (lus.push(c), svg) } }],
  });
  const fixture = TestBed.createComponent(Hote);
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r)); // laisse finir la lecture asynchrone du SVG
  fixture.detectChanges();
  return { racine: fixture.nativeElement as HTMLElement, lus };
}

describe('PictogrammeFamilleComponent (US 293)', () => {
  it('given une famille, when il s\'affiche, then un SVG en ligne role="img" porte le nom de la famille et ses formes viennent du fichier référencé', async () => {
    const { racine, lus } = await afficher(
      Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle data-point="" cx="13" cy="30" r="5"/><path d="M1 1h2"/></svg>'),
    );
    const svg = racine.querySelector('svg[role="img"]');
    expect(svg?.getAttribute('aria-label')).toBe('Souples');
    expect(lus).toEqual(['pictogrammes/souples.svg']);
    expect(svg?.querySelector('circle[data-point]')?.getAttribute('r')).toBe('5');
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe('M1 1h2');
    expect(racine.querySelector('use, img')).toBeNull();
  });

  it('given un fichier avec script, style ou couleur en dur, when il s\'affiche, then seules les formes et la géométrie sont gardées', async () => {
    const { racine } = await afficher(
      Promise.resolve(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0" stroke="red" fill="blue" style="stroke:red" onload="x()"/><foreignObject/></svg>',
      ),
    );
    expect(racine.querySelector('script, foreignObject')).toBeNull();
    const chemin = racine.querySelector('path');
    expect(chemin?.getAttribute('d')).toBe('M0 0');
    for (const a of ['stroke', 'fill', 'style', 'onload']) expect(chemin?.hasAttribute(a)).toBe(false);
  });

  it('given un fichier illisible, when il s\'affiche, then le SVG reste vide avec son nom accessible', async () => {
    const { racine } = await afficher(Promise.reject(new Error('hors ligne')));
    const svg = racine.querySelector('svg[role="img"]');
    expect(svg?.getAttribute('aria-label')).toBe('Souples');
    expect(svg?.children.length).toBe(0);
  });
});
