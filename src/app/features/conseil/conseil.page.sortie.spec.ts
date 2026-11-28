/*
 * US 14 : « Préparer ma sortie » depuis le Conseil. Maquette de référence : docs/maquettes/us-14-preparer-ma-sortie.html.
 *
 * Ici le vrai ConditionsService et le vrai SortieService (src/app/core/data/sortie.service.ts) tournent, avec IndexedDB
 * simulée (fake-indexeddb) ; sont doublés : WeatherProvider (meteoPrevue, previsions48h), Position, Température de l'eau,
 * Hub'Eau, Astro, Catalogue, Moteur (il enregistre les conditions reçues). Le réseau est `navigator.onLine`.
 *
 * Contrat du DOM supposé :
 *  - la carte « Conditions » (section/article/ion-card titrée « Conditions ») et le dock « Navigation » contient un `button` « Ma sortie »
 *    (actif ; « Préparation… » et désactivé pendant la préparation) ;
 *  - succès : un `[role="status"]` « Sortie prête : conditions jusqu'au 26/11 à 9 h » ;
 *  - erreurs : un `[role="alert"]` « Pas de réseau : prépare ta sortie avant de partir » ou « La préparation a échoué, réessaie » ;
 *  - hors ligne avec une sortie préparée : la carte porte « Conditions du 24/11 à 9 h » et le top 3 (3 cartes) s'affiche ;
 *  - au-delà des heures préparées : badge « Moins précis » dans la carte et « Conseil moins précis » au-dessus du top 3.
 * La feuille de choix du moment est celle de l'US 82 (voir conseil.page.moment.spec.ts).
 *
 * Temps : faux timers sur `Date`. Préparation le 24/11/2026 à 9 h Paris (08:00Z, UTC+1) : fin le 26/11 à 9 h (08:00Z).
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { IDBFactory } from 'fake-indexeddb';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsCache, INDEXED_DB, ReleveConditions } from '../../core/data/conditions-cache';
import { GeoService } from '../../core/data/geo.service';
import { HubeauService } from '../../core/data/hubeau.service';
import { MomentJourneeService } from '../../core/data/moment-journee.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { TemperatureEauService } from '../../core/data/temperature-eau.service';
import { WeatherProvider } from '../../core/data/weather-provider';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';
import { compact, ouvrirConditions, textesDesCoups } from './conseil.page.aides';
import { TuilesService } from '../../core/data/tuiles.service';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };

const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;
const PREPAREE_A = new Date('2026-11-24T08:00:00Z'); // 9 h à Paris
const MENTION_PREPARATION = 'Conditions du 24/11 à 9 h';
const MESSAGE_PRETE = "Sortie prête : conditions jusqu'au 26/11 à 9 h";
const MESSAGE_HORS_LIGNE = 'Pas de réseau : prépare ta sortie avant de partir';
const MESSAGE_ECHEC = 'La préparation a échoué, réessaie';

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

const RELEVE_EN_CACHE: ReleveConditions = {
  conditions: {
    tempEau: 11.2,
    sourceTempEau: 'capteur',
    debitTendance: 'normal',
    pressionTendance48h: -4,
    nuages: 40,
    vent: 12,
    moment: 'crépuscule',
    saison: 'automne',
    categorie: null,
    departement: '49',
    niveau: 'debutant',
  },
  pressionHpa: 1016,
  obtenuesA: '2026-10-29T17:00:00.000Z',
};

interface Reseau {
  enLigne: boolean;
  /** Ce que rend previsions48h. */
  previsions: () => Promise<unknown>;
}

interface Espions {
  previsions48h: ReturnType<typeof vi.fn>;
  appelsMoteur: { conditions: Conditions; moment: Date }[];
}

