import { TestBed } from '@angular/core/testing';
import { DocumentSpot, SOURCE_SPOTS, SourceSpots, SpotsService } from './spots.service';
import { TuilesService } from './tuiles.service';

const valide = { nom: 'Étang du moulin', lat: 47.5, lng: -0.9, categorie: 2, milieu: 'lac', departement: '49', prive: true };
const saisie = { nom: '  Pont de Cé ', lat: 47.43, lng: -0.52, categorie: 2 as const, milieu: 'riviere' as const, departement: '49' };

function service(source: Partial<SourceSpots> & { uid: () => Promise<string | null> }) {
  TestBed.configureTestingModule({
    providers: [
      { provide: TuilesService, useValue: { mettreEnCacheAutour: async () => undefined } },
      { provide: SOURCE_SPOTS, useValue: { documents: async () => [], ...source } },
    ],
  });
  return TestBed.inject(SpotsService);
}

describe('SpotsService : écoute et ajout (US 4)', () => {
  it('given une source qui écoute, when un document est en attente, then le spot porte enAttente et l\'écoute s\'arrête sur demande', async () => {
    let rappel: (d: DocumentSpot[]) => void = () => undefined;
    let arrete = false;
    const spots = service({
      uid: async () => 'u1',
      ecouter: (uid, ok) => {
        expect(uid).toBe('u1');
        rappel = ok;
        return () => (arrete = true);
      },
    });
    const recus: unknown[] = [];
    const arreter = spots.ecouter((s) => recus.push(s), () => undefined);
    await vi.waitFor(() => expect(arrete).toBe(false));
    await new Promise<void>((r) => setTimeout(r));

    rappel([
      { id: 'a', data: valide, enAttente: true },
      { id: 'b', data: { nom: 'sans position' } },
    ]);
    arreter();

    expect(recus).toEqual([[{ id: 'a', nom: 'Étang du moulin', lat: 47.5, lng: -0.9, categorie: 2, milieu: 'lac', departement: '49', enAttente: true }]]);
    expect(arrete).toBe(true);
  });

  it('given une source sans écoute, when on écoute, then les documents sont lus une fois', async () => {
    const spots = service({ uid: async () => 'u1', documents: async () => [{ id: 'a', data: valide }] });
    const recus: unknown[] = [];

    spots.ecouter((s) => recus.push(s), () => undefined);
    await vi.waitFor(() => expect(recus).toHaveLength(1));

    expect(recus[0]).toEqual([{ id: 'a', nom: 'Étang du moulin', lat: 47.5, lng: -0.9, categorie: 2, milieu: 'lac', departement: '49' }]);
  });

  it('given aucun utilisateur connecté, when on écoute, then la liste est vide sans écoute de la source', async () => {
    const ecouter = vi.fn();
    const spots = service({ uid: async () => null, ecouter });
    const recus: unknown[] = [];

    spots.ecouter((s) => recus.push(s), () => undefined);
    await vi.waitFor(() => expect(recus).toEqual([[]]));
    expect(ecouter).not.toHaveBeenCalled();
  });

  it('given un spot saisi, when on l\'ajoute, then la source reçoit les champs du plan, le nom nettoyé, et le spot est privé', async () => {
    const ajouter = vi.fn(async () => undefined);
    const spots = service({ uid: async () => 'u1', ajouter });

    await spots.ajouter(saisie);

    expect(ajouter).toHaveBeenCalledWith('u1', { nom: 'Pont de Cé', lat: 47.43, lng: -0.52, categorie: 2, milieu: 'riviere', departement: '49', prive: true });
  });

  it('given aucun utilisateur connecté, when on ajoute un spot, then l\'ajout est rejeté sans écriture', async () => {
    const ajouter = vi.fn(async () => undefined);
    const spots = service({ uid: async () => null, ajouter });

    await expect(spots.ajouter(saisie)).rejects.toThrow();
    expect(ajouter).not.toHaveBeenCalled();
  });
});
