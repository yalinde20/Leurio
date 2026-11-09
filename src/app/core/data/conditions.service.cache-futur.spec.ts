// US 82 : une prévision pour un moment futur ne doit pas devenir le « dernier relevé » du cache (PLAN §4).
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { ConditionsCache, INDEXED_DB } from './conditions-cache';
import { ConditionsService } from './conditions.service';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
import { TemperatureEauService } from './temperature-eau.service';
import { Lieu, WeatherProvider } from './weather-provider';

const ANGERS: Lieu = { latitude: 47.47, longitude: -0.55 };
const MAINTENANT = new Date('2026-11-09T13:20:00Z');

function miseEnPlace() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  const meteoPrevue = vi.fn().mockImplementation(async (_lieu: Lieu, moment: Date) => ({
    disponible: true,
    pressionHpa: 1002,
    pressionTendance48h: { disponible: true, ecartHpa: -7 },
    couvertureNuageusePct: 85,
    ventKmh: 30,
    temperatureAirC: 9,
    heure: moment,
  }));
  TestBed.configureTestingModule({
    providers: [
      { provide: INDEXED_DB, useValue: new IDBFactory() },
      { provide: TemperatureEauService, useValue: { temperatureEauProche: vi.fn().mockResolvedValue({ statut: "température de l'eau inconnue" }) } },
      { provide: HubeauService, useValue: { tendanceDebitProche: vi.fn().mockResolvedValue({ statut: 'aucune station' }) } },
      { provide: WeatherProvider, useValue: { meteoPrevue } },
      { provide: MomentJourneeService, useValue: { moment: vi.fn().mockReturnValue('jour') } },
      { provide: GeoService, useValue: { departement: vi.fn().mockReturnValue('49') } },
    ],
  });
  return { service: TestBed.inject(ConditionsService), cache: TestBed.inject(ConditionsCache) };
}

describe('ConditionsService, cache et moment futur (US 82)', () => {
  afterEach(() => vi.useRealTimers());

  it("given un moment futur (demain 7 h), when la météo répond, then le cache n'est pas écrit", async () => {
    const { service, cache } = miseEnPlace();
    await service.releve({ lieu: ANGERS, moment: new Date('2026-11-10T06:00:00Z') });
    expect(await cache.lire()).toBeNull();
  });

  it("given le moment présent, when la météo répond, then le cache est écrit", async () => {
    const { service, cache } = miseEnPlace();
    await service.releve({ lieu: ANGERS, moment: MAINTENANT });
    expect((await cache.lire())?.obtenuesA).toBe(MAINTENANT.toISOString());
  });

  it("given aucun moment, when la météo répond, then le cache est écrit", async () => {
    const { service, cache } = miseEnPlace();
    await service.releve({ lieu: ANGERS });
    expect(await cache.lire()).not.toBeNull();
  });
});
