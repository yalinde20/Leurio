import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE } from './compte.service';
import { ConsentementsService } from './consentements.service';
import { SOURCE_PROFIL } from './profil.service';

type Stocke = { analytics: boolean; video: boolean | null } | null;

function preparer(docs: Record<string, Stocke>) {
  const etat = { uid: 'uid-A' as string | null };
  const ecritures: { uid: string; champs: unknown }[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => etat.uid, connecterAnonymement: async () => 'x', profilExiste: async () => true, ecrireProfil: async () => undefined } },
      { provide: SOURCE_PROFIL, useValue: { mettreAJour: async (uid: string, champs: unknown) => void ecritures.push({ uid, champs }), lireConsentements: async (uid: string) => docs[uid] ?? null } },
    ],
  });
  return { service: TestBed.inject(ConsentementsService), etat, ecritures };
}

afterEach(() => TestBed.resetTestingModule());

describe('US 10 : ConsentementsService, changement de compte', () => {
  it("given le compte A a accepté la vidéo et Analytics, when le compte B (sans document) est lu, then rien n'est accepté et une écriture garde video null", async () => {
    const { service, etat, ecritures } = preparer({ 'uid-A': { analytics: true, video: true } });
    await service.charger();
    expect(service.video()).toBe(true);

    etat.uid = 'uid-B';
    await service.charger();

    expect(service.video()).toBe(false);
    expect(service.reponseVideo()).toBeNull();
    expect(service.analytics()).toBe(false);
    await service.modifier('analytics', true);
    expect(ecritures).toEqual([{ uid: 'uid-B', champs: { consentements: { analytics: true, video: null } } }]);
  });

  it("given le compte A a accepté la vidéo, when le compte B a video null, then la vidéo n'est pas acceptée", async () => {
    const { service, etat } = preparer({ 'uid-A': { analytics: false, video: true }, 'uid-B': { analytics: false, video: null } });
    await service.charger();
    etat.uid = 'uid-B';
    await service.charger();
    expect(service.reponseVideo()).toBeNull();
    expect(service.video()).toBe(false);
  });

  it("given le compte B est en cours de lecture, when on regarde les consentements, then ceux du compte A ne sont plus visibles", async () => {
    const { service, etat } = preparer({ 'uid-A': { analytics: true, video: true } });
    await service.charger();
    etat.uid = 'uid-B';
    const lecture = service.charger();
    await Promise.resolve();
    expect(service.charge()).toBe(false);
    expect(service.video()).toBe(false);
    await lecture;
  });

  it('given des consentements acceptés, when oublier() est appelé (suppression du compte), then tout revient à l\'état initial', async () => {
    const { service } = preparer({ 'uid-A': { analytics: true, video: true } });
    await service.charger();

    service.oublier();

    expect(service.charge()).toBe(false);
    expect(service.analytics()).toBe(false);
    expect(service.video()).toBe(false);
    expect(service.reponseVideo()).toBeNull();
  });
});
