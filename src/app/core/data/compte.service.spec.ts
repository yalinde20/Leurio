/*
 * US 90 : le compte anonyme est créé en silence à la fin de l'onboarding. Doubles de SOURCE_COMPTE, aucun Firebase.
 * Contrat : CompteService.assurerCompte(choix) ne rejette jamais ; réessaie à l'événement `online`.
 */
import { TestBed } from '@angular/core/testing';
import type { UserDoc } from '../firebase/user-doc';
import { OnboardingStore } from './onboarding.store';
import { CLE_PROFIL_ECRIT, CompteService, SOURCE_COMPTE, SourceCompte } from './compte.service';

const CHOIX = { niveau: 'intermediaire' as const, especesFavorites: ['BRO', 'SAN'] };

function creerSource(surcharge: Partial<SourceCompte> & { uid?: string | null } = {}) {
  const profils = new Map<string, UserDoc>();
  const appels = { connexions: 0, ecritures: 0 };
  const source: SourceCompte = {
    uidCourant: async () => surcharge.uid ?? null,
    connecterAnonymement: async () => {
      appels.connexions++;
      return 'uid-neuf';
    },
    profilExiste: async (uid) => profils.has(uid),
    ecrireProfil: async (uid, doc) => {
      appels.ecritures++;
      profils.set(uid, doc);
    },
    ...surcharge,
  };
  // `uid` n'est pas un membre de SourceCompte : on le retire de la double.
  delete (source as unknown as Record<string, unknown>)['uid'];
  return { source, profils, appels };
}

function service(source: SourceCompte): CompteService {
  TestBed.configureTestingModule({ providers: [{ provide: SOURCE_COMPTE, useValue: source }] });
  return TestBed.inject(CompteService);
}

const vider = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

