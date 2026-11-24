/*
 * US 14 : « Préparer ma sortie » : conditions des 48 h à venir gardées en cache (PLAN §3, §4, §11).
 * Contrats testés :
 *  - WeatherProvider.previsions48h(lieu) : Promise<{ disponible: true; heures: MeteoPrevue[] } | { disponible: false }>, ne rejette jamais.
 *  - SortieService (nouveau, root, src/app/core/data/sortie.service.ts) : preparer(lieu) rend
 *      { statut: 'prete'; jusquA: Date } | { statut: 'hors ligne' } | { statut: 'echec' }.
 *    Une seule sortie préparée, gardée dans IndexedDB (jeton INDEXED_DB) ; en préparer une autre la remplace ;
 *    un échec ne touche ni la sortie déjà préparée ni le ConditionsCache.
 *  - ConditionsService.releve : météo en panne + sortie préparée pour un lieu à moins de 1 km + moment dans les heures préparées :
 *    pression, tendance, nuages, vent de cette heure ; eau et débit préparés si les live manquent ; mention de la date de préparation.
 *    Moment au-delà des heures préparées : moinsPrecis, sans repli sur le dernier relevé du ConditionsCache.
 * Doubles : WeatherProvider, TemperatureEauService, HubeauService, MomentJourneeService, GeoService ; IndexedDB = fake-indexeddb.
 * Temps : faux timers sur `Date`. Préparation le 24/11/2026 à 9 h Paris (08:00Z, UTC+1) : fin le 26/11 à 9 h (08:00Z).
 */
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { ConditionsCache, INDEXED_DB, ReleveConditions } from './conditions-cache';
import { ConditionsService } from './conditions.service';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
import { SortieService } from './sortie.service';
import { TemperatureEauService } from './temperature-eau.service';
import { Lieu, WeatherProvider } from './weather-provider';
import { TuilesService } from './tuiles.service';

const ANGERS: Lieu = { latitude: 47.47, longitude: -0.55 };
/** À environ 550 m d'Angers. */
const PRES_D_ANGERS: Lieu = { latitude: 47.475, longitude: -0.55 };
/** À environ 100 km d'Angers. */
const NANTES: Lieu = { latitude: 47.22, longitude: -1.55 };

const HEURE_MS = 3_600_000;
const PREPAREE_A = new Date('2026-11-24T08:00:00Z'); // 9 h à Paris
const JUSQU_A = new Date('2026-11-26T08:00:00Z'); // 26/11 à 9 h
const MENTION_PREPARATION = 'Conditions du 24/11 à 9 h';

/** Une prévision par heure pleine de PREPAREE_A à PREPAREE_A + 48 h ; la valeur dépend de l'heure (n° d'heure = i). */
function previsions(depuis: Date, base = 1000) {
  return {
    disponible: true as const,
    heures: Array.from({ length: 49 }, (_, i) => ({
      disponible: true as const,
      heure: new Date(depuis.getTime() + i * HEURE_MS),
      pressionHpa: base + i,
      pressionTendance48h: { disponible: true as const, ecartHpa: i - 20 },
      couvertureNuageusePct: i,
      ventKmh: 5 + i,
      temperatureAirC: 8,
    })),
  };
}

const EAU_PREPAREE = {
  statut: 'connue' as const,
  tempEauC: 10.4,
  source: 'capteur' as const,
  station: { code: '04101000', nom: 'La Maine à Angers' },
  distanceKm: 4,
  date: '2026-11-24',
  heure: '06:00:00',
};
const DEBIT_PREPARE = {
  statut: 'tendance' as const,
  tendance: 'crue' as const,
  station: { code: '04101000', nom: 'La Maine à Angers' },
  distanceKm: 4,
  debitActuelM3s: 90,
  debitMoyenM3s: 50,
  dateMesure: '2026-11-24',
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
  /** Ce que rend previsions48h ; null = le double rejette (ne doit pas arriver) . */
  previsions: () => Promise<unknown>;
  /** Vrai : la météo du moment répond (en ligne) ; faux : elle rejette (mode avion). */
  meteoRepond: boolean;
  /** Ce que rend meteoPrevue quand la météo répond (« indisponible » par défaut). */
  meteo?: unknown;
  eau: unknown;
  debit: unknown;
}

