import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE } from './compte.service';
import { ConsentementsService } from './consentements.service';
import { SOURCE_PROFIL } from './profil.service';

type Stocke = { analytics: boolean; video: boolean | null } | null;

/** `enAttente` : les uid absents de `docs` ont une lecture en attente, résolue à la main par `reponses.get(uid)`. */
function preparer(docs: Record<string, Stocke>, enAttente = false) {
  const reponses = new Map<string, (valeur: Stocke) => void>();
  const etat = { uid: 'uid-A' as string | null };
  const ecritures: { uid: string; champs: unknown }[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => etat.uid, connecterAnonymement: async () => 'x', profilExiste: async () => true, ecrireProfil: async () => undefined } },
      { provide: SOURCE_PROFIL, useValue: { mettreAJour: async (uid: string, champs: unknown) => void ecritures.push({ uid, champs }), lireConsentements: (uid: string) => (enAttente && !(uid in docs) ? new Promise<Stocke>((r) => reponses.set(uid, r)) : Promise.resolve(docs[uid] ?? null)) } },
    ],
  });
  return { service: TestBed.inject(ConsentementsService), etat, ecritures, reponses };
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
    const { service, etat } = preparer({ 'uid-A': { analytics: true, video: true } }, true);
    await service.charger();
    expect(service.video()).toBe(true);
    etat.uid = 'uid-B';
    void service.charger();
    await new Promise((r) => setTimeout(r, 0));

    expect(service.charge()).toBe(false);
    expect(service.video()).toBe(false);
    expect(service.analytics()).toBe(false);
  });

  it("given la lecture de A est en attente puis le compte devient B, when B répond video null puis A répond video vrai, then la réponse tardive de A est ignorée", async () => {
    const { service, etat, reponses } = preparer({}, true);
    const chargerA = service.charger();
    await new Promise((r) => setTimeout(r, 0));
    etat.uid = 'uid-B';
    const chargerB = service.charger();
    await new Promise((r) => setTimeout(r, 0));

    reponses.get('uid-B')!({ analytics: false, video: null });
    await chargerB;
    reponses.get('uid-A')!({ analytics: true, video: true });
    await chargerA;

    expect(service.reponseVideo()).toBeNull();
    expect(service.video()).toBe(false);
    expect(service.analytics()).toBe(false);
    expect(service.charge()).toBe(true);
  });

  it("given la lecture de A est en attente, when oublier() est appelé puis A répond, then charge() reste faux et rien n'est appliqué", async () => {
    const { service, reponses } = preparer({}, true);
    const chargerA = service.charger();
    await new Promise((r) => setTimeout(r, 0));

    service.oublier();
    reponses.get('uid-A')!({ analytics: true, video: true });
    await chargerA;

    expect(service.charge()).toBe(false);
    expect(service.video()).toBe(false);
    expect(service.reponseVideo()).toBeNull();
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