/** Installe le TestBed pour une « ouverture de l'app » : réseau, horloge et IndexedDB donnés. */
async function installer(fabrique: IDBFactory, reseau: Reseau, maintenant: Date): Promise<Espions> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(maintenant);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(reseau.enLigne);
  const previsions48h = vi.fn(() => reseau.previsions());
  const appelsMoteur: Espions['appelsMoteur'] = [];
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      { provide: TuilesService, useValue: { mettreEnCacheAutour: async () => undefined } },
      provideIonicAngular(),
      { provide: INDEXED_DB, useValue: fabrique },
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      {
        provide: CatalogService,
        useValue: {
          federation: async () => undefined,
          typesDeLeurres: async () => TYPES,
          animations: async () => ANIMATIONS,
          couleurs: async () => COULEURS,
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
          // En ligne, la météo du moment « répond » mais sans donnée : seul le mode avion nous intéresse ici.
          meteoPrevue: async () => {
            if (!reseau.enLigne) throw new Error('Failed to fetch');
            return { disponible: false };
          },
          meteoActuelle: async () => ({ disponible: false }),
          moyenneAirDerniersJours: async () => ({ disponible: false }),
        },
      },
      { provide: MomentJourneeService, useValue: { moment: () => 'jour' } },
      { provide: GeoService, useValue: { departement: () => '49' } },
      {
        provide: AstroService,
        useValue: { soleil: (_lieu: unknown, moment: Date): SoleilDuJour => soleilDu(moment), lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) },
      },
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
  return { previsions48h, appelsMoteur };
}

async function ouvrir() {
  const fixture = TestBed.createComponent(ConseilPage);
  const stabiliser = async () => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  await stabiliser();
  return { fixture, page: fixture.nativeElement as HTMLElement, stabiliser };
}

/** Ouvre l'app en ligne, touche « Ma sortie » et attend la fin ; rend la fabrique IndexedDB qui garde la sortie. */
async function preparerAvant(fabrique: IDBFactory): Promise<void> {
  await installer(fabrique, { enLigne: true, previsions: async () => previsions() }, PREPAREE_A);
  const env = await ouvrir();
  boutonPreparer(env.page).click();
  await vi.waitFor(async () => {
    await env.stabiliser();
    expect(env.page.querySelector('[role="status"]')?.textContent).toContain('Sortie prête');
  });
  env.fixture.destroy();
  TestBed.resetTestingModule();
  vi.useRealTimers();
  vi.restoreAllMocks();
}

const boutons = (racine: ParentNode): HTMLElement[] => [...racine.querySelectorAll<HTMLElement>('button, ion-button')];

/** Le texte de la température de l'eau (avec sa source et la mention datée), de l'état et des feuilles ouvertes. */
const texteCarte = (page: HTMLElement): string =>
  compact([...page.querySelectorAll<HTMLElement>('.etat, .eau, app-feuille-conseil [role="dialog"]')].map((e) => e.textContent).join(' '));
/** Les conditions complètes : celles de la feuille « Conditions », ouverte par la ligne météo. « Pression : 1027 hPa » s'y lit « Pression » puis « 1027 hPa ». */
async function texteConditions(env: { page: HTMLElement; stabiliser(): Promise<void> }): Promise<string> {
  await ouvrirConditions(env);
  return texteCarte(env.page);
}
const attendu = (ligne: string): string => compact(ligne.replace(' : ', ' '));

function boutonPreparer(page: HTMLElement): HTMLElement {
  const dock = page.querySelector('nav[aria-label="Navigation"]');
  const trouve = boutons(dock ?? page).find((b) => compact(b.textContent).startsWith(compact('Ma sortie')) || compact(b.textContent).startsWith(compact('Préparation')));
  if (!trouve) throw new Error('Aucun bouton « Ma sortie » dans le dock');
  return trouve;
}
const estDesactive = (b: HTMLElement): boolean => b.hasAttribute('disabled') || (b as HTMLButtonElement).disabled === true;

const message = (page: HTMLElement, role: 'status' | 'alert', texte: string): HTMLElement | undefined =>
  [...page.querySelectorAll<HTMLElement>(`[role="${role}"]`)].find((e) => compact(e.textContent) === compact(texte));

async function toucherEtAttendre(env: Awaited<ReturnType<typeof ouvrir>>, attendu: () => void): Promise<void> {
  boutonPreparer(env.page).click();
  await vi.waitFor(async () => {
    await env.stabiliser();
    attendu();
  });
}

