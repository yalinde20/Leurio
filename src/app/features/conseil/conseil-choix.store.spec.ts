import { TestBed } from '@angular/core/testing';
import type { SpotEnregistre } from '../../core/data/spots.service';
import { ConseilChoixStore } from './conseil-choix.store';

describe('ConseilChoixStore (US 294)', () => {
  it('given un spot et un message gardés, when on relit le store, then ils y sont ; au départ il n\'y a ni spot ni message', () => {
    const store = TestBed.inject(ConseilChoixStore);
    expect(store.spot()).toBeNull();
    expect(store.sortiePrete()).toBeNull();

    const spot: SpotEnregistre = { id: 's1', nom: 'La Maine', lat: 47.5, lng: -0.5, categorie: 2, departement: '49' };
    store.spot.set(spot);
    store.sortiePrete.set({ texte: 'Sortie prête', jusquA: new Date('2030-01-01T00:00:00Z') });

    expect(TestBed.inject(ConseilChoixStore).spot()).toBe(spot);
    expect(TestBed.inject(ConseilChoixStore).sortiePrete()?.texte).toBe('Sortie prête');
  });

  it('given un nouveau lancement de l\'app, when le store est recréé, then rien n\'est gardé (aucune persistance sur le téléphone)', () => {
    TestBed.inject(ConseilChoixStore).spot.set({ id: 's1' } as SpotEnregistre);
    TestBed.resetTestingModule();

    expect(TestBed.inject(ConseilChoixStore).spot()).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('given des choix gardés, when on réinitialise, then moment, espèce, spot et sortie préparée sont vides', () => {
    const store = TestBed.inject(ConseilChoixStore);
    store.moment.set({ date: new Date(), libelle: 'Demain', mention: 'demain' });
    store.spot.set({ id: 's1' } as SpotEnregistre);
    store.sortiePrete.set({ texte: 'Sortie prête', jusquA: new Date() });

    store.reinitialiser();

    expect([store.moment(), store.espece(), store.spot(), store.sortiePrete()]).toEqual([null, null, null, null]);
  });
});
