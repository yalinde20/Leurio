/* US 294 : le retour « Conseil » des écrans Boîte, Spots et Compte mène à la destination donnée, même ouverts par une adresse directe. */
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BoutonRetourComponent } from './bouton-retour.component';

function ouvrir(destination?: string) {
  const location = { back: vi.fn() };
  const router = { navigateByUrl: vi.fn(async () => true) };
  TestBed.configureTestingModule({
    imports: [BoutonRetourComponent],
    providers: [{ provide: Location, useValue: location }, { provide: Router, useValue: router }],
  });
  const fixture = TestBed.createComponent(BoutonRetourComponent);
  fixture.componentRef.setInput('libelle', 'Conseil');
  if (destination) fixture.componentRef.setInput('destination', destination);
  fixture.detectChanges();
  const bouton = (fixture.nativeElement as HTMLElement).querySelector('button')!;
  return { bouton, location, router };
}

describe('BoutonRetourComponent (US 294)', () => {
  it('given une destination, when on touche le bouton, then il ouvre la destination sans revenir en arrière', () => {
    const { bouton, location, router } = ouvrir('/conseil');
    expect(bouton.textContent?.trim()).toBe('‹Conseil');
    bouton.click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/conseil');
    expect(location.back).not.toHaveBeenCalled();
  });

  it("given aucune destination, when on touche le bouton, then il revient à l'écran précédent", () => {
    const { bouton, location, router } = ouvrir();
    bouton.click();
    expect(location.back).toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
