/*
 * US 19 : Analytics seulement après consentement (PLAN §4, §7 users/{uid}.consentements.analytics).
 *
 * Interfaces attendues (à créer) :
 *  - src/app/core/firebase/mesure-audience.ts : `PortAnalytics` { initialiser, envoyer(nom, parametres), desactiver } et le jeton `ANALYTICS`.
 *  - src/app/core/data/mesure-audience.service.ts : `MesureAudienceService` avec `demarrer(): void` et `envoyer(nom, parametres?): void`
 *    (l'événement est abandonné sans consentement chargé et accepté ; latitude, longitude et valeurs non primitives sont retirées).
 */
import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE, SourceCompte } from './compte.service';
import { ConsentementsService } from './consentements.service';
import { MesureAudienceService } from './mesure-audience.service';
import { SOURCE_PROFIL } from './profil.service';
import { ANALYTICS, PortAnalytics } from '../firebase/mesure-audience';

function preparer(options: { stocke?: { analytics: boolean; video: boolean } | null } = {}) {
  let stocke = options.stocke === undefined ? null : options.stocke;
  const appels: string[] = [];
  const evenements: { nom: string; parametres: Record<string, unknown> }[] = [];
  const port: PortAnalytics = {
    initialiser: async () => void appels.push('initialiser'),
    envoyer: async (nom, parametres) => void evenements.push({ nom, parametres }),
    desactiver: async () => void appels.push('desactiver'),
  };
  const compte: SourceCompte = {
    uidCourant: async () => 'uid-test-123',
    connecterAnonymement: async () => 'uid-test-123',
    profilExiste: async () => true,
    ecrireProfil: async () => undefined,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SOURCE_COMPTE, useValue: compte },
      {
        provide: SOURCE_PROFIL,
        useValue: {
          mettreAJour: async (_u: string, champs: { consentements: { analytics: boolean; video: boolean } }) => {
            stocke = champs.consentements;
          },
          lireConsentements: async () => stocke,
        },
      },
      { provide: ANALYTICS, useValue: port },
    ],
  });
  return {
    mesure: TestBed.inject(MesureAudienceService),
    consentements: TestBed.inject(ConsentementsService),
    appels,
    evenements,
  };
}

const attendre = () => new Promise<void>((r) => setTimeout(r, 10));

afterEach(() => TestBed.resetTestingModule());

describe('US 19 : MesureAudienceService', () => {
  it('US 19 critère 1 : given un utilisateur qui n\'a pas encore répondu, when il utilise l\'app, then Analytics n\'est jamais initialisé et aucun événement n\'est envoyé', async () => {
    const { mesure, consentements, appels, evenements } = preparer({ stocke: null });
    mesure.demarrer();
    await consentements.charger();
    mesure.envoyer('screen_view', { page: '/' });
    await attendre();
    expect(appels).toEqual([]);
    expect(evenements).toEqual([]);
  });

  it('US 19 critère 1 : given un utilisateur qui a refusé, when il utilise l\'app, then Analytics n\'est jamais initialisé et aucun événement n\'est envoyé', async () => {
    const { mesure, consentements, appels, evenements } = preparer({ stocke: { analytics: false, video: false } });
    mesure.demarrer();
    await consentements.charger();
    mesure.envoyer('screen_view', { page: '/' });
    await attendre();
    expect(appels).toEqual([]);
    expect(evenements).toEqual([]);
  });

  it('US 19 critère 1 : given un consentement pas encore lu, when un événement est émis puis le consentement lu à refusé, then l\'événement est abandonné et jamais envoyé plus tard', async () => {
    const { mesure, consentements, evenements, appels } = preparer({ stocke: { analytics: false, video: false } });
    mesure.envoyer('screen_view', { page: '/' });
    mesure.demarrer();
    await consentements.charger();
    await attendre();
    expect(evenements).toEqual([]);
    expect(appels).toEqual([]);
  });

  it('US 19 critère 2 : given un utilisateur qui accepte Analytics, when il continue d\'utiliser l\'app, then Analytics est initialisé une fois et les événements sont envoyés', async () => {
    const { mesure, consentements, appels, evenements } = preparer({ stocke: { analytics: false, video: false } });
    mesure.demarrer();
    await consentements.charger();
    await consentements.modifier('analytics', true);
    await vi.waitFor(() => expect(appels).toEqual(['initialiser']));
    mesure.envoyer('screen_view', { page: '/compte' });
    await vi.waitFor(() => expect(evenements).toEqual([{ nom: 'screen_view', parametres: { page: '/compte' } }]));
    expect(appels).toEqual(['initialiser']);
  });

  it('US 19 critère 3 : given un utilisateur qui avait accepté, when il retire son consentement, then Analytics est désactivé et plus aucun événement n\'est envoyé', async () => {
    const { mesure, consentements, appels, evenements } = preparer({ stocke: { analytics: true, video: false } });
    mesure.demarrer();
    await vi.waitFor(() => expect(appels).toEqual(['initialiser']));
    await consentements.modifier('analytics', false);
    await vi.waitFor(() => expect(appels).toEqual(['initialiser', 'desactiver']));
    mesure.envoyer('screen_view', { page: '/' });
    await attendre();
    expect(evenements).toEqual([]);
  });

  it('US 19 critère 3 : given un consentement retiré et écrit, when l\'app est relancée, then Analytics n\'est jamais initialisé', async () => {
    const premier = preparer({ stocke: { analytics: true, video: false } });
    premier.mesure.demarrer();
    await vi.waitFor(() => expect(premier.appels).toEqual(['initialiser']));
    await premier.consentements.modifier('analytics', false);
    // Le stockage simulé garde l'écriture ; on relance avec un nouveau TestBed lisant la même valeur.
    TestBed.resetTestingModule();
    const relance = preparer({ stocke: { analytics: false, video: false } });
    relance.mesure.demarrer();
    await relance.consentements.charger();
    relance.mesure.envoyer('screen_view', { page: '/' });
    await attendre();
    expect(relance.appels).toEqual([]);
    expect(relance.evenements).toEqual([]);
  });

  it('US 19 critère 4 : given Analytics accepté, when un événement porte latitude, longitude, position ou un objet, then il n\'en contient aucune', async () => {
    const { mesure, appels, evenements } = preparer({ stocke: { analytics: true, video: false } });
    mesure.demarrer();
    await vi.waitFor(() => expect(appels).toEqual(['initialiser']));
    mesure.envoyer('position_obtenue', {
      departement: '49',
      lat: 47.43,
      lng: -0.52,
      latitude: 47.43,
      longitude: -0.52,
      lon: -0.52,
      coords: 'x',
      position: { lat: 47.43, lng: -0.52 },
      liste: [47.43, -0.52],
      precision: 12,
      ok: true,
    });
    await vi.waitFor(() => expect(evenements).toHaveLength(1));
    expect(evenements[0]).toEqual({ nom: 'position_obtenue', parametres: { departement: '49', precision: 12, ok: true } });
  });
});