describe('CompteService (US 90)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    // Détruit le service (et ses écouteurs online/visibilitychange) : les tests ne dépendent pas de l'ordre.
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it("critère 1 : given j'ai du réseau, when j'ai terminé l'onboarding, then un compte anonyme est créé et users/{uid} reçoit niveau, especesFavorites, consentements et createdAt", async () => {
    const { source, profils, appels } = creerSource();
    const avant = Date.now();

    await service(source).assurerCompte(CHOIX);

    expect(appels.connexions).toBe(1);
    const doc = profils.get('uid-neuf');
    expect(doc, 'profil écrit sous users/uid-neuf').toBeDefined();
    expect(Object.keys(doc!).sort()).toEqual(['consentements', 'createdAt', 'especesFavorites', 'niveau', 'plan']);
    expect(typeof doc!.createdAt).toBe('number');
    expect(doc!.createdAt).toBeGreaterThanOrEqual(avant);
    expect(doc!.createdAt).toBeLessThanOrEqual(Date.now());
    expect(doc!.plan).toBe('free');
  });

  it('critère 2 : given le compte anonyme est créé, when on lit users/{uid}, then niveau et especesFavorites sont ceux de la page 2 et les consentements analytics est faux et video null (jamais répondu)', async () => {
    const { source, profils } = creerSource();

    await service(source).assurerCompte(CHOIX);

    const doc = profils.get('uid-neuf');
    expect(doc?.niveau).toBe('intermediaire');
    expect(doc?.especesFavorites).toEqual(['BRO', 'SAN']);
    expect(doc?.consentements).toEqual({ analytics: false, video: null });
  });

  it("critère 3 : given je n'ai pas de réseau, when je termine l'onboarding puis que le réseau revient (événement online), then assurerCompte ne rejette pas et le compte et users/{uid} sont créés au retour", async () => {
    let enLigne = false;
    const { source, profils, appels } = creerSource({
      connecterAnonymement: async () => {
        if (!enLigne) throw new Error('auth/network-request-failed');
        return 'uid-neuf';
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const compte = service(source);

    await expect(compte.assurerCompte(CHOIX)).resolves.toBeUndefined();
    expect(profils.size, 'rien écrit hors ligne').toBe(0);

    enLigne = true;
    window.dispatchEvent(new Event('online'));
    await vider();

    expect(profils.get('uid-neuf')).toMatchObject({ niveau: 'intermediaire', especesFavorites: ['BRO', 'SAN'], plan: 'free' });
    expect(appels.ecritures).toBe(1);
  });

  it("given la création du compte échoue puis je change mes préférences (US 93), when le réseau revient, then users/{uid} est créé avec les préférences actuelles et non celles de l'onboarding", async () => {
    let enLigne = false;
    const { source, profils } = creerSource({
      connecterAnonymement: async () => {
        if (!enLigne) throw new Error('auth/network-request-failed');
        return 'uid-neuf';
      },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const compte = service(source);

    await compte.assurerCompte(CHOIX);
    TestBed.inject(OnboardingStore).terminer({ niveau: 'debutant', especesFavorites: ['PER'] });
    enLigne = true;
    window.dispatchEvent(new Event('online'));
    await vider();

    expect(profils.get('uid-neuf')).toMatchObject({ niveau: 'debutant', especesFavorites: ['PER'] });
  });

  it("critère 4 : given la création du compte échoue, when je termine l'onboarding, then assurerCompte tente la connexion, ne rejette pas (aucun message bloquant) et l'échec n'est écrit que dans la console", async () => {
    let tentatives = 0;
    const { source, profils } = creerSource({
      connecterAnonymement: async () => {
        tentatives++;
        throw new Error('auth/internal-error');
      },
    });
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(service(source).assurerCompte(CHOIX)).resolves.toBeUndefined();

    expect(tentatives).toBe(1);
    expect(profils.size).toBe(0);
    expect(erreur.mock.calls.length + avertissement.mock.calls.length, 'échec noté dans la console').toBeGreaterThan(0);
  });

  it("critère 4 : given la lecture de l'utilisateur courant échoue, when je termine l'onboarding, then assurerCompte ne rejette pas puis réessaie au retour du réseau et écrit le profil", async () => {
    let casse = true;
    const { source, profils } = creerSource({
      uidCourant: async () => {
        if (casse) throw new Error('firebase indisponible');
        return null;
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const compte = service(source);

    await expect(compte.assurerCompte(CHOIX)).resolves.toBeUndefined();
    casse = false;
    window.dispatchEvent(new Event('online'));
    await vider();

    expect(profils.get('uid-neuf')).toMatchObject({ niveau: 'intermediaire' });
  });

  it("critère 5 : given un compte anonyme existe déjà, when je relance l'app et que assurerCompte est appelé, then le même uid est utilisé et aucune nouvelle connexion n'a lieu", async () => {
    const { source, profils, appels } = creerSource({ uid: 'uid-existant' });

    await service(source).assurerCompte(CHOIX);

    expect(appels.connexions).toBe(0);
    expect(profils.has('uid-existant')).toBe(true);
    expect(profils.has('uid-neuf')).toBe(false);
  });

  it("critère 5 : given un compte et son profil existent déjà, when assurerCompte est rappelé, then le profil n'est pas écrasé", async () => {
    const { source, profils, appels } = creerSource({ uid: 'uid-existant' });
    const existant: UserDoc = {
      niveau: 'debutant',
      especesFavorites: ['TRU'],
      consentements: { analytics: true, video: true },
      createdAt: 1700000000000,
      plan: 'free',
    };
    profils.set('uid-existant', existant);

    const verifie = vi.spyOn(source, 'profilExiste');

    await service(source).assurerCompte(CHOIX);

    expect(verifie).toHaveBeenCalledWith('uid-existant');
    expect(appels.ecritures).toBe(0);
    expect(profils.get('uid-existant')).toEqual(existant);
  });

  it("given la connexion a réussi mais l'écriture du profil échoue une fois, when le réseau revient, then il n'y a qu'une connexion et le profil est écrit sous le même uid", async () => {
    let echec = true;
    const { source, profils, appels } = creerSource({
      ecrireProfil: async (uid, doc) => {
        if (echec) {
          echec = false;
          throw new Error('unavailable');
        }
        appels.ecritures++;
        profils.set(uid, doc);
      },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const compte = service(source);

    await expect(compte.assurerCompte(CHOIX)).resolves.toBeUndefined();
    window.dispatchEvent(new Event('online'));
    await vider();

    expect(appels.connexions).toBe(1);
    expect(profils.get('uid-neuf')).toMatchObject({ niveau: 'intermediaire' });
  });

  it("given le profil est écrit, when l'app est relancée avec le même uid, then aucune lecture serveur n'a lieu", async () => {
    const { source, appels } = creerSource({ uid: 'uid-existant' });
    await service(source).assurerCompte(CHOIX);
    expect(localStorage.getItem(CLE_PROFIL_ECRIT)).toBe('uid-existant');
    TestBed.resetTestingModule();

    const verifie = vi.spyOn(source, 'profilExiste');
    await service(source).assurerCompte(CHOIX);

    expect(verifie).not.toHaveBeenCalled();
    expect(appels.ecritures).toBe(1);
  });

  it("given l'app revient au premier plan après un échec, when elle devient visible, then la création est retentée", async () => {
    let casse = true;
    const { source, profils } = creerSource({
      connecterAnonymement: async () => {
        if (casse) throw new Error('auth/network-request-failed');
        return 'uid-neuf';
      },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await service(source).assurerCompte(CHOIX);
    casse = false;

    document.dispatchEvent(new Event('visibilitychange'));
    await vider();

    expect(profils.has('uid-neuf')).toBe(true);
  });

  it("given une tentative qui ne répond jamais, when 20 s s'écoulent, then elle échoue sans rejeter et une nouvelle tentative reste possible", async () => {
    vi.useFakeTimers();
    try {
      let bloque = true;
      const { source, profils } = creerSource({
        uidCourant: () => (bloque ? new Promise<string | null>(() => undefined) : Promise.resolve(null)),
      });
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const compte = service(source);

      const premiere = compte.assurerCompte(CHOIX);
      await vi.advanceTimersByTimeAsync(20_000);
      await expect(premiere).resolves.toBeUndefined();

      bloque = false;
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(10);
      expect(profils.has('uid-neuf')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
