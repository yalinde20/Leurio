/* US 294 : la suppression du compte vide aussi le spot et la sortie préparée gardés par le Conseil. */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SOURCE_SUPPRESSION, SourceSuppression } from '../../core/data/suppression-compte.service';
import { ConseilChoixStore } from '../conseil/conseil-choix.store';
import { compact, ouvrirCompte, toucher } from './compte-informations.doubles';


const TITRE = 'Supprimer définitivement ton compte, ta boîte et tes spots ?';

beforeEach(() => localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] })));
afterEach(() => {
  document.querySelectorAll('ion-alert').forEach((a) => a.remove());
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('Suppression du compte et choix du Conseil (US 294)', () => {
  it('given un spot choisi et une sortie préparée, when le compte est supprimé, then le store du Conseil est vide', async () => {
    const source: SourceSuppression = {
      reconnexionRequise: async () => null,
      reconnecter: async () => undefined,
      reconnecterEmail: async () => undefined,
      supprimerDonnees: async () => undefined,
      supprimerCompte: async () => undefined,
    };
    const { page, stabiliser } = await ouvrirCompte({ compteLie: null, providers: [{ provide: SOURCE_SUPPRESSION, useValue: source }] });
    const store = TestBed.inject(ConseilChoixStore);
    store.spot.set({ id: 's1', nom: 'La Maine', lat: 47.5, lng: -0.5, categorie: 2, departement: '49' });
    store.sortiePrete.set({ texte: 'Sortie prête', jusquA: new Date('2030-01-01T00:00:00Z') });

    await toucher(page, 'Supprimer mon compte', stabiliser);
    const confirmer = [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')]
      .find((d) => compact(d.textContent).includes(compact(TITRE)))
      ?.querySelectorAll<HTMLButtonElement>('button');
    [...confirmer!].find((b) => compact(b.textContent) === compact('Supprimer définitivement'))!.click();
    await stabiliser();

    expect(TestBed.inject(Router).url).toBe('/onboarding');
    expect(store.spot()).toBeNull();
    expect(store.sortiePrete()).toBeNull();
  });
});
