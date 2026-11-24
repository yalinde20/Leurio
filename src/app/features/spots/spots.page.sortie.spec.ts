/*
 * US 15 : « Préparer ma sortie » depuis un spot. Maquette de référence : docs/maquettes/us-15-preparer-ma-sortie-spot.html.
 * PLAN §3, §4. Remplace le message « Bientôt disponible » posé par le ticket 19 (voir spots.page.conseil.spec.ts).
 *
 * Les tests passent par l'app réelle (App + routes) : onglet « Spots », tap sur une ligne, boutons, puis onglet « Conseil ».
 * Le vrai SortieService (src/app/core/data/sortie.service.ts) et le vrai ConditionsService tournent, avec IndexedDB simulée
 * (fake-indexeddb). Sont doublés : SOURCE_SPOTS, PositionService, CatalogService, WeatherProvider (previsions48h, meteoPrevue),
 * TemperatureEauService, HubeauService, MomentJourneeService, AstroService, MoteurService (il enregistre les conditions reçues).
 * Le réseau est `navigator.onLine` (mode avion = faux).
 *
 * Contrat du DOM (comme l'US 14, voir conseil.page.sortie.spec.ts) :
 *  - dans le `li` du spot ouvert, le bouton « Préparer ma sortie » appelle SortieService.preparer avec la position du spot
 *    ({ latitude: lat, longitude: lng }) ; pendant la préparation il affiche « Préparation… » et est désactivé ;
 *  - succès : un `[role="status"]` « Sortie prête : conditions jusqu'au 26/11 à 9 h » dans le `li`, après les boutons ;
 *  - erreurs : un `[role="alert"]` « Pas de réseau : prépare ta sortie avant de partir » ou « La préparation a échoué, réessaie »,
 *    dans le `li`, après les boutons ;
 *  - le message disparaît quand un autre spot s'ouvre ; « Bientôt disponible » n'existe plus ;
 *  - hors ligne avec la sortie préparée : « Voir le conseil » ouvre « Conseil » avec le spot comme lieu, la carte « Conditions »
 *    porte « Conditions du 24/11 à 9 h » et le top 3 (3 cartes) est calculé avec les heures préparées.
 *
 * Temps : faux timers sur `Date`. Préparation le 24/11/2026 à 9 h Paris (08:00Z) : fin le 26/11 à 9 h.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { IDBFactory } from 'fake-indexeddb';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, TypeLeurre } from '../../core/data/catalog.service';
import { INDEXED_DB } from '../../core/data/conditions-cache';
import { HubeauService } from '../../core/data/hubeau.service';
import { MomentJourneeService } from '../../core/data/moment-journee.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition, Spot } from '../../core/data/position.service';
import { DocumentSpot, SOURCE_SPOTS } from '../../core/data/spots.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { TemperatureEauService } from '../../core/data/temperature-eau.service';
import { WeatherProvider } from '../../core/data/weather-provider';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { TuilesService } from '../../core/data/tuiles.service';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };

const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;
const PREPAREE_A = new Date('2026-11-24T08:00:00Z'); // 9 h à Paris
const MENTION_PREPARATION = 'Conditions du 24/11 à 9 h';
const MESSAGE_PRETE = "Sortie prête : conditions jusqu'au 26/11 à 9 h";
const MESSAGE_HORS_LIGNE = 'Pas de réseau : prépare ta sortie avant de partir';
const MESSAGE_ECHEC = 'La préparation a échoué, réessaie';

const GUE: DocumentSpot = { id: 's1', data: { nom: 'Gué de la Sarthe', lat: 47.8, lng: -0.3, categorie: 2, milieu: 'riviere', departement: '49', prive: true } };
const PONT_DE_CE: DocumentSpot = { id: 's2', data: { nom: 'Pont de Cé', lat: 47.43, lng: -0.52, categorie: 2, milieu: 'riviere', departement: '49', prive: true } };

function previsions() {
  return {
    disponible: true as const,
    heures: Array.from({ length: 49 }, (_, i) => ({
      disponible: true as const,
      heure: new Date(PREPAREE_A.getTime() + i * HEURE_MS),
      pressionHpa: 1000 + i,
      pressionTendance48h: { disponible: true as const, ecartHpa: i - 20 },
      couvertureNuageusePct: i,
      ventKmh: 5 + i,
      temperatureAirC: 8,
    })),
  };
}

/** Lever 7 h 02 (Paris) et coucher 18 h 31 chaque jour : 11:00Z est toujours dans les heures légales. */
const soleilDu = (moment: Date): SoleilDuJour => {
  const jour = Math.floor(moment.getTime() / JOUR_MS) * JOUR_MS;
  return { lever: new Date(jour + 6 * HEURE_MS + 2 * 60_000), coucher: new Date(jour + 17 * HEURE_MS + 31 * 60_000) };
};

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'jig', nom: 'Jig à jupe' },
  { id: 'ver', nom: 'Ver souple finesse' },
] as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tirée-relâchée' },
  { id: 'gratte', nom: 'Gratté' },
  { id: 'dropshot', nom: 'Drop shot' },
] as Animation[];
const COULEURS = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];
const conseil = (surcharge: Partial<Conseil>): Conseil => ({
  typeId: 'shad',
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 10,
  pourquoi: ['Une phrase. Une autre.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
  ...surcharge,
});
const TOP3: ResultatConseil = {
  conseils: [
    conseil({ typeId: 'shad', techniqueId: 'tiree', score: 9 }),
    conseil({ typeId: 'jig', techniqueId: 'gratte', score: 7 }),
    conseil({ typeId: 'ver', techniqueId: 'dropshot', score: 5 }),
  ],
  explications: [],
};

interface Reseau {
  enLigne: boolean;
  /** Ce que rend previsions48h. */
  previsions: () => Promise<unknown>;
}
const EN_LIGNE: Reseau = { enLigne: true, previsions: async () => previsions() };
const AVION: Reseau = { enLigne: false, previsions: async () => ({ disponible: false }) };

/** Installe l'app pour une « ouverture » : réseau, horloge et IndexedDB donnés ; ouvre l'onglet « Spots ». */
async function ouvrirLApp(fabrique: IDBFactory, reseau: Reseau, maintenant: Date) {
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(maintenant);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(reseau.enLigne);
  const previsions48h = vi.fn((lieu: unknown) => (void lieu, reseau.previsions()));
  const appelsMoteur: { conditions: Conditions; moment: Date }[] = [];
  const spots = [GUE, PONT_DE_CE];
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      { provide: TuilesService, useValue: { mettreEnCacheAutour: async () => undefined } },
      provideIonicAngular(),
      provideRouter(routes),
      { provide: INDEXED_DB, useValue: fabrique },
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      {
        provide: SOURCE_SPOTS,
        useValue: {
          uid: async () => 'A',
          documents: async () => [...spots],
          ecouter: (_uid: string, ok: (d: DocumentSpot[]) => void) => {
            ok([...spots]);
            return () => undefined;
          },
          ajouter: async () => undefined,
        },
      },
      {
        provide: PositionService,
        useValue: {
          positionGps: async () => ANGERS,
          positionSpot: async (spot: Spot): Promise<ResultatPosition> => ({ disponible: true, source: 'spot', latitude: spot.lat, longitude: spot.lng, precisionM: null, departement: spot.departement }),
        },
      },
      {
        provide: CatalogService,
        useValue: {
          federation: async () => undefined,
          urlFederation: async () => undefined,
          typesDeLeurres: async () => TYPES,
          animations: async () => ANIMATIONS,
          couleurs: async () => COULEURS,
          especes: async () => [],
        },
      },
      {
        provide: TemperatureEauService,
        useValue: {
          temperatureEauProche: async () =>
            reseau.enLigne
              ? { statut: 'connue', tempEauC: 10.4, source: 'capteur', station: { code: '04101000', nom: 'La Maine à Angers' }, distanceKm: 4, date: '2026-11-24', heure: '06:00:00' }
              : { statut: "température de l'eau inconnue" },
        },
      },
      {
        provide: HubeauService,
        useValue: {
          tendanceDebitProche: async () =>
            reseau.enLigne
              ? { statut: 'tendance', tendance: 'crue', station: { code: '04101000', nom: 'La Maine à Angers' }, distanceKm: 4, debitActuelM3s: 90, debitMoyenM3s: 50, dateMesure: '2026-11-24' }
              : { statut: "Hub'Eau indisponible" },
        },
      },
      {
        provide: WeatherProvider,
        useValue: {
          previsions48h,
          meteoPrevue: async () => {
            if (!reseau.enLigne) throw new Error('Failed to fetch');
            return { disponible: false };
          },
          meteoActuelle: async () => ({ disponible: false }),
          moyenneAirDerniersJours: async () => ({ disponible: false }),
        },
      },
      { provide: MomentJourneeService, useValue: { moment: () => 'jour' } },
      { provide: AstroService, useValue: { soleil: (_lieu: unknown, moment: Date): SoleilDuJour => soleilDu(moment), lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async (conditions: Conditions, moment: Date): Promise<ResultatConseil> => {
            appelsMoteur.push({ conditions, moment });
            return TOP3;
          },
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(App);
  const page = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  const router = TestBed.inject(Router);
  router.setUpLocationChangeListener();
  await router.navigateByUrl('/spots');
  await stabiliser();
  return { fixture, page, router, stabiliser, previsions48h, appelsMoteur };
}
type Env = Awaited<ReturnType<typeof ouvrirLApp>>;

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');
const pageSpots = (env: Env): HTMLElement => {
  const p = env.page.querySelector<HTMLElement>('app-spots');
  if (!p) throw new Error('la page « Spots » n\'est pas affichée');
  return p;
};
const pageConseil = (env: Env): HTMLElement => {
  const p = env.page.querySelector<HTMLElement>('app-conseil');
  if (!p) throw new Error('la page « Conseil » n\'est pas affichée');
  return p;
};
function ligne(env: Env, nom: string): HTMLLIElement {
  const li = [...pageSpots(env).querySelectorAll<HTMLLIElement>('ul > li')].find((l) => compact(l.querySelector('button')?.textContent).startsWith(compact(nom)));
  if (!li) throw new Error(`aucune ligne « ${nom} »`);
  return li;
}
async function ouvrirSpot(env: Env, nom: string): Promise<HTMLLIElement> {
  ligne(env, nom).querySelector('button')!.click();
  await env.stabiliser();
  return ligne(env, nom);
}
function bouton(li: HTMLElement, debut: string): HTMLButtonElement {
  const b = [...li.querySelectorAll<HTMLButtonElement>('button')].find((x) => compact(x.textContent).startsWith(compact(debut)));
  if (!b) throw new Error(`aucun bouton « ${debut} » dans la ligne`);
  return b;
}
/** Le bouton de préparation, « Préparer ma sortie » ou « Préparation… ». */
function boutonPreparer(li: HTMLElement): HTMLButtonElement {
  const b = [...li.querySelectorAll<HTMLButtonElement>('button')].find((x) => /^Prépar/.test((x.textContent ?? '').trim()));
  if (!b) throw new Error('aucun bouton « Préparer ma sortie » dans la ligne');
  return b;
}
const message = (li: HTMLElement, role: 'status' | 'alert', texte: string): HTMLElement | undefined =>
  [...li.querySelectorAll<HTMLElement>(`[role="${role}"]`)].find((e) => compact(e.textContent) === compact(texte));
const cartesConseil = (env: Env): HTMLElement[] =>
  [...pageConseil(env).querySelectorAll<HTMLElement>('section, article, ion-card')].filter(
    (e) => compact(e.textContent).includes(compact('Animation :')) && !e.querySelector('section, article, ion-card') && !e.closest('[role="dialog"]'),
  );
const carteConditions = (env: Env): string => {
  const titre = [...pageConseil(env).querySelectorAll('h1, h2, h3, h4, h5, h6, ion-card-title')].find((t) => t.textContent?.trim() === 'Conditions');
  return compact((titre?.closest('section, article, ion-card') as HTMLElement | null)?.textContent);
};

/** Touche « Préparer ma sortie » sur « Pont de Cé » et attend que `attendu` soit vrai. */
async function preparerPontDeCe(env: Env, attendu: () => void): Promise<void> {
  const li = await ouvrirSpot(env, 'Pont de Cé');
  boutonPreparer(li).click();
  await vi.waitFor(async () => {
    await env.stabiliser();
    attendu();
  });
}

/** « Ferme l'app » : il ne reste que IndexedDB. */
function fermer(env: Env): void {
  env.fixture.destroy();
  TestBed.resetTestingModule();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
}

/** Ouvre l'app en ligne, prépare la sortie de « Pont de Cé » et ferme l'app. */
async function preparerAvant(fabrique: IDBFactory): Promise<void> {
  const env = await ouvrirLApp(fabrique, EN_LIGNE, PREPAREE_A);
  await preparerPontDeCe(env, () => expect(message(ligne(env, 'Pont de Cé'), 'status', MESSAGE_PRETE)).toBeDefined());
  fermer(env);
}

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('SpotsPage : préparer ma sortie depuis un spot (US 15)', () => {
  it("critère 1 : given le détail du spot « Pont de Cé » avec du réseau, when l'utilisateur touche « Préparer ma sortie », then les conditions des 48 h du spot sont téléchargées et « Sortie prête : conditions jusqu'au 26/11 à 9 h » s'affiche sous les boutons", async () => {
    const env = await ouvrirLApp(new IDBFactory(), EN_LIGNE, PREPAREE_A);
    const li = await ouvrirSpot(env, 'Pont de Cé');
    expect(boutonPreparer(li).disabled, 'le bouton doit être actif').toBe(false);

    boutonPreparer(li).click();
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(message(ligne(env, 'Pont de Cé'), 'status', MESSAGE_PRETE), `« ${MESSAGE_PRETE} » (role=status) absent`).toBeDefined();
    });

    expect(env.previsions48h).toHaveBeenCalledTimes(1);
    expect(env.previsions48h.mock.calls[0][0]).toEqual({ latitude: 47.43, longitude: -0.52 });
    const apres = ligne(env, 'Pont de Cé');
    const statut = message(apres, 'status', MESSAGE_PRETE)!;
    expect(bouton(apres, 'Préparer').compareDocumentPosition(statut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(apres.querySelector('[role="alert"]')).toBeNull();
    expect(env.router.url).toBe('/spots');
  });

  it('critère 1 : given une préparation en cours, when elle n\'est pas finie, then le bouton affiche « Préparation… » et est désactivé, puis redevient « Préparer ma sortie » actif', async () => {
    let terminer!: () => void;
    const attente = new Promise<void>((resolve) => (terminer = resolve));
    const env = await ouvrirLApp(new IDBFactory(), { enLigne: true, previsions: async () => (await attente, previsions()) }, PREPAREE_A);
    const li = await ouvrirSpot(env, 'Pont de Cé');

    boutonPreparer(li).click();
    await env.stabiliser();
    expect(compact(boutonPreparer(ligne(env, 'Pont de Cé')).textContent)).toBe(compact('Préparation…'));
    expect(boutonPreparer(ligne(env, 'Pont de Cé')).disabled).toBe(true);

    terminer();
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(compact(boutonPreparer(ligne(env, 'Pont de Cé')).textContent)).toBe(compact('Préparer ma sortie'));
    });
    expect(boutonPreparer(ligne(env, 'Pont de Cé')).disabled).toBe(false);
  });

  it('critère 1 : given « Sortie prête » affiché, when j\'ouvre un autre spot, then le message disparaît de la page', async () => {
    const env = await ouvrirLApp(new IDBFactory(), EN_LIGNE, PREPAREE_A);
    await preparerPontDeCe(env, () => expect(message(ligne(env, 'Pont de Cé'), 'status', MESSAGE_PRETE)).toBeDefined());

    await ouvrirSpot(env, 'Gué de la Sarthe');

    expect(compact(pageSpots(env).textContent)).not.toContain(compact('Sortie prête'));
    expect(ligne(env, 'Gué de la Sarthe').querySelector('[role="status"], [role="alert"]')).toBeNull();
  });

  it('critère 1 : given la sortie préparée pour « Pont de Cé », when je regarde la page, then « Bientôt disponible » n\'existe plus', async () => {
    const env = await ouvrirLApp(new IDBFactory(), EN_LIGNE, PREPAREE_A);
    await preparerPontDeCe(env, () => expect(message(ligne(env, 'Pont de Cé'), 'status', MESSAGE_PRETE)).toBeDefined());

    expect(compact(pageSpots(env).textContent)).not.toContain(compact('Bientôt disponible'));
  });

  it("given la préparation d'un spot en cours, when j'ouvre un autre spot, then son bouton est désactivé, toucher ne prépare rien et le résultat du premier n'apparaît pas sur le second", async () => {
    let terminer!: () => void;
    const attente = new Promise<void>((resolve) => (terminer = resolve));
    const env = await ouvrirLApp(new IDBFactory(), { enLigne: true, previsions: async () => (await attente, previsions()) }, PREPAREE_A);
    boutonPreparer(await ouvrirSpot(env, 'Pont de Cé')).click();
    await env.stabiliser();
    expect(env.previsions48h).toHaveBeenCalledTimes(1);

    const autre = await ouvrirSpot(env, 'Gué de la Sarthe');
    expect(boutonPreparer(autre).disabled).toBe(true);
    boutonPreparer(autre).click();
    await env.stabiliser();
    expect(env.previsions48h).toHaveBeenCalledTimes(1);

    terminer();
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(boutonPreparer(ligne(env, 'Gué de la Sarthe')).disabled).toBe(false);
    });
    expect(compact(pageSpots(env).textContent)).not.toContain(compact('Sortie prête'));
    expect(ligne(env, 'Gué de la Sarthe').querySelector('[role="status"], [role="alert"]')).toBeNull();
  });

  it("critère 2 : given une sortie préparée pour « Pont de Cé », puis le mode avion, when l'utilisateur touche « Voir le conseil » sur ce spot, then le top 3 s'affiche, calculé avec les conditions en cache de ce spot (« Conditions du 24/11 à 9 h »)", async () => {
    const fabrique = new IDBFactory();
    await preparerAvant(fabrique);
    const env = await ouvrirLApp(fabrique, AVION, new Date('2026-11-25T11:20:00Z')); // 12 h 20 Paris : heure préparée 11:00Z
    const li = await ouvrirSpot(env, 'Pont de Cé');

    bouton(li, 'Voir le conseil').click();
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(cartesConseil(env)).toHaveLength(3);
    });

    expect(env.router.url).toBe('/conseil');
    expect(compact(pageConseil(env).textContent)).toContain(compact('Pont de Cé'));
    expect(carteConditions(env)).toContain(compact(MENTION_PREPARATION));
    expect(carteConditions(env)).toContain(compact('Pression : 1027 hPa'));
    expect(carteConditions(env)).toContain(compact('Vent : 32 km/h'));
    expect(compact(pageConseil(env).textContent)).not.toContain(compact('Moins précis'));
    const conditions = env.appelsMoteur.at(-1)?.conditions;
    expect(conditions?.nuages).toBe(27);
    expect(conditions?.vent).toBe(32);
    expect(conditions?.pressionTendance48h).toBe(7);
    expect(conditions?.tempEau).toBe(10.4);
    expect(conditions?.debitTendance).toBe('crue');
  });

  it("critère 2 : given une sortie préparée pour « Pont de Cé », puis le mode avion, when l'utilisateur touche « Voir le conseil » sur un autre spot éloigné, then les conditions préparées de « Pont de Cé » ne sont pas utilisées", async () => {
    const fabrique = new IDBFactory();
    await preparerAvant(fabrique);
    const env = await ouvrirLApp(fabrique, AVION, new Date('2026-11-25T11:20:00Z'));
    const li = await ouvrirSpot(env, 'Gué de la Sarthe');

    bouton(li, 'Voir le conseil').click();
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(cartesConseil(env)).toHaveLength(3);
    });

    expect(compact(pageConseil(env).textContent)).toContain(compact('Gué de la Sarthe'));
    expect(carteConditions(env)).not.toContain(compact(MENTION_PREPARATION));
  });

  it("critère 3 : given le détail d'un spot sans réseau, when l'utilisateur touche « Préparer ma sortie », then rien n'est téléchargé et « Pas de réseau : prépare ta sortie avant de partir » s'affiche sous les boutons", async () => {
    const env = await ouvrirLApp(new IDBFactory(), AVION, PREPAREE_A);
    const li = await ouvrirSpot(env, 'Pont de Cé');

    boutonPreparer(li).click();
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(message(ligne(env, 'Pont de Cé'), 'alert', MESSAGE_HORS_LIGNE), `« ${MESSAGE_HORS_LIGNE} » (role=alert) absent`).toBeDefined();
    });

    const apres = ligne(env, 'Pont de Cé');
    expect(env.previsions48h).not.toHaveBeenCalled();
    expect(apres.querySelector('[role="status"]')?.textContent ?? '').not.toContain('Sortie prête');
    expect(bouton(apres, 'Préparer').compareDocumentPosition(message(apres, 'alert', MESSAGE_HORS_LIGNE)!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(boutonPreparer(apres).disabled).toBe(false);
    expect(env.router.url).toBe('/spots');
  });

  it("given le téléchargement des conditions qui échoue (réseau présent), when l'utilisateur touche « Préparer ma sortie », then « La préparation a échoué, réessaie » s'affiche et le bouton reste actif", async () => {
    const env = await ouvrirLApp(new IDBFactory(), { enLigne: true, previsions: async () => ({ disponible: false }) }, PREPAREE_A);
    await preparerPontDeCe(env, () => expect(message(ligne(env, 'Pont de Cé'), 'alert', MESSAGE_ECHEC), `« ${MESSAGE_ECHEC} » (role=alert) absent`).toBeDefined());

    expect(boutonPreparer(ligne(env, 'Pont de Cé')).disabled).toBe(false);
    expect(compact(pageSpots(env).textContent)).not.toContain(compact('Sortie prête'));
  });
});