function installer(fabrique: IDBFactory, reseau: Reseau, enLigne: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(enLigne);
  const previsions48h = vi.fn((...args: unknown[]) => {
    void args;
    return reseau.previsions();
  });
  const meteoPrevue = vi.fn(async () => {
    if (!reseau.meteoRepond) throw new Error('Failed to fetch');
    return reseau.meteo ?? { disponible: false as const };
  });
  TestBed.configureTestingModule({
    providers: [
      { provide: TuilesService, useValue: { mettreEnCacheAutour: async () => undefined } },
      { provide: INDEXED_DB, useValue: fabrique },
      { provide: TemperatureEauService, useValue: { temperatureEauProche: async () => reseau.eau } },
      { provide: HubeauService, useValue: { tendanceDebitProche: async () => reseau.debit } },
      { provide: WeatherProvider, useValue: { previsions48h, meteoPrevue } },
      { provide: MomentJourneeService, useValue: { moment: () => 'jour' } },
      { provide: GeoService, useValue: { departement: () => '49' } },
    ],
  });
  return {
    sortie: TestBed.inject(SortieService),
    conditions: TestBed.inject(ConditionsService),
    cache: TestBed.inject(ConditionsCache),
    previsions48h,
  };
}

const EN_LIGNE: () => Reseau = () => ({
  previsions: async () => previsions(PREPAREE_A),
  meteoRepond: true,
  eau: EAU_PREPAREE,
  debit: DEBIT_PREPARE,
});
const AVION: () => Reseau = () => ({
  previsions: async () => ({ disponible: false }),
  meteoRepond: false,
  eau: { statut: "température de l'eau inconnue" },
  debit: { statut: "Hub'Eau indisponible" },
});

function maintenant(date: Date): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(date);
}

/** Prépare une sortie à Angers le 24/11 à 9 h, puis rend la fabrique IndexedDB qui la garde. */
async function sortiePreparee(lieu: Lieu = ANGERS): Promise<IDBFactory> {
  const fabrique = new IDBFactory();
  maintenant(PREPAREE_A);
  const { sortie } = installer(fabrique, EN_LIGNE(), true);
  expect(await sortie.preparer(lieu)).toEqual({ statut: 'prete', jusquA: JUSQU_A });
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
  return fabrique;
}

