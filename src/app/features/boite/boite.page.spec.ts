import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { BoitePage } from './boite.page';

// US 99 : la page n'est plus vide (liste, état vide, bouton d'ajout), l'assertion « ion-content vide » a donc été retirée.
// Le titre reste testé ; la source Firebase est remplacée par un double (aucun appel réel).
describe('BoitePage', () => {
  it('affiche le titre « Boîte »', async () => {
    const source = { uid: async () => 'u1', ecouter: (_u: string, ok: (d: never[]) => void) => (ok([]), () => undefined), ajouter: async () => undefined };
    await TestBed.configureTestingModule({
      imports: [BoitePage],
      providers: [provideIonicAngular(), { provide: SOURCE_TACKLE_BOX, useValue: source }],
    }).compileComponents();
    const fixture = TestBed.createComponent(BoitePage);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Boîte');
  });
});
