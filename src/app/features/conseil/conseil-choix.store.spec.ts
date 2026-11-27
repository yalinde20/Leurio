import { TestBed } from '@angular/core/testing';
import type { SpotEnregistre } from '../../core/data/spots.service';
import { ConseilChoixStore } from './conseil-choix.store';

describe('ConseilChoixStore (US 294)', () => {
  it('given un spot et un message gardés, when on relit le store, then ils y sont ; au départ il n\'y a ni spot ni message', () => {
    const store = TestBed.inject(ConseilChoixStore);
    expect(store.spot()).toBeNull();
    expect(store.messageSortie()).toBeNull();

    const spot: SpotEnregistre = { id: 's1', nom: 'La Maine', lat: 47.5, lng: -0.5, categorie: 2, departement: '49' };
    store.spot.set(spot);
    store.messageSortie.set({ type: 'prete', texte: 'Sortie prête' });

    expect(TestBed.inject(ConseilChoixStore).spot()).toBe(spot);
    expect(TestBed.inject(ConseilChoixStore).messageSortie()?.texte).toBe('Sortie prête');
  });

  it('given un nouveau lancement de l\'app, when le store est recréé, then rien n\'est gardé (aucune persistance sur le téléphone)', () => {
    TestBed.inject(ConseilChoixStore).spot.set({ id: 's1' } as SpotEnregistre);
    TestBed.resetTestingModule();

    expect(TestBed.inject(ConseilChoixStore).spot()).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
