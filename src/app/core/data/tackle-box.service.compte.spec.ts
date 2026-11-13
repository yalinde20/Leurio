import { TestBed } from '@angular/core/testing';
import { DocumentLeurre, SOURCE_TACKLE_BOX, SourceTackleBox, TackleBoxService } from './tackle-box.service';

const attendre = () => new Promise<void>((r) => setTimeout(r));
const doc = (id: string, createdAt: number): DocumentLeurre => ({
  id,
  enAttente: false,
  data: { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', createdAt },
});

function creer(boites: Record<string, DocumentLeurre[]>, instantane = true) {
  let rappelUid: (uid: string | null) => void = () => undefined;
  let surErreurUid: (e: unknown) => void = () => undefined;
  let surErreurLecture: (e: unknown) => void = () => undefined;
  let surChangement: (d: DocumentLeurre[]) => void = () => undefined;
  const ecoutes: string[] = [];
  const arretees: string[] = [];
  const source: SourceTackleBox = {
    uid: async () => null,
    surUid: (r, ko) => ((rappelUid = r), (surErreurUid = ko), () => undefined),
    ecouter: (uid, ok, ko) => {
      surErreurLecture = ko;
      ecoutes.push(uid);
      if (instantane) ok(boites[uid] ?? []);
      else surChangement = ok;
      return () => void arretees.push(uid);
    },
    ajouter: async () => undefined,
    modifier: async () => undefined,
    supprimer: async () => undefined,
  };
  TestBed.configureTestingModule({ providers: [{ provide: SOURCE_TACKLE_BOX, useValue: source }] });
  return { service: TestBed.inject(TackleBoxService), connecter: (uid: string | null) => rappelUid(uid),
    echecUid: () => surErreurUid(new Error('auth')),
    instantane: (d: DocumentLeurre[]) => surChangement(d),
    echecLecture: () => surErreurLecture(new Error('lecture')), ecoutes, arretees };
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

  it('given une erreur de lecture, when un nouvel instantané arrive après un changement d\'utilisateur, then l\'erreur disparaît', () => {
    const { service, connecter, echecLecture } = creer({ u1: [doc('a', 1)], u2: [doc('b', 2)] });
    connecter('u1');
    echecLecture();
    expect(service.erreur()).toBe(true);
    connecter('u2');
    expect(service.erreur()).toBe(false);
    expect(service.leurres()!.map((l) => l.id)).toEqual(['b']);
  });

  it('given l\'abonnement à l\'utilisateur qui échoue, when il signale l\'erreur, then le service est en erreur', () => {
    const { service, echecUid } = creer({});
    echecUid();
    expect(service.erreur()).toBe(true);
  });

  it('given un utilisateur A puis B dont l\'instantané tarde, when B se connecte, then la liste repasse à null jusqu\'à son premier instantané', () => {
    const { service, connecter, instantane } = creer({}, false);
    connecter('u1');
    instantane([doc('a', 1)]);
    expect(service.leurres()!.map((l) => l.id)).toEqual(['a']);
    connecter('u2');
    expect(service.leurres()).toBeNull();
    instantane([doc('b', 2)]);
    expect(service.leurres()!.map((l) => l.id)).toEqual(['b']);
  });

  it('given une erreur de lecture, when j\'appelle reessayer, then la boîte est de nouveau écoutée et la liste suit le nouvel instantané', () => {
    const { service, connecter, echecLecture, ecoutes, arretees } = creer({ u1: [doc('a', 1)] });
    connecter('u1');
    echecLecture();
    expect(service.erreur()).toBe(true);
    service.reessayer();
    expect(service.erreur()).toBe(false);
    expect(ecoutes).toEqual(['u1', 'u1']);
    expect(arretees).toEqual(['u1']);
    expect(service.leurres()!.map((l) => l.id)).toEqual(['a']);
  });

  it('given aucune erreur, when j\'appelle reessayer, then rien ne change', () => {
    const { service, connecter, ecoutes } = creer({ u1: [doc('a', 1)] });
    connecter('u1');
    service.reessayer();
    expect(ecoutes).toEqual(['u1']);
  });
});
