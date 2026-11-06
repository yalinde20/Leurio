// US 62 : une demande refusée n'est pas une panne ; l'heure gardée en cache est celle de la prévision (PLAN §4).
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { ConditionsCache, INDEXED_DB, ReleveConditions } from './conditions-cache';
import { ConditionsService } from './conditions.service';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
import { TemperatureEauService } from './temperature-eau.service';
import { Lieu, WeatherProvider } from './weather-provider';

const ANGERS: Lieu = { latitude: 47.47, longitude: -0.55 };

const RELEVE: ReleveConditions = {
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
  obtenuesA: '2026-10-27T17:00:00.000Z',
};

function miseEnPlace(meteoPrevue: ReturnType<typeof vi.fn>) {
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

describe('ConditionsService, cache et pannes', () => {
  it("given une demande refusée (moment hors des 48 h) et des conditions en cache, when on demande le relevé, then la météo reste nulle et aucune mention n'est rendue", async () => {
    const { service, cache } = miseEnPlace(
      vi.fn().mockResolvedValue({ disponible: false, refusee: true, motif: 'moment hors des 48 h à venir' }),
    );
    await cache.ecrire(RELEVE);
    const releve = await service.releve({ lieu: ANGERS, moment: new Date('2026-12-30T10:00:00Z') });
    expect(releve.pressionHpa).toBeNull();
    expect(releve.conditions.nuages).toBeNull();
    expect(releve.conditions.vent).toBeNull();
    expect(releve.conditions.pressionTendance48h).toBeNull();
    expect(releve.mention).toBeUndefined();
    expect(await cache.lire()).toEqual(RELEVE);
  });

  it("given un moment à 18 h 37 (Paris) et une météo réussie, when on demande le relevé, then le cache garde l'heure de prévision arrondie", async () => {
    const { service, cache } = miseEnPlace(
      vi.fn().mockResolvedValue({
        disponible: true,
        pressionHpa: 1002,
        pressionTendance48h: { disponible: true, ecartHpa: -7 },
        couvertureNuageusePct: 85,
        ventKmh: 30,
        temperatureAirC: 9,
        heure: new Date('2026-10-28T17:00:00Z'),
      }),
    );
    await service.releve({ lieu: ANGERS, moment: new Date('2026-10-28T16:37:00Z') });
    expect((await cache.lire())?.obtenuesA).toBe('2026-10-28T17:00:00.000Z');
  });
});
