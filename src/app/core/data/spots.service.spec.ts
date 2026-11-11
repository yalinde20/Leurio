import { TestBed } from '@angular/core/testing';
import { DocumentSpot, SOURCE_SPOTS, SpotsService } from './spots.service';

function service(uid: string | null, documents: DocumentSpot[] | Error) {
  const lectures: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SOURCE_SPOTS,
        useValue: {
          uid: async () => uid,
          documents: async (u: string) => {
            lectures.push(u);
            if (documents instanceof Error) throw documents;
            return documents;
          },
        },
      },
    ],
  });
  return { spots: TestBed.inject(SpotsService), lectures };
}

const valide = { nom: 'Étang du moulin', lat: 47.5, lng: -0.9, categorie: 2, departement: '49' };

describe('SpotsService', () => {
  it('given aucun utilisateur connecté, when on lit les spots, then la liste est vide sans lecture', async () => {
    const { spots, lectures } = service(null, [{ id: 's1', data: valide }]);
    expect(await spots.mesSpots()).toEqual([]);
    expect(lectures).toEqual([]);
  });

  it('given un utilisateur connecté, when on lit les spots, then chaque document devient un spot dont l\'id est celui du document', async () => {
    const { spots, lectures } = service('u1', [{ id: 's1', data: { ...valide, extra: true } }]);
    expect(await spots.mesSpots()).toEqual([{ id: 's1', ...valide }]);
    expect(lectures).toEqual(['u1']);
  });

  it('given des documents mal formés, when on lit les spots, then ils sont ignorés', async () => {
    const { spots } = service('u1', [
      { id: 'a', data: { ...valide, nom: '' } },
      { id: 'b', data: { ...valide, lat: '47' } },
      { id: 'c', data: { ...valide, categorie: 3 } },
      { id: 'd', data: { ...valide, departement: undefined } },
      { id: 'e', data: null },
      { id: 'f', data: { ...valide, categorie: 1 } },
    ]);
    expect((await spots.mesSpots()).map((s) => s.id)).toEqual(['f']);
  });

  it('given une lecture qui échoue, when on lit les spots, then l\'erreur est propagée', async () => {
    const { spots } = service('u1', new Error('hors ligne'));
    await expect(spots.mesSpots()).rejects.toThrow('hors ligne');
  });
});
