import { TestBed } from '@angular/core/testing';
import { SOURCE_SPOTS, SpotsService } from './spots.service';

describe('SpotsService : type d\'eau absent ou inconnu', () => {
  it('given un document sans milieu valide, when on lit les spots, then le spot est gardé sans type d\'eau', async () => {
    const base = { nom: 'A', lat: 47.5, lng: -0.9, categorie: 2, departement: '49' };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SOURCE_SPOTS,
          useValue: {
            uid: async () => 'u1',
            documents: async () => [
              { id: 'a', data: base },
              { id: 'b', data: { ...base, milieu: 'mer' } },
            ],
          },
        },
      ],
    });
    const spots = await TestBed.inject(SpotsService).mesSpots();
    expect(spots.map((s) => s.id)).toEqual(['a', 'b']);
    expect(spots.every((s) => s.milieu === undefined)).toBe(true);
  });
});
