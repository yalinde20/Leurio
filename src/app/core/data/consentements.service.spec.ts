/*
 * US 94 : le service des consentements (PLAN §4, §7, §9 bis). Il rend lisibles par le reste de l'app (US 19 Analytics, US 10 lecteur tiers)
 * les choix de `users/{uid}.consentements`.
 *
 * Interfaces attendues (à créer) :
 *  - src/app/core/data/consentements.service.ts : `ConsentementsService` (providedIn root) avec
 *      analytics(): boolean  et  video(): boolean   (signaux en lecture seule, faux tant que l'utilisateur n'a pas accepté)
 *      charger(): Promise<void>      lit users/{uid}.consentements via SOURCE_PROFIL.lireConsentements (sans compte ou sans document : tout reste faux)
 *      modifier(consentement: 'analytics' | 'video', accepte: boolean): Promise<void>
 *                                    applique tout de suite au signal, puis écrit { consentements: { analytics, video } } (les deux valeurs)
 *                                    via SOURCE_PROFIL.mettreAJour(uid, …) ; la promesse se résout à l'accusé du serveur ; sans compte : aucune écriture.
 *  - src/app/core/data/profil.service.ts : `SourceProfil` gagne
 *      lireConsentements(uid: string): Promise<{ analytics: boolean; video: boolean } | null>   (null : pas de document)
 *    et `mettreAJour` accepte aussi le champ `consentements`.
 */
import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE, SourceCompte } from './compte.service';
import { ConsentementsService } from './consentements.service';
import { SOURCE_PROFIL } from './profil.service';

interface Consentements {
  analytics: boolean;
  video: boolean;
}

function preparer(options: { uid?: string | null; stocke?: Consentements | null } = {}) {
  const uid = options.uid === undefined ? 'uid-test-123' : options.uid;
  const stocke = options.stocke === undefined ? { analytics: false, video: false } : options.stocke;
  const ecritures: { uid: string; champs: unknown }[] = [];
  const lectures: string[] = [];
  const compte: SourceCompte = {
    uidCourant: async () => uid,
    connecterAnonymement: async () => uid ?? 'uid-test-123',
    profilExiste: async () => true,
    ecrireProfil: async () => undefined,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SOURCE_COMPTE, useValue: compte },
      {
        provide: SOURCE_PROFIL,
        useValue: {
          mettreAJour: async (u: string, champs: unknown) => void ecritures.push({ uid: u, champs }),
          lireConsentements: async (u: string) => {
            lectures.push(u);
            return stocke;
          },
        },
      },
    ],
  });
  return { service: TestBed.inject(ConsentementsService), ecritures, lectures };
}

afterEach(() => TestBed.resetTestingModule());