// --- La feuille « Moment » de l'US 82 ---
const dansLaFeuille = (page: HTMLElement): HTMLElement => {
  const f = page.querySelector<HTMLElement>('[role="dialog"]');
  if (!f) throw new Error('La feuille « Moment du conseil » n\'est pas ouverte');
  return f;
};
const cliquable = (page: HTMLElement, texte: string): HTMLElement => {
  const trouve = [...dansLaFeuille(page).querySelectorAll<HTMLElement>('button, ion-button, [role="radio"], label')].find((e) => compact(e.textContent) === compact(texte));
  if (!trouve) throw new Error(`Aucun élément « ${texte} » dans la feuille`);
  return trouve;
};
async function choisirMoment(env: Awaited<ReturnType<typeof ouvrir>>, jour: string, heure: number): Promise<void> {
  const selecteur = boutons(env.page).find((b) => !b.closest('[role="dialog"]') && compact(b.textContent).includes('Moment'));
  if (!selecteur) throw new Error('Aucun bouton « Moment »');
  selecteur.click();
  await env.stabiliser();
  cliquable(env.page, jour).click();
  await env.stabiliser();
  const f = dansLaFeuille(env.page);
  const select = [...f.querySelectorAll<HTMLSelectElement>('select')].find((s) => {
    const parLabel = s.id ? f.querySelector(`label[for="${s.id}"]`) : null;
    return compact(s.getAttribute('aria-label') ?? parLabel?.textContent ?? s.closest('label')?.textContent ?? '').startsWith('Heure');
  });
  const option = [...(select?.options ?? [])].find((o) => compact(o.textContent) === compact(`${heure} h`));
  if (!select || !option) throw new Error(`Aucun select « Heure » avec « ${heure} h »`);
  select.value = option.value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await env.stabiliser();
  cliquable(env.page, 'Valider').click();
  await env.stabiliser();
}

const EN_LIGNE: Reseau = { enLigne: true, previsions: async () => previsions() };
const AVION: Reseau = { enLigne: false, previsions: async () => ({ disponible: false }) };

