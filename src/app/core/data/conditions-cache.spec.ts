// US 62 : garder les dernières conditions connues dans IndexedDB (PLAN §4, §8.2).
// IndexedDB est remplacé par fake-indexeddb, une fabrique neuve par test (aucun état global).
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { ConditionsCache, INDEXED_DB, ReleveConditions } from './conditions-cache';

const RELEVE_27_10: ReleveConditions = {
  conditions: {
    tempEau: 11.2,
    sourceTempEau: 'capteur',
    debitTendance: 'stable',
    pressionTendance48h: -4,
    nuages: 40,
    vent: 12,
    moment: 'soir',
    saison: 'automne',
    categorie: null,
    departement: '49',
    niveau: 'debutant',
  },
  pressionHpa: 1016,
  obtenuesA: '2026-10-27T17:00:00.000Z',
};

function cacheSur(fabrique: IDBFactory | undefined): ConditionsCache {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: INDEXED_DB, useValue: fabrique }] });
  return TestBed.inject(ConditionsCache);
}

describe('ConditionsCache', () => {
  it('critère 0 : given des conditions obtenues avec succès le 27/10 à 18 h, when l\'app est relancée et lit le cache local, then ces conditions sont relues à l\'identique', async () => {
    const fabrique = new IDBFactory();
    await cacheSur(fabrique).ecrire(RELEVE_27_10);
    // « Relancée » : nouvelle instance, même base IndexedDB.
    const relu = await cacheSur(fabrique).lire();
    expect(relu).toEqual(RELEVE_27_10);
  });

  it('critère 0 : given une base vide, when on lit le cache, then il rend null', async () => {
    expect(await cacheSur(new IDBFactory()).lire()).toBeNull();
  });

  it('critère 0 : given un navigateur sans IndexedDB, when on lit puis on écrit, then lire rend null et ecrire se résout sans erreur', async () => {
    const cache = cacheSur(undefined);
    expect(await cache.lire()).toBeNull();
    await expect(cache.ecrire(RELEVE_27_10)).resolves.toBeUndefined();
    expect(await cache.lire()).toBeNull();
  });

  it('critère 2 : given un relevé du 27/10 en cache, when on écrit un relevé du 28/10, then une seule entrée reste : celle du 28/10', async () => {
    const fabrique = new IDBFactory();
    const cache = cacheSur(fabrique);
    await cache.ecrire(RELEVE_27_10);
    const releve28: ReleveConditions = {
      conditions: { ...RELEVE_27_10.conditions, nuages: 90, departement: '44' },
      pressionHpa: 1002,
      obtenuesA: '2026-10-28T08:00:00.000Z',
    };
    await cache.ecrire(releve28);
    expect(await cacheSur(fabrique).lire()).toEqual(releve28);
  });
});
