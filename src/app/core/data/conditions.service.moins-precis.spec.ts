// US 63 : sans réseau ni cache, les conditions reposent sur la saison et la saisie, et sont signalées « moins précis » (PLAN §4).
import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { throwError } from 'rxjs';
import { ConditionsCache, INDEXED_DB, ReleveConditions } from './conditions-cache';
import { ConditionsService } from './conditions.service';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
import { OpenMeteoService } from './open-meteo.service';
import { TemperatureEauService } from './temperature-eau.service';
import { Lieu, WeatherProvider } from './weather-provider';

const ANGERS: Lieu = { latitude: 47.47, longitude: -0.55 };
const MOMENT = new Date('2026-11-06T12:00:00Z');
const IL_Y_A_1_H = new Date('2026-11-06T11:00:00Z');

const RELEVE_CACHE: ReleveConditions = {
  conditions: {
    tempEau: 11.2,
    sourceTempEau: 'capteur',
    debitTendance: 'normal',
    pressionTendance48h: -4,
    nuages: 40,
    vent: 12,
    moment: 'jour',
    saison: 'automne',
    categorie: null,
    departement: '49',
    niveau: 'debutant',
  },
  pressionHpa: 1016,
  obtenuesA: '2026-11-05T17:00:00.000Z',
};

/** Open-Meteo en panne : la requête échoue (rejet), ou répond « indisponible » sans refus. */
const METEO_EN_PANNE = {
  rejet: vi.fn().mockRejectedValue(new Error('Open-Meteo en panne')),
  indisponible: vi.fn().mockResolvedValue({ disponible: false }),
};

function miseEnPlaceDoublee(opts: {
  meteoPrevue: ReturnType<typeof vi.fn>;
  temperatureEauProche?: ReturnType<typeof vi.fn>;
}) {
  TestBed.configureTestingModule({
    providers: [
      { provide: INDEXED_DB, useValue: new IDBFactory() },
      {
        provide: TemperatureEauService,
        useValue: {
          temperatureEauProche:
            opts.temperatureEauProche ?? vi.fn().mockResolvedValue({ statut: "température de l'eau inconnue" }),
        },
      },
      { provide: HubeauService, useValue: { tendanceDebitProche: vi.fn().mockResolvedValue({ statut: 'aucune station' }) } },
      { provide: WeatherProvider, useValue: { meteoPrevue: opts.meteoPrevue } },
      { provide: MomentJourneeService, useValue: { moment: vi.fn().mockReturnValue('jour') } },
      { provide: GeoService, useValue: { departement: vi.fn().mockReturnValue('49') } },
    ],
  });
  return { service: TestBed.inject(ConditionsService), cache: TestBed.inject(ConditionsCache) };
}