describe('ConseilPage : préparer ma sortie (US 14)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("critère 1 : given l'écran Conseil avec du réseau et un lieu choisi, when l'utilisateur touche « Ma sortie », then les prévisions des 48 h du lieu sont téléchargées et « Sortie prête : conditions jusqu'au 26/11 à 9 h » s'affiche", async () => {
    const { previsions48h } = await installer(new IDBFactory(), EN_LIGNE, PREPAREE_A);
    const env = await ouvrir();
    expect(estDesactive(boutonPreparer(env.page)), 'le bouton « Ma sortie » doit être actif').toBe(false);

    await toucherEtAttendre(env, () => expect(message(env.page, 'status', MESSAGE_PRETE), `« ${MESSAGE_PRETE} » (role=status) absent`).toBeDefined());

    expect(previsions48h).toHaveBeenCalledTimes(1);
    expect(previsions48h.mock.calls[0][0]).toEqual({ latitude: 47.47, longitude: -0.55 });
    expect(env.page.querySelector('[role="alert"]')).toBeNull();
  });

  it("critère 1 : given une préparation en cours, when elle n'est pas finie, then le bouton affiche « Préparation… » et est désactivé, puis redevient « Ma sortie » actif", async () => {
    let terminer!: () => void;
    const attente = new Promise<void>((resolve) => (terminer = resolve));
    await installer(new IDBFactory(), { enLigne: true, previsions: async () => (await attente, previsions()) }, PREPAREE_A);
    const env = await ouvrir();

    boutonPreparer(env.page).click();
    await env.stabiliser();
    expect(compact(boutonPreparer(env.page).textContent)).toBe(compact('Préparation…'));
    expect(estDesactive(boutonPreparer(env.page))).toBe(true);

    terminer();
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(compact(boutonPreparer(env.page).textContent)).toBe(compact('Ma sortie'));
    });
    expect(estDesactive(boutonPreparer(env.page))).toBe(false);
  });

  it("critère 2 : given une sortie préparée puis le mode avion, when l'utilisateur ouvre l'écran Conseil maintenant, then le top 3 s'affiche, calculé avec les conditions préparées de l'heure, avec la mention « Conditions du 24/11 à 9 h »", async () => {
    const fabrique = new IDBFactory();
    await preparerAvant(fabrique);
    const { appelsMoteur } = await installer(fabrique, AVION, new Date('2026-11-25T11:20:00Z')); // 12 h 20 Paris : heure préparée 11:00Z
    const env = await ouvrir();
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(await textesDesCoups(env)).toHaveLength(3);
    });

    expect(texteCarte(env.page)).toContain(compact(MENTION_PREPARATION));
    expect(compact(env.page.textContent)).not.toContain(compact('Moins précis'));
    expect(await texteConditions(env)).toContain(attendu('Pression : 1027 hPa'));
    expect(await texteConditions(env)).toContain(attendu('Ciel : 27 % de nuages'));
    expect(await texteConditions(env)).toContain(attendu('Vent : 32 km/h'));
    const conditions = appelsMoteur.at(-1)?.conditions;
    expect(conditions?.pressionTendance48h).toBe(7);
    expect(conditions?.nuages).toBe(27);
    expect(conditions?.vent).toBe(32);
    expect(conditions?.tempEau).toBe(10.4);
    expect(conditions?.debitTendance).toBe('crue');
  });

  it("critère 2 : given une sortie préparée puis le mode avion, when l'utilisateur choisit un moment des 48 h préparées (demain 12 h), then le top 3 s'affiche avec les conditions préparées de ce moment et la mention « Conditions du 24/11 à 9 h »", async () => {
    const fabrique = new IDBFactory();
    await preparerAvant(fabrique);
    const { appelsMoteur } = await installer(fabrique, AVION, new Date('2026-11-24T20:00:00Z'));
    const env = await ouvrir();

    await choisirMoment(env, 'Demain', 12); // 25/11 à 11:00Z
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(await textesDesCoups(env)).toHaveLength(3);
      expect(await texteConditions(env)).toContain(attendu('Pression : 1027 hPa'));
    });

    expect(texteCarte(env.page)).toContain(compact(MENTION_PREPARATION));
    expect(compact(env.page.textContent)).not.toContain(compact('Moins précis'));
    expect(appelsMoteur.at(-1)?.moment.getTime()).toBe(new Date('2026-11-25T11:00:00Z').getTime());
    expect(appelsMoteur.at(-1)?.conditions.nuages).toBe(27);
  });

  it("critère 3 : given une sortie préparée et le mode avion, when l'utilisateur choisit un moment au-delà des 48 h préparées (après-demain 12 h), then le conseil est signalé « Conseil moins précis » et la carte « Moins précis », sans météo préparée", async () => {
    const fabrique = new IDBFactory();
    await preparerAvant(fabrique);
    const { appelsMoteur } = await installer(fabrique, AVION, new Date('2026-11-24T20:00:00Z'));
    const env = await ouvrir();
    await env.fixture.whenStable();

    await choisirMoment(env, 'Après-demain', 12); // 26/11 à 11:00Z, après la fin de la sortie (08:00Z)
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(compact(env.page.textContent)).toContain(compact('Conseil moins précis'));
    });

    expect(await texteConditions(env)).toContain(compact('Moins précis'));
    expect(await textesDesCoups(env)).toHaveLength(3);
    expect(texteCarte(env.page)).not.toContain(compact(MENTION_PREPARATION));
    const conditions = appelsMoteur.at(-1)?.conditions;
    expect(conditions?.nuages).toBeNull();
    expect(conditions?.vent).toBeNull();
    expect(conditions?.pressionTendance48h).toBeNull();
    expect(conditions?.saison).toBe('automne');
  });

  it("critère 3 : given un dernier relevé en cache et une sortie préparée, when l'utilisateur choisit un moment au-delà des 48 h en mode avion, then le dernier relevé n'est pas repris", async () => {
    const fabrique = new IDBFactory();
    await preparerAvant(fabrique);
    await installer(fabrique, AVION, new Date('2026-11-24T20:00:00Z'));
    await TestBed.inject(ConditionsCache).ecrire(RELEVE_EN_CACHE);
    const env = await ouvrir();

    await choisirMoment(env, 'Après-demain', 12);
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(compact(env.page.textContent)).toContain(compact('Conseil moins précis'));
    });

    expect(texteCarte(env.page)).not.toContain(compact('Conditions du 29/10'));
    expect(await texteConditions(env)).not.toContain(attendu('Vent : 12 km/h'));
  });

  it("critère 4 : given l'appareil sans réseau, when l'utilisateur touche « Ma sortie », then rien n'est téléchargé et « Pas de réseau : prépare ta sortie avant de partir » s'affiche", async () => {
    const { previsions48h } = await installer(new IDBFactory(), AVION, PREPAREE_A);
    const env = await ouvrir();

    await toucherEtAttendre(env, () => expect(message(env.page, 'alert', MESSAGE_HORS_LIGNE), `« ${MESSAGE_HORS_LIGNE} » (role=alert) absent`).toBeDefined());

    expect(previsions48h).not.toHaveBeenCalled();
    expect(env.page.querySelector('[role="status"]')?.textContent ?? '').not.toContain('Sortie prête');
  });

  it("critère 5 : given le téléchargement des conditions qui échoue, when l'utilisateur touche « Ma sortie », then « La préparation a échoué, réessaie » s'affiche et le bouton reste actif", async () => {
    await installer(new IDBFactory(), { enLigne: true, previsions: async () => ({ disponible: false }) }, PREPAREE_A);
    const env = await ouvrir();

    await toucherEtAttendre(env, () => expect(message(env.page, 'alert', MESSAGE_ECHEC), `« ${MESSAGE_ECHEC} » (role=alert) absent`).toBeDefined());

    expect(estDesactive(boutonPreparer(env.page))).toBe(false);
    expect(env.page.textContent).not.toContain('Sortie prête');
  });

  it("critère 5 : given des conditions déjà en cache (dernier relevé et sortie préparée), when la préparation échoue, then elles sont conservées et servent toujours hors ligne", async () => {
    const fabrique = new IDBFactory();
    await preparerAvant(fabrique);
    await installer(fabrique, { enLigne: true, previsions: async () => ({ disponible: false }) }, new Date('2026-11-24T20:00:00Z'));
    await TestBed.inject(ConditionsCache).ecrire(RELEVE_EN_CACHE);
    const env = await ouvrir();
    await toucherEtAttendre(env, () => expect(message(env.page, 'alert', MESSAGE_ECHEC)).toBeDefined());
    expect(await TestBed.inject(ConditionsCache).lire()).toEqual(RELEVE_EN_CACHE);
    env.fixture.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();

    await installer(fabrique, AVION, new Date('2026-11-25T11:20:00Z'));
    const hors = await ouvrir();
    await vi.waitFor(async () => {
      await hors.stabiliser();
      expect(await textesDesCoups(hors)).toHaveLength(3);
    });
    expect(texteCarte(hors.page)).toContain(compact(MENTION_PREPARATION));
    expect(await texteConditions(hors)).toContain(attendu('Pression : 1027 hPa'));
  });

  it("critère 6 : given une sortie préparée puis l'app fermée, when l'utilisateur rouvre l'app en mode avion, then les conditions préparées sont toujours utilisées pour le conseil", async () => {
    const fabrique = new IDBFactory();
    await preparerAvant(fabrique); // l'app est fermée : plus d'injecteur ni de composant, seule IndexedDB reste
    const { appelsMoteur } = await installer(fabrique, AVION, new Date('2026-11-25T11:20:00Z'));
    const env = await ouvrir();
    await vi.waitFor(async () => {
      await env.stabiliser();
      expect(await textesDesCoups(env)).toHaveLength(3);
    });

    expect(texteCarte(env.page)).toContain(compact(MENTION_PREPARATION));
    expect(appelsMoteur.at(-1)?.conditions.vent).toBe(32);
    expect(compact(env.page.textContent)).not.toContain(compact('Conseil moins précis'));
  });
});
