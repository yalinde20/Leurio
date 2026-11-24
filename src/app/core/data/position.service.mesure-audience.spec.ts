import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE } from './compte.service';
import { MesureAudienceService } from './mesure-audience.service';
import { GEOLOCALISATION, PositionService } from './position.service';
import { SOURCE_PROFIL } from './profil.service';
import { ANALYTICS, PortAnalytics } from '../firebase/mesure-audience';

describe('US 19 : événement de position', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('US 19 critère 4 : given Analytics accepté, when la position GPS est obtenue, then position_obtenue ne porte que le département', async () => {
    const evenements: { nom: string; parametres: Record<string, unknown> }[] = [];
    const appels: string[] = [];
    const port: PortAnalytics = {
      initialiser: async () => void appels.push('initialiser'),
      envoyer: async (nom, parametres) => void evenements.push({ nom, parametres }),
      desactiver: async () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ANALYTICS, useValue: port },
        { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => 'u1', connecterAnonymement: async () => 'u1', profilExiste: async () => true, ecrireProfil: async () => undefined } },
        { provide: SOURCE_PROFIL, useValue: { mettreAJour: async () => undefined, lireConsentements: async () => ({ analytics: true, video: false }) } },
        {
          provide: GEOLOCALISATION,
          useValue: {
            checkPermissions: async () => ({ location: 'granted' }),
            getCurrentPosition: async () => ({ coords: { latitude: 47.478, longitude: -0.563, accuracy: 12 } }),
          },
        },
      ],
    });
    TestBed.inject(MesureAudienceService).demarrer();
    await vi.waitFor(() => expect(appels).toEqual(['initialiser']));

    await TestBed.inject(PositionService).positionGps();

    await vi.waitFor(() => expect(evenements).toHaveLength(1));
    expect(evenements[0]).toEqual({ nom: 'position_obtenue', parametres: { departement: '49' } });
    expect(JSON.stringify(evenements)).not.toMatch(/47\.4|0\.56|lat|lng/i);
  });
});
