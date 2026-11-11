import { TestBed } from '@angular/core/testing';
import { DocumentLeurre, SOURCE_TACKLE_BOX, SourceTackleBox, TackleBoxService } from './tackle-box.service';

const attendre = () => new Promise<void>((r) => setTimeout(r));
const doc = (id: string, createdAt: number): DocumentLeurre => ({
  id,
  enAttente: false,
  data: { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', createdAt },
});

function creer(boites: Record<string, DocumentLeurre[]>) {
  let rappelUid: (uid: string | null) => void = () => undefined;
  const ecoutes: string[] = [];
  const arretees: string[] = [];
  const source: SourceTackleBox = {
    uid: async () => null,
    surUid: (r) => ((rappelUid = r), () => undefined),
    ecouter: (uid, ok) => {
      ecoutes.push(uid);
      ok(boites[uid] ?? []);
      return () => void arretees.push(uid);
    },
    ajouter: async () => undefined,
  };
  TestBed.configureTestingModule({ providers: [{ provide: SOURCE_TACKLE_BOX, useValue: source }] });
  return { service: TestBed.inject(TackleBoxService), connecter: (uid: string | null) => rappelUid(uid), ecoutes, arretees };
}

describe('TackleBoxService : changement d\'utilisateur (US 99)', () => {
  it('given aucun utilisateur puis un compte qui apparaît, when la boîte est ouverte, then la liste suit le compte', async () => {
    const { service, connecter, ecoutes } = creer({ u1: [doc('a', 1)] });
    await attendre();
    connecter(null);
    expect(service.leurres()).toEqual([]);
    connecter('u1');
    expect(ecoutes).toEqual(['u1']);
    expect(service.leurres()!.map((l) => l.id)).toEqual(['a']);
  });

  it('given un utilisateur connecté, when un autre se connecte, then l\'ancien abonnement est coupé et la liste suit le nouveau', async () => {
    const { service, connecter, arretees } = creer({ u1: [doc('a', 1)], u2: [doc('b', 2)] });
    connecter('u1');
    connecter('u2');
    expect(arretees).toEqual(['u1']);
    expect(service.leurres()!.map((l) => l.id)).toEqual(['b']);
  });

  it('given un utilisateur connecté, when il se déconnecte, then la liste est vide', async () => {
    const { service, connecter } = creer({ u1: [doc('a', 1)] });
    connecter('u1');
    connecter(null);
    expect(service.leurres()).toEqual([]);
  });
});
