import { TestBed } from '@angular/core/testing';
import { DocumentSpot, SOURCE_SPOTS, SourceSpots, SpotsService } from './spots.service';

const doc = (id: string): DocumentSpot => ({
  id,
  data: { nom: `Spot ${id}`, lat: 47.5, lng: -0.9, categorie: 2, milieu: 'lac', departement: '49', prive: true },
});

function creer(spots: Record<string, DocumentSpot[]>) {
  let rappelUid: (uid: string | null) => void = () => undefined;
  let surErreurUid: (e: unknown) => void = () => undefined;
  const ecoutes: string[] = [];
  const arretees: string[] = [];
  const source: SourceSpots = {
    uid: async () => null,
    surUid: (r, ko) => ((rappelUid = r), (surErreurUid = ko), () => void arretees.push('uid')),
    documents: async () => [],
    ecouter: (uid, ok) => {
      ecoutes.push(uid);
      ok(spots[uid] ?? []);
      return () => void arretees.push(uid);
    },
  };
  TestBed.configureTestingModule({ providers: [{ provide: SOURCE_SPOTS, useValue: source }] });
  const recus: string[][] = [];
  const erreurs: unknown[] = [];
  const arreter = TestBed.inject(SpotsService).ecouter(
    (s) => recus.push(s.map((x) => x.id)),
    (e) => erreurs.push(e),
  );
  return { connecter: (uid: string | null) => rappelUid(uid), echecUid: () => surErreurUid(new Error('auth')), recus, erreurs, ecoutes, arretees, arreter };
}

describe('SpotsService : changement d\'utilisateur (US 4)', () => {
  it('given aucun utilisateur puis un compte qui apparaît, when la liste est suivie, then elle passe de vide aux spots du compte', () => {
    const { connecter, recus, ecoutes } = creer({ u1: [doc('a')] });
    connecter(null);
    connecter('u1');
    expect(recus).toEqual([[], ['a']]);
    expect(ecoutes).toEqual(['u1']);
  });

  it('given un utilisateur connecté, when un autre se connecte, then l\'ancienne écoute est coupée et la liste suit le nouveau', () => {
    const { connecter, recus, arretees } = creer({ u1: [doc('a')], u2: [doc('b')] });
    connecter('u1');
    connecter('u2');
    expect(arretees).toEqual(['u1']);
    expect(recus).toEqual([['a'], ['b']]);
  });

  it('given un utilisateur connecté, when son compte est supprimé, then l\'écoute est coupée et la liste est vide', () => {
    const { connecter, recus, arretees } = creer({ u1: [doc('a')] });
    connecter('u1');
    connecter(null);
    expect(arretees).toEqual(['u1']);
    expect(recus).toEqual([['a'], []]);
  });

  it('given le suivi de l\'utilisateur qui échoue, when il signale l\'erreur, then l\'erreur est transmise', () => {
    const { echecUid, erreurs } = creer({});
    echecUid();
    expect(erreurs).toHaveLength(1);
  });

  it('given une écoute arrêtée, when un compte se connecte ensuite, then rien n\'est écouté', () => {
    const { arreter, connecter, ecoutes } = creer({ u1: [doc('a')] });
    arreter();
    connecter('u1');
    expect(ecoutes).toEqual([]);
  });
});