describe('US 94 : ConsentementsService', () => {
  it('critère 2 : given « Mesure d\'audience (Analytics) » est désactivé dans users/{uid}, when l\'app lit les consentements, then analytics() est faux (Analytics ne doit pas être chargé)', async () => {
    const { service, lectures } = preparer({ stocke: { analytics: false, video: false } });
    expect(service.analytics()).toBe(false);

    await service.charger();

    expect(lectures).toEqual(['uid-test-123']);
    expect(service.analytics()).toBe(false);
    expect(service.video()).toBe(false);
  });

  it('critère 2 : given je n\'ai pas de compte ou pas de document users/{uid}, when l\'app lit les consentements, then rien n\'est accepté (analytics() et video() faux)', async () => {
    const sansCompte = preparer({ uid: null });
    await sansCompte.service.charger();
    expect(sansCompte.service.analytics()).toBe(false);
    expect(sansCompte.service.video()).toBe(false);
    expect(sansCompte.lectures).toEqual([]);
    TestBed.resetTestingModule();

    const sansDocument = preparer({ stocke: null });
    await sansDocument.service.charger();
    expect(sansDocument.service.analytics()).toBe(false);
    expect(sansDocument.service.video()).toBe(false);
  });

  it('critère 3 : given users/{uid} a analytics vrai, when l\'app lit les consentements, then analytics() est vrai et video() reste faux', async () => {
    const { service } = preparer({ stocke: { analytics: true, video: false } });

    await service.charger();

    expect(service.analytics()).toBe(true);
    expect(service.video()).toBe(false);
  });

  it('critère 3 : given analytics est refusé, when j\'accepte « Mesure d\'audience (Analytics) », then analytics() devient vrai tout de suite et users/{uid} reçoit consentements.analytics vrai (video inchangé)', async () => {
    const { service, ecritures } = preparer({ stocke: { analytics: false, video: false } });
    await service.charger();

    const fin = service.modifier('analytics', true);
    expect(service.analytics()).toBe(true);
    await fin;

    expect(ecritures).toEqual([{ uid: 'uid-test-123', champs: { consentements: { analytics: true, video: false } } }]);
    expect(service.video()).toBe(false);
  });

  it('critère 5 : given users/{uid} a video vrai, when l\'app lit les consentements, then video() est vrai (un lecteur tiers peut se charger sans redemander)', async () => {
    const { service } = preparer({ stocke: { analytics: false, video: true } });

    await service.charger();

    expect(service.video()).toBe(true);
    expect(service.analytics()).toBe(false);
  });

  it('critère 5 : given video est refusé et analytics accepté, when j\'accepte « Lecteurs vidéo tiers », then video() devient vrai et users/{uid} reçoit consentements.video vrai en gardant analytics', async () => {
    const { service, ecritures } = preparer({ stocke: { analytics: true, video: false } });
    await service.charger();

    await service.modifier('video', true);

    expect(service.video()).toBe(true);
    expect(ecritures).toEqual([{ uid: 'uid-test-123', champs: { consentements: { analytics: true, video: true } } }]);
  });

  it('critère 2 : given j\'avais accepté Analytics, when je le désactive, then analytics() redevient faux et users/{uid} reçoit faux', async () => {
    const { service, ecritures } = preparer({ stocke: { analytics: true, video: true } });
    await service.charger();

    await service.modifier('analytics', false);

    expect(service.analytics()).toBe(false);
    expect(ecritures).toEqual([{ uid: 'uid-test-123', champs: { consentements: { analytics: false, video: true } } }]);
  });

  it('critère 2 : given les signaux du service, when un autre code les regarde, then ils sont en lecture seule (seul modifier() change un consentement)', () => {
    const { service } = preparer();

    expect((service.analytics as unknown as { set?: unknown }).set).toBeUndefined();
    expect((service.video as unknown as { set?: unknown }).set).toBeUndefined();
  });

  it('critère 3 : given je n\'ai pas de compte, when j\'accepte Analytics, then le choix vaut dans l\'app mais rien n\'est écrit', async () => {
    const { service, ecritures } = preparer({ uid: null });

    await service.modifier('analytics', true);

    expect(service.analytics()).toBe(true);
    expect(ecritures).toEqual([]);
  });
});

describe('US 94 : ConsentementsService, lecture et écriture concurrentes', () => {
  function preparerDifferee(stocke: Consentements) {
    const ecritures: unknown[] = [];
    let lectures = 0;
    let finir!: () => void;
    const attente = new Promise<void>((r) => (finir = r));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SOURCE_COMPTE,
          useValue: { uidCourant: async () => 'uid-test-123', connecterAnonymement: async () => 'uid-test-123', profilExiste: async () => true, ecrireProfil: async () => undefined },
        },
        {
          provide: SOURCE_PROFIL,
          useValue: {
            mettreAJour: async (_u: string, champs: unknown) => void ecritures.push(champs),
            lireConsentements: async () => {
              lectures++;
              await attente;
              return stocke;
            },
          },
        },
      ],
    });
    return { service: TestBed.inject(ConsentementsService), ecritures, finir, lectures: () => lectures };
  }

  it('given users/{uid} vaut {vrai, vrai} et la lecture n\'est pas finie, when je change « video », then le signal montre mon choix et l\'écriture garde analytics vrai', async () => {
    const { service, ecritures, finir } = preparerDifferee({ analytics: true, video: true });

    const fin = service.modifier('video', false);
    expect(service.video()).toBe(false);
    expect(ecritures).toEqual([]);
    finir();
    await fin;

    expect(ecritures).toEqual([{ consentements: { analytics: true, video: false } }]);
    expect(service.analytics()).toBe(true);
    expect(service.video()).toBe(false);
  });

  it('given je change « analytics » pendant la lecture, when la lecture se termine, then elle n\'écrase pas mon choix', async () => {
    const { service, finir } = preparerDifferee({ analytics: true, video: true });

    const lecture = service.charger();
    void service.modifier('analytics', false);
    finir();
    await lecture;

    expect(service.analytics()).toBe(false);
    expect(service.video()).toBe(true);
  });

  it('given la lecture, when charger() est appelé deux fois, then users/{uid} n\'est lu qu\'une fois et charge() passe à vrai à la fin', async () => {
    const { service, finir, lectures } = preparerDifferee({ analytics: true, video: false });
    expect(service.charge()).toBe(false);

    const a = service.charger();
    const b = service.charger();
    finir();
    await Promise.all([a, b]);
    await service.charger();

    expect(lectures()).toBe(1);
    expect(service.charge()).toBe(true);
  });

  it('given le compte change, when charger() est rappelé, then users/{uid} est relu pour ce compte', async () => {
    let uid: string | null = 'a';
    const lus: string[] = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => uid, connecterAnonymement: async () => 'a', profilExiste: async () => true, ecrireProfil: async () => undefined } },
        { provide: SOURCE_PROFIL, useValue: { mettreAJour: async () => undefined, lireConsentements: async (u: string) => (lus.push(u), { analytics: false, video: false }) } },
      ],
    });
    const service = TestBed.inject(ConsentementsService);

    await service.charger();
    uid = 'b';
    await service.charger();

    expect(lus).toEqual(['a', 'b']);
  });

  it('given je n\'ai pas de compte, when la lecture est faite, then charge() vaut vrai et tout reste refusé', async () => {
    const { service } = preparer({ uid: null });
    await service.charger();
    expect(service.charge()).toBe(true);
    expect(service.analytics()).toBe(false);
  });
});