describe('SortieService : préparer ma sortie (US 14)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('critère 1 : given du réseau et un lieu choisi, when on prépare la sortie, then les prévisions des 48 h du lieu sont téléchargées et le résultat est « prête » jusqu’à la préparation + 48 h', async () => {
    maintenant(PREPAREE_A);
    const { sortie, previsions48h } = installer(new IDBFactory(), EN_LIGNE(), true);

    const resultat = await sortie.preparer(ANGERS);

    expect(resultat).toEqual({ statut: 'prete', jusquA: JUSQU_A });
    expect(previsions48h).toHaveBeenCalledTimes(1);
    expect(previsions48h.mock.calls[0][0]).toEqual(ANGERS);
  });

  it('critère 4 : given l’appareil sans réseau, when on prépare la sortie, then rien n’est téléchargé et le résultat est « hors ligne »', async () => {
    maintenant(PREPAREE_A);
    const { sortie, previsions48h } = installer(new IDBFactory(), EN_LIGNE(), false);

    expect(await sortie.preparer(ANGERS)).toEqual({ statut: 'hors ligne' });
    expect(previsions48h).not.toHaveBeenCalled();
  });

  it('critère 4 : given l’appareil sans réseau et une sortie déjà préparée, when on prépare la sortie, then la sortie préparée est conservée', async () => {
    const fabrique = await sortiePreparee();
    maintenant(new Date('2026-11-25T06:00:00Z'));
    const { sortie, conditions } = installer(fabrique, AVION(), false);

    expect(await sortie.preparer(ANGERS)).toEqual({ statut: 'hors ligne' });

    const releve = await conditions.releve({ lieu: ANGERS, moment: new Date('2026-11-25T06:00:00Z') });
    expect(releve.mention).toBe(MENTION_PREPARATION);
  });

  it('critère 5 : given un téléchargement qui échoue (météo indisponible), when on prépare la sortie, then le résultat est « echec »', async () => {
    maintenant(PREPAREE_A);
    const reseau = EN_LIGNE();
    reseau.previsions = async () => ({ disponible: false });
    const { sortie } = installer(new IDBFactory(), reseau, true);

    expect(await sortie.preparer(ANGERS)).toEqual({ statut: 'echec' });
  });

  it('critère 5 : given des conditions en cache et un téléchargement qui échoue, when on prépare la sortie, then le dernier relevé du cache est conservé', async () => {
    maintenant(PREPAREE_A);
    const reseau = EN_LIGNE();
    reseau.previsions = async () => ({ disponible: false });
    const { sortie, cache } = installer(new IDBFactory(), reseau, true);
    await cache.ecrire(RELEVE_EN_CACHE);

    await sortie.preparer(ANGERS);

    expect(await cache.lire()).toEqual(RELEVE_EN_CACHE);
  });

  it('critère 5 : given une sortie déjà préparée et un téléchargement qui échoue, when on prépare à nouveau, then la sortie déjà préparée est conservée', async () => {
    const fabrique = await sortiePreparee();
    maintenant(new Date('2026-11-25T06:00:00Z'));
    const reseau = EN_LIGNE();
    reseau.previsions = async () => ({ disponible: false });
    const { sortie } = installer(fabrique, reseau, true);
    expect(await sortie.preparer(ANGERS)).toEqual({ statut: 'echec' });
    TestBed.resetTestingModule();

    const { conditions } = installer(fabrique, AVION(), false);
    const releve = await conditions.releve({ lieu: ANGERS, moment: new Date('2026-11-25T06:00:00Z') });
    expect(releve.mention).toBe(MENTION_PREPARATION);
    expect(releve.conditions.pressionTendance48h).toBe(22 - 20);
  });

  it('critère 1 : given une sortie déjà préparée, when on en prépare une autre, then elle remplace la précédente', async () => {
    const fabrique = await sortiePreparee(ANGERS);
    maintenant(new Date('2026-11-24T20:00:00Z')); // 24/11 à 21 h Paris
    const reseau = EN_LIGNE();
    reseau.previsions = async () => previsions(new Date('2026-11-24T20:00:00Z'), 900);
    const { sortie } = installer(fabrique, reseau, true);
    expect(await sortie.preparer(NANTES)).toEqual({ statut: 'prete', jusquA: new Date('2026-11-26T20:00:00Z') });
    TestBed.resetTestingModule();

    const { conditions } = installer(fabrique, AVION(), false);
    maintenant(new Date('2026-11-25T06:00:00Z'));
    const nantes = await conditions.releve({ lieu: NANTES, moment: new Date('2026-11-25T06:00:00Z') });
    const angers = await conditions.releve({ lieu: ANGERS, moment: new Date('2026-11-25T06:00:00Z') });
    expect(nantes.mention).toBe('Conditions du 24/11 à 21 h');
    expect(nantes.moinsPrecis).toBe(false);
    expect(angers.mention).toBeUndefined(); // la sortie d'Angers n'existe plus
  });
});

