// US 89 : l'onboarding terminé est gardé sur le téléphone (localStorage, clé « leurio.onboarding ») et ne fait jamais planter l'app.
// Contrat : OnboardingStore (providedIn: 'root') {
//   lire(): { niveau: 'debutant' | 'intermediaire'; especesFavorites: string[] } | null   // null = pas terminé ou illisible
//   terminer(choix): void
//   localisationDifferee: boolean   // en mémoire seulement : « Plus tard » touché pendant ce lancement
// }
import { TestBed } from '@angular/core/testing';
import { OnboardingStore } from './onboarding.store';

/** Un nouveau store, comme à la réouverture de l'app : le localStorage reste, le reste est recréé. */
function nouveauStore(): OnboardingStore {
  TestBed.resetTestingModule();
  return TestBed.inject(OnboardingStore);
}

describe('OnboardingStore (US 89)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("critère 8 : given un premier lancement, when on lit le store, then il rend null (onboarding pas terminé)", () => {
    expect(nouveauStore().lire()).toBeNull();
  });

  it("critère 8 : given un onboarding terminé avec « Intermédiaire » et deux espèces, when l'app est relancée (nouveau store), then lire rend les mêmes choix", () => {
    nouveauStore().terminer({ niveau: 'intermediaire', especesFavorites: ['SAN', 'PER'] });

    expect(nouveauStore().lire()).toEqual({ niveau: 'intermediaire', especesFavorites: ['SAN', 'PER'] });
  });

  it("critère 8 : given un onboarding terminé sans espèce (facultatives), when l'app est relancée, then lire rend le niveau et une liste vide, pas null", () => {
    nouveauStore().terminer({ niveau: 'debutant', especesFavorites: [] });

    expect(nouveauStore().lire()).toEqual({ niveau: 'debutant', especesFavorites: [] });
  });

  it("critère 8 : given un contenu du stockage corrompu ou d'un niveau inconnu, when on lit, then le store rend null sans lever d'erreur", () => {
    for (const brut of ['pas du json', 'null', '42', '{}', '{"niveau":"expert","especesFavorites":[]}', '{"niveau":"debutant","especesFavorites":"SAN"}']) {
      localStorage.setItem('leurio.onboarding', brut);
      expect(nouveauStore().lire(), brut).toBeNull();
    }
  });

  it("critère 8 : given un stockage inaccessible, when on lit puis on termine, then le store ne lève jamais d'erreur", () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage inaccessible');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('stockage plein');
    });
    const store = nouveauStore();

    expect(store.lire()).toBeNull();
    expect(() => store.terminer({ niveau: 'debutant', especesFavorites: [] })).not.toThrow();
  });

  it("critère 6 : given « Plus tard » touché, when l'app est relancée (nouveau store), then la localisation n'est plus différée (le drapeau n'est pas gardé)", () => {
    const store = nouveauStore();
    expect(store.localisationDifferee).toBe(false);
    store.localisationDifferee = true;
    expect(store.localisationDifferee).toBe(true);

    expect(nouveauStore().localisationDifferee).toBe(false);
    expect(localStorage.getItem('leurio.onboarding')).toBeNull();
  });
});
