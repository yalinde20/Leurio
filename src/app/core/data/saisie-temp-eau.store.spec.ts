// US 85 : la température saisie au thermomètre est gardée sur le téléphone (localStorage) et ne fait jamais planter l'app.
// Contrat : SaisieTempEauStore (providedIn: 'root') { lire(): SaisieTempEau | null; ecrire(saisie: SaisieTempEau): void }.
import { TestBed } from '@angular/core/testing';
import { SaisieTempEau } from '../engine/temperature-eau';
import { SaisieTempEauStore } from './saisie-temp-eau.store';

const SAISIE: SaisieTempEau = { valeurC: 9, mesureeA: new Date('2026-11-09T08:12:00Z') };

/** Un nouveau store, comme à la réouverture de l'app : le localStorage reste, le reste est recréé. */
function nouveauStore(): SaisieTempEauStore {
  TestBed.resetTestingModule();
  return TestBed.inject(SaisieTempEauStore);
}

describe('SaisieTempEauStore (US 85)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('critère 4 : given rien de saisi, when on lit, then le store rend null', () => {
    expect(nouveauStore().lire()).toBeNull();
  });

  it("critère 4 : given une température écrite, when l'app est rouverte (nouveau store), then lire rend la même valeur et le même instant", () => {
    nouveauStore().ecrire(SAISIE);

    const relue = nouveauStore().lire();

    expect(relue?.valeurC).toBe(9);
    expect(relue?.mesureeA).toBeInstanceOf(Date);
    expect(relue?.mesureeA.getTime()).toBe(SAISIE.mesureeA.getTime());
  });

  it("critère 4 : given une température déjà écrite, when on en écrit une nouvelle, then seule la dernière est gardée", () => {
    const store = nouveauStore();
    store.ecrire(SAISIE);
    store.ecrire({ valeurC: 12.5, mesureeA: new Date('2026-11-09T09:00:00Z') });

    const relue = nouveauStore().lire();
    expect(relue?.valeurC).toBe(12.5);
    expect(relue?.mesureeA.toISOString()).toBe('2026-11-09T09:00:00.000Z');
  });

  it('critère 4 : given une température écrite, when on regarde le stockage, then elle est dans le localStorage du téléphone', () => {
    nouveauStore().ecrire(SAISIE);

    expect(localStorage.length).toBeGreaterThan(0);
  });

  it.each([
    ['du texte qui n\'est pas du JSON', 'pas du json'],
    ['un objet sans valeur', '{}'],
    ['une valeur non numérique', '{"valeurC":"chaud","mesureeA":"2026-11-09T08:12:00.000Z"}'],
    ['une date invalide', '{"valeurC":9,"mesureeA":"hier"}'],
    ['null', 'null'],
  ])('critère 4 : given %s dans le stockage, when on lit, then le store rend null sans lever', (_nom, contenu) => {
    nouveauStore().ecrire(SAISIE);
    for (const cle of Object.keys(localStorage)) localStorage.setItem(cle, contenu);

    expect(() => nouveauStore().lire()).not.toThrow();
    expect(nouveauStore().lire()).toBeNull();
  });

  it('critère 4 : given un stockage inaccessible, when on lit puis on écrit, then rien ne lève et lire rend null', () => {
    const store = nouveauStore();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage inaccessible');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota dépassé');
    });

    expect(() => store.ecrire(SAISIE)).not.toThrow();
    expect(store.lire()).toBeNull();
  });
});
