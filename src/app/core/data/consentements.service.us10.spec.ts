/*
 * US 10 : le consentement vidéo devient tri-état dans users/{uid}.consentements.video (PLAN §7, §9 bis) :
 * null (ou absent) = jamais répondu, on demande ; false = refusé, on ne redemande pas ; true = accepté.
 * Public : ConsentementsService (charger, modifier) et le double de SOURCE_PROFIL. Ici on prouve qu'un « jamais répondu » n'est pas
 * transformé en refus quand un autre choix est écrit (sinon la question ne serait plus jamais posée).
 */
import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE } from './compte.service';
import { ConsentementsService } from './consentements.service';
import { SOURCE_PROFIL } from './profil.service';

function preparer(stocke: { analytics: boolean; video: boolean | null } | null) {
  const ecritures: unknown[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => 'uid-test-123', connecterAnonymement: async () => 'uid-test-123', profilExiste: async () => true, ecrireProfil: async () => undefined } },
      {
        provide: SOURCE_PROFIL,
        useValue: { mettreAJour: async (_u: string, champs: unknown) => void ecritures.push(champs), lireConsentements: async () => stocke },
      },
    ],
  });
  return { service: TestBed.inject(ConsentementsService), ecritures };
}

afterEach(() => TestBed.resetTestingModule());

describe('US 10 : ConsentementsService, consentement vidéo tri-état', () => {
  it("critère 1 : given users/{uid} a video null (jamais répondu), when j'accepte Analytics, then l'écriture garde video null (le refus n'est pas inventé) et la vidéo n'est pas acceptée", async () => {
    const { service, ecritures } = preparer({ analytics: false, video: null });
    await service.charger();

    await service.modifier('analytics', true);

    expect(ecritures).toEqual([{ consentements: { analytics: true, video: null } }]);
    expect(service.video()).not.toBe(true);
  });

  it("critère 4 : given users/{uid} a video faux (refusé), when j'accepte Analytics, then l'écriture garde video faux", async () => {
    const { service, ecritures } = preparer({ analytics: false, video: false });
    await service.charger();

    await service.modifier('analytics', true);

    expect(ecritures).toEqual([{ consentements: { analytics: true, video: false } }]);
  });

  it("critère 2 : given users/{uid} a video null, when j'accepte la vidéo, then video() devient vrai et users/{uid} reçoit video vrai", async () => {
    const { service, ecritures } = preparer({ analytics: false, video: null });
    await service.charger();

    await service.modifier('video', true);

    expect(service.video()).toBe(true);
    expect(ecritures).toEqual([{ consentements: { analytics: false, video: true } }]);
  });
});
