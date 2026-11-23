import { TestBed } from '@angular/core/testing';
import { SOURCE_SPOTS, SpotsService } from './spots.service';

/** US 3 : l'onglet « Spots » affiche le type d'eau (PLAN §7 : `milieu`, valeurs `riviere`, `lac`, `canal`). */
describe('SpotsService : type d\'eau (US 3)', () => {
  it('critère 1 : given des spots de type rivière, lac et canal, when on lit les spots, then chaque spot porte son milieu', async () => {
    const base = { lat: 47.5, lng: -0.9, categorie: 2, departement: '49' };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SOURCE_SPOTS,
          useValue: {
            uid: async () => 'u1',
            documents: async () => [
              { id: 'a', data: { ...base, nom: 'A', milieu: 'riviere' } },
              { id: 'b', data: { ...base, nom: 'B', milieu: 'lac' } },
              { id: 'c', data: { ...base, nom: 'C', milieu: 'canal' } },
            ],
          },
        },
      ],
    });
    const spots = await TestBed.inject(SpotsService).mesSpots();
    expect(spots.map((s) => (s as unknown as { milieu: string }).milieu)).toEqual(['riviere', 'lac', 'canal']);
  });
});
