import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE } from './compte.service';
import { ConsentementsService } from './consentements.service';
import { SOURCE_PROFIL } from './profil.service';
import { SuppressionCompteService } from './suppression-compte.service';

afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 10 : SuppressionCompteService, consentements', () => {
  it("given des consentements lus avec la vidéo acceptée, when les données du profil sont oubliées (suppression du compte), then video() est faux et charge() est faux", async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => 'uid-A', connecterAnonymement: async () => 'uid-A', profilExiste: async () => true, ecrireProfil: async () => undefined } },
        { provide: SOURCE_PROFIL, useValue: { mettreAJour: async () => undefined, lireConsentements: async () => ({ analytics: true, video: true }) } },
      ],
    });
    const consentements = TestBed.inject(ConsentementsService);
    await consentements.charger();
    expect(consentements.video()).toBe(true);

    TestBed.inject(SuppressionCompteService).oublierProfil();

    expect(consentements.video()).toBe(false);
    expect(consentements.analytics()).toBe(false);
    expect(consentements.charge()).toBe(false);
  });
});
