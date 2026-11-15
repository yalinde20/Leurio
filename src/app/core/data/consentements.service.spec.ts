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
