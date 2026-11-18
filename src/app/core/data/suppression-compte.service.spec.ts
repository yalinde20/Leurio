import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE, SourceCompte } from './compte.service';
import { OnboardingStore } from './onboarding.store';
import { SuppressionCompteService } from './suppression-compte.service';

describe('SuppressionCompteService.effacerEtatLocal', () => {
  const creations: string[] = [];
  let ecritures: string[];

  beforeEach(() => {
    creations.length = 0;
    ecritures = [];
    const source: SourceCompte = {
      uidCourant: async () => null,
      connecterAnonymement: async () => {
        creations.push('anonyme');
        return `uid-${creations.length}`;
      },
      profilExiste: async () => false,
      ecrireProfil: async (uid) => void ecritures.push(uid),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SOURCE_COMPTE, useValue: source }] });
    localStorage.setItem('leurio.theme', 'sombre');
    localStorage.setItem('leurio.unites', '{}');
    localStorage.setItem('leurio.saisieTempEau', '{"valeurC":12,"mesureeA":"2026-01-01T00:00:00.000Z"}');
  });
  afterEach(() => localStorage.clear());

  it('given un onboarding terminé, when j\'efface l\'état local, then l\'onboarding, le marqueur du profil et la saisie sont retirés, le thème et les unités restent', () => {
    const onboarding = TestBed.inject(OnboardingStore);
    onboarding.terminer({ niveau: 'debutant', especesFavorites: [] });
    localStorage.setItem('leurio.compte', 'uid-0');

    TestBed.inject(SuppressionCompteService).effacerEtatLocal();

    expect(onboarding.lire()).toBeNull();
    expect(localStorage.getItem('leurio.onboarding')).toBeNull();
    expect(localStorage.getItem('leurio.compte')).toBeNull();
    expect(localStorage.getItem('leurio.saisieTempEau')).toBeNull();
    expect(localStorage.getItem('leurio.theme')).toBe('sombre');
    expect(localStorage.getItem('leurio.unites')).toBe('{}');
  });

  it('given un compte déjà créé dans ce lancement, when j\'efface l\'état local puis refais l\'onboarding, then un nouveau compte anonyme et son profil sont créés', async () => {
    const { CompteService } = await import('./compte.service');
    const compte = TestBed.inject(CompteService);
    const choix = { niveau: 'debutant' as const, especesFavorites: [] };
    await compte.assurerCompte(choix);
    expect(ecritures).toEqual(['uid-1']);

    TestBed.inject(SuppressionCompteService).effacerEtatLocal();
    await compte.assurerCompte(choix);

    expect(creations).toHaveLength(2);
    expect(ecritures).toEqual(['uid-1', 'uid-2']);
  });

  it('given un profil écrit, when j\'oublie le profil, then le marqueur est retiré mais l\'onboarding reste', () => {
    const onboarding = TestBed.inject(OnboardingStore);
    onboarding.terminer({ niveau: 'debutant', especesFavorites: [] });
    localStorage.setItem('leurio.compte', 'uid-0');

    TestBed.inject(SuppressionCompteService).oublierProfil();

    expect(localStorage.getItem('leurio.compte')).toBeNull();
    expect(onboarding.lire()).not.toBeNull();
  });
});