describe('ConditionsService, conditions « moins précis » (US 63)', () => {
  it.each([
    ['la requête rejette', 'rejet'],
    ['la météo répond « indisponible »', 'indisponible'],
  ] as const)(
    'given Open-Meteo en panne (%s), aucun cache et une saisie au thermomètre de 1 h, when on demande les conditions, then elles sont moins précises, avec saison, moment, département et tempEau issus de la saisie',
    async (_nom, panne) => {
      const { service } = miseEnPlaceDoublee({ meteoPrevue: METEO_EN_PANNE[panne] });
      const releve = await service.releve({
        lieu: ANGERS,
        moment: MOMENT,
        saisieTempEau: { valeurC: 9.5, mesureeA: IL_Y_A_1_H },
      });
      expect(releve.moinsPrecis).toBe(true);
      expect(releve.mention).toBeUndefined();
      expect(releve.conditions.saison).toBe('automne');
      expect(releve.conditions.moment).toBe('jour');
      expect(releve.conditions.departement).toBe('49');
      expect(releve.conditions.tempEau).toBe(9.5);
      expect(releve.conditions.sourceTempEau).toBe('saisie');
    },
  );

  it("given Open-Meteo en panne, aucun cache, aucune saisie et Hub'Eau en panne, when on demande les conditions, then elles sont moins précises et la température de l'eau est inconnue", async () => {
    const { service } = miseEnPlaceDoublee({
      meteoPrevue: METEO_EN_PANNE.rejet,
      temperatureEauProche: vi.fn().mockResolvedValue({ statut: "température de l'eau inconnue" }),
    });
    const releve = await service.releve({ lieu: ANGERS, moment: MOMENT });
    expect(releve.moinsPrecis).toBe(true);
    expect(releve.conditions.tempEau).toBeNull();
    expect(releve.conditions.sourceTempEau).toBeNull();
  });

  it("given Open-Meteo en panne, aucun cache, aucune saisie et une station Hub'Eau active à 10 km, when on demande les conditions, then elles sont moins précises et tempEau vaut la mesure de la station", async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: INDEXED_DB, useValue: new IDBFactory() },
        {
          provide: HubeauService,
          useValue: {
            temperatureEauProche: vi.fn().mockResolvedValue({
              statut: 'mesure',
              temperatureC: 12.3,
              date: '2026-11-05',
              heure: '10:00:00',
              station: { code: 'K0000000', nom: 'La Maine à Angers' },
              distanceKm: 10,
            }),
            tendanceDebitProche: vi.fn().mockResolvedValue({ statut: 'aucune station' }),
          },
        },
        {
          provide: WeatherProvider,
          useValue: {
            meteoPrevue: vi.fn().mockRejectedValue(new Error('Open-Meteo en panne')),
            moyenneAirDerniersJours: vi.fn().mockRejectedValue(new Error('Open-Meteo en panne')),
          },
        },
        { provide: MomentJourneeService, useValue: { moment: vi.fn().mockReturnValue('jour') } },
        { provide: GeoService, useValue: { departement: vi.fn().mockReturnValue('49') } },
      ],
    });
    const releve = await TestBed.inject(ConditionsService).releve({ lieu: ANGERS, moment: MOMENT });
    expect(releve.moinsPrecis).toBe(true);
    expect(releve.conditions.tempEau).toBe(12.3);
    expect(releve.conditions.sourceTempEau).toBe('capteur');
  });

  it('given tout accès réseau bloqué et IndexedDB indisponible, when on demande les conditions, then un résultat est rendu, sans erreur non gérée, moins précis, avec saison, moment et département', async () => {
    const requetes: string[] = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: INDEXED_DB, useValue: undefined },
        provideHttpClient(
          withInterceptors([
            (req) => {
              requetes.push(req.url);
              return throwError(() => new HttpErrorResponse({ status: 0, url: req.url, statusText: 'réseau bloqué' }));
            },
          ]),
        ),
        { provide: WeatherProvider, useClass: OpenMeteoService },
      ],
    });
    const service = TestBed.inject(ConditionsService);
    const releve = await service.releve({ lieu: ANGERS, moment: MOMENT });
    expect(requetes.length).toBeGreaterThan(0);
    expect(releve.moinsPrecis).toBe(true);
    expect(releve.conditions.saison).toBe('automne');
    expect(releve.conditions.moment).toBeTruthy();
    expect(releve.conditions.departement).toBe('49');
    expect(releve.conditions.tempEau).toBeNull();
    expect(releve.conditions.sourceTempEau).toBeNull();
    expect(releve.mention).toBeUndefined();
  });

  it("given la météo qui répond, when on demande les conditions, then elles ne sont pas marquées « moins précis »", async () => {
    const { service } = miseEnPlaceDoublee({
      meteoPrevue: vi.fn().mockResolvedValue({
        disponible: true,
        pressionHpa: 1002,
        pressionTendance48h: { disponible: true, ecartHpa: -7 },
        couvertureNuageusePct: 85,
        ventKmh: 30,
        temperatureAirC: 9,
        heure: new Date('2026-11-06T12:00:00Z'),
      }),
    });
    const releve = await service.releve({ lieu: ANGERS, moment: MOMENT });
    expect(releve.moinsPrecis).toBe(false);
  });

  it("given Open-Meteo en panne et des conditions en cache, when on demande les conditions, then elles ne sont pas marquées « moins précis » et la mention du cache est rendue", async () => {
    const { service, cache } = miseEnPlaceDoublee({ meteoPrevue: METEO_EN_PANNE.rejet });
    await cache.ecrire(RELEVE_CACHE);
    const releve = await service.releve({ lieu: ANGERS, moment: MOMENT });
    expect(releve.moinsPrecis).toBe(false);
    expect(releve.mention).toBeDefined();
  });

  it("given une demande refusée par la fenêtre de prévision et aucun cache, when on demande les conditions, then elles ne sont pas marquées « moins précis »", async () => {
    const { service } = miseEnPlaceDoublee({
      meteoPrevue: vi.fn().mockResolvedValue({ disponible: false, refusee: true, motif: 'moment hors des 48 h à venir' }),
    });
    const releve = await service.releve({ lieu: ANGERS, moment: new Date('2026-12-30T10:00:00Z') });
    expect(releve.moinsPrecis).toBe(false);
  });
});
