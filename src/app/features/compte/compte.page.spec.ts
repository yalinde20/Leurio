import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { ComptePage } from './compte.page';

describe('ComptePage', () => {
  // US 91 (décision du propriétaire) : l'onglet n'est plus vide ; son contenu est couvert par compte.page.informations.spec.ts.
  it('affiche son titre « Compte »', async () => {
    await TestBed.configureTestingModule({
      imports: [ComptePage],
      providers: [provideIonicAngular(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ComptePage);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Compte');
  });
});