describe('ConditionsService : conditions préparées hors ligne (US 14)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('critère 2 : given une sortie préparée et le mode avion, when on demande les conditions de maintenant, then elles sont celles de l’heure préparée avec la mention « Conditions du 24/11 à 9 h »', async () => {
    const fabrique = await sortiePreparee();
    const instant = new Date('2026-11-25T06:20:00Z'); // 25/11 à 7 h 20 Paris : heure préparée 06:00Z (22e heure)
    maintenant(instant);
    const { conditions } = installer(fabrique, AVION(), false);

    const releve = await conditions.releve({ lieu: ANGERS });

    expect(releve.mention).toBe(MENTION_PREPARATION);
    expect(releve.moinsPrecis).toBe(false);
    expect(releve.pressionHpa).toBe(1022);
    expect(releve.conditions.pressionTendance48h).toBe(2);
    expect(releve.conditions.nuages).toBe(22);
    expect(releve.conditions.vent).toBe(27);
  });

  it('critère 2 : given une sortie préparée et le mode avion, when on demande les conditions de demain 7 h, then elles sont celles de l’heure préparée, eau et débit compris', async () => {
    const fabrique = await sortiePreparee();
    maintenant(PREPAREE_A);
    const { conditions } = installer(fabrique, AVION(), false);

    const releve = await conditions.releve({ lieu: ANGERS, moment: new Date('2026-11-25T06:00:00Z') });

    expect(releve.mention).toBe(MENTION_PREPARATION);
    expect(releve.moinsPrecis).toBe(false);
    expect(releve.pressionHpa).toBe(1022);
    expect(releve.conditions.tempEau).toBe(10.4);
    expect(releve.conditions.sourceTempEau).toBe('capteur');
    expect(releve.conditions.debitTendance).toBe('crue');
  });

  it('critère 2 : given une sortie préparée, when le moment est la dernière heure préparée (26/11 à 9 h), then les conditions préparées sont utilisées', async () => {
    const fabrique = await sortiePreparee();
    maintenant(PREPAREE_A);
    const { conditions } = installer(fabrique, AVION(), false);

    const releve = await conditions.releve({ lieu: ANGERS, moment: JUSQU_A });

    expect(releve.mention).toBe(MENTION_PREPARATION);
    expect(releve.moinsPrecis).toBe(false);
    expect(releve.pressionHpa).toBe(1048);
  });

  it('critère 2 : given une sortie préparée pour un lieu à moins de 1 km, when on demande les conditions de ce lieu proche en mode avion, then la sortie préparée est utilisée', async () => {
    const fabrique = await sortiePreparee();
    maintenant(PREPAREE_A);
    const { conditions } = installer(fabrique, AVION(), false);

    const releve = await conditions.releve({ lieu: PRES_D_ANGERS, moment: new Date('2026-11-25T06:00:00Z') });

    expect(releve.mention).toBe(MENTION_PREPARATION);
    expect(releve.pressionHpa).toBe(1022);
  });

  it('critère 2 : given une saisie au thermomètre récente, when on demande les conditions préparées, then la saisie reste prioritaire sur l’eau préparée', async () => {
    const fabrique = await sortiePreparee();
    maintenant(PREPAREE_A);
    const { conditions } = installer(fabrique, AVION(), false);

    const releve = await conditions.releve({
      lieu: ANGERS,
      moment: new Date('2026-11-25T06:00:00Z'),
      saisieTempEau: { valeurC: 7.5, mesureeA: new Date('2026-11-25T05:00:00Z') },
    });

    expect(releve.conditions.tempEau).toBe(7.5);
    expect(releve.conditions.sourceTempEau).toBe('saisie');
    expect(releve.pressionHpa).toBe(1022);
  });

  it('critère 3 : given une sortie préparée et le mode avion, when le moment est au-delà des 48 h préparées, then le conseil est « moins précis » : saison et saisie seulement, sans la météo préparée', async () => {
    const fabrique = await sortiePreparee();
    maintenant(PREPAREE_A);
    const { conditions } = installer(fabrique, AVION(), false);

    const releve = await conditions.releve({ lieu: ANGERS, moment: new Date('2026-11-27T08:00:00Z') });

    expect(releve.moinsPrecis).toBe(true);
    expect(releve.mention).toBeUndefined();
    expect(releve.pressionHpa).toBeNull();
    expect(releve.conditions.pressionTendance48h).toBeNull();
    expect(releve.conditions.nuages).toBeNull();
    expect(releve.conditions.vent).toBeNull();
    expect(releve.conditions.saison).toBe('automne');
  });

  it('critère 3 : given une sortie préparée et un relevé plus ancien dans le cache, when le moment est au-delà des 48 h préparées, then le dernier relevé du cache n’est pas repris', async () => {
    const fabrique = await sortiePreparee();
    maintenant(PREPAREE_A);
    const { conditions, cache } = installer(fabrique, AVION(), false);
    await cache.ecrire(RELEVE_EN_CACHE);

    const releve = await conditions.releve({ lieu: ANGERS, moment: new Date('2026-11-27T08:00:00Z') });

    expect(releve.moinsPrecis).toBe(true);
    expect(releve.mention).toBeUndefined();
    expect(releve.conditions.nuages).toBeNull();
    expect(releve.pressionHpa).toBeNull();
  });

  it('critère 3 : given une sortie préparée et la saisie d’un thermomètre récente, when le moment est au-delà des 48 h, then la température saisie est utilisée', async () => {
    const fabrique = await sortiePreparee();
    maintenant(PREPAREE_A);
    const { conditions } = installer(fabrique, AVION(), false);

    const releve = await conditions.releve({
      lieu: ANGERS,
      moment: new Date('2026-11-27T08:00:00Z'),
      saisieTempEau: { valeurC: 7.5, mesureeA: new Date('2026-11-27T06:00:00Z') },
    });

    expect(releve.moinsPrecis).toBe(true);
    expect(releve.conditions.tempEau).toBe(7.5);
  });

  it('critère 2 (contraire) : given une sortie préparée pour un autre lieu (à 100 km), when on demande les conditions en mode avion, then le comportement existant (dernier relevé du cache) est inchangé', async () => {
    const fabrique = await sortiePreparee(NANTES);
    maintenant(PREPAREE_A);
    const { conditions, cache } = installer(fabrique, AVION(), false);
    await cache.ecrire(RELEVE_EN_CACHE);

    const releve = await conditions.releve({ lieu: ANGERS, moment: new Date('2026-11-25T06:00:00Z') });

    expect(releve.mention).toBe('Conditions du 29/10 à 18 h');
    expect(releve.pressionHpa).toBe(1016);
    expect(releve.conditions.nuages).toBe(40);
  });

  it('critère 2 (contraire) : given une sortie préparée et la météo qui répond, when on demande les conditions, then les conditions sont celles de la météo en direct, sans mention', async () => {
    const fabrique = await sortiePreparee();
    maintenant(PREPAREE_A);
    const reseau = EN_LIGNE();
    reseau.meteo = {
      disponible: true,
      pressionHpa: 990,
      pressionTendance48h: { disponible: true, ecartHpa: -9 },
      couvertureNuageusePct: 99,
      ventKmh: 1,
      temperatureAirC: 5,
      heure: PREPAREE_A,
    };
    const { conditions } = installer(fabrique, reseau, true);

    const releve = await conditions.releve({ lieu: ANGERS });

    expect(releve.pressionHpa).toBe(990);
    expect(releve.mention).toBeUndefined();
    expect(releve.moinsPrecis).toBe(false);
  });

  it('critère 6 : given une sortie préparée puis l’app fermée, when l’app est rouverte en mode avion (nouvelle instance des services, même IndexedDB), then les conditions préparées sont toujours utilisées', async () => {
    const fabrique = await sortiePreparee();
    // « Fermer l'app » : sortiePreparee a déjà détruit l'injecteur ; on en recrée un neuf, sans rien d'autre en commun que IndexedDB.
    maintenant(new Date('2026-11-25T06:20:00Z'));
    const { conditions } = installer(fabrique, AVION(), false);

    const releve = await conditions.releve({ lieu: ANGERS });

    expect(releve.mention).toBe(MENTION_PREPARATION);
    expect(releve.moinsPrecis).toBe(false);
    expect(releve.pressionHpa).toBe(1022);
  });
});
