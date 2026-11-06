// US 62 : le cache ne bloque ni ne plante jamais le conseil (PLAN §4).
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { ConditionsCache, DELAI_INDEXED_DB_MS, INDEXED_DB } from './conditions-cache';

function cacheSur(fabrique: IDBFactory): ConditionsCache {
  TestBed.configureTestingModule({ providers: [{ provide: INDEXED_DB, useValue: fabrique }] });
  return TestBed.inject(ConditionsCache);
}

describe('ConditionsCache, robustesse', () => {
  afterEach(() => vi.useRealTimers());

  it("given un IndexedDB dont open() ne répond jamais, when on lit puis on écrit, then lire rend null et ecrire se résout après le délai", async () => {
    vi.useFakeTimers();
    const muette = { open: () => ({}) } as unknown as IDBFactory;
    const cache = cacheSur(muette);
    const lecture = cache.lire();
    const ecriture = cache.ecrire({ conditions: {} as never, pressionHpa: null, obtenuesA: '2026-10-27T17:00:00.000Z' });
    await vi.advanceTimersByTimeAsync(DELAI_INDEXED_DB_MS);
    expect(await lecture).toBeNull();
    await expect(ecriture).resolves.toBeUndefined();
  });

  it('given une valeur mal formée dans le magasin, when on lit, then le cache rend null', async () => {
    const fabrique = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const requete = fabrique.open('leurio', 1);
      requete.onupgradeneeded = () => requete.result.createObjectStore('conditions');
      requete.onsuccess = () => {
        const base = requete.result;
        const transaction = base.transaction('conditions', 'readwrite');
        transaction.objectStore('conditions').put({ obtenuesA: 'pas une date', conditions: {} }, 'dernieres');
        transaction.oncomplete = () => {
          base.close();
          resolve();
        };
      };
      requete.onerror = () => reject(requete.error);
    });
    expect(await cacheSur(fabrique).lire()).toBeNull();
  });
});
