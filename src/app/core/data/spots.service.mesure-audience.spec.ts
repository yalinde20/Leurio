import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE, SourceCompte } from './compte.service';
import { MesureAudienceService } from './mesure-audience.service';
import { SOURCE_PROFIL } from './profil.service';
import { SOURCE_SPOTS, SpotsService } from './spots.service';
import { TuilesService } from './tuiles.service';
import { ANALYTICS, PortAnalytics } from '../firebase/mesure-audience';

describe('US 19 : événements des spots', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('US 19 critère 4 : given Analytics accepté, when un spot est ajouté, then spot_ajoute est envoyé sans latitude ni longitude', async () => {
    const evenements: { nom: string; parametres: Record<string, unknown> }[] = [];
    const appels: string[] = [];
    const port: PortAnalytics = {
      initialiser: async () => void appels.push('initialiser'),
      envoyer: async (nom, parametres) => void evenements.push({ nom, parametres }),
      desactiver: async () => undefined,
    };
    const compte: SourceCompte = {
      uidCourant: async () => 'u1',
      connecterAnonymement: async () => 'u1',
      profilExiste: async () => true,
      ecrireProfil: async () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SOURCE_COMPTE, useValue: compte },
        { provide: SOURCE_PROFIL, useValue: { mettreAJour: async () => undefined, lireConsentements: async () => ({ analytics: true, video: false }) } },
        { provide: ANALYTICS, useValue: port },
        { provide: TuilesService, useValue: { mettreEnCacheAutour: async () => undefined } },
        { provide: SOURCE_SPOTS, useValue: { documents: async () => [], uid: async () => 'u1', ajouter: async () => undefined } },
      ],
    });
    TestBed.inject(MesureAudienceService).demarrer();
    await vi.waitFor(() => expect(appels).toEqual(['initialiser']));

    await TestBed.inject(SpotsService).ajouter({ nom: 'Pont de Cé', lat: 47.43, lng: -0.52, categorie: 2, milieu: 'riviere', departement: '49' });

    await vi.waitFor(() => expect(evenements).toHaveLength(1));
    expect(evenements[0].nom).toBe('spot_ajoute');
    expect(evenements[0].parametres).toEqual({ milieu: 'riviere', categorie: 2, departement: '49' });
    expect(JSON.stringify(evenements)).not.toMatch(/47\.43|0\.52|lat|lng/i);
  });
});