describe('US 94 : ConsentementsService, hors ligne sans cache', () => {
  it('given la lecture reste en attente (hors ligne, pas de cache), when je retire Analytics puis que la lecture arrive {vrai, faux}, then rien n\'est écrit avant, et l\'écriture est {faux, faux} (mon choix l\'emporte)', async () => {
    const ecritures: unknown[] = [];
    let arriver!: (c: Consentements) => void;
    TestBed.configureTestingModule({
      providers: [
        { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => 'u', connecterAnonymement: async () => 'u', profilExiste: async () => true, ecrireProfil: async () => undefined } },
        {
          provide: SOURCE_PROFIL,
          useValue: {
            mettreAJour: async (_u: string, champs: unknown) => void ecritures.push(champs),
            lireConsentements: () => new Promise<Consentements>((r) => (arriver = r)),
          },
        },
      ],
    });
    const service = TestBed.inject(ConsentementsService);

    const fin = service.modifier('analytics', false);
    await new Promise((r) => setTimeout(r, 0));
    expect(service.analytics()).toBe(false);
    expect(ecritures).toEqual([]);

    arriver({ analytics: true, video: false });
    await fin;

    expect(ecritures).toEqual([{ consentements: { analytics: false, video: false } }]);
  });

  it('given une lecture en échec, when elle échoue, then charge() reste faux et charger() peut être rappelé', async () => {
    let appels = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => 'u', connecterAnonymement: async () => 'u', profilExiste: async () => true, ecrireProfil: async () => undefined } },
        {
          provide: SOURCE_PROFIL,
          useValue: {
            mettreAJour: async () => undefined,
            lireConsentements: async () => {
              if (++appels === 1) throw new Error('hors ligne');
              return { analytics: true, video: false };
            },
          },
        },
      ],
    });
    const service = TestBed.inject(ConsentementsService);

    await expect(service.charger()).rejects.toThrow('hors ligne');
    expect(service.charge()).toBe(false);
    await service.charger();

    expect(appels).toBe(2);
    expect(service.charge()).toBe(true);
    expect(service.analytics()).toBe(true);
  });

  it('given j\'ai changé un choix avec le compte « a », when le compte devient « b », then la lecture de « b » s\'applique en entier', async () => {
    let uid = 'a';
    TestBed.configureTestingModule({
      providers: [
        { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => uid, connecterAnonymement: async () => uid, profilExiste: async () => true, ecrireProfil: async () => undefined } },
        { provide: SOURCE_PROFIL, useValue: { mettreAJour: async () => undefined, lireConsentements: async () => ({ analytics: true, video: true }) } },
      ],
    });
    const service = TestBed.inject(ConsentementsService);
    await service.modifier('analytics', false);
    expect(service.analytics()).toBe(false);

    uid = 'b';
    await service.charger();

    expect(service.analytics()).toBe(true);
    expect(service.video()).toBe(true);
  });
});
