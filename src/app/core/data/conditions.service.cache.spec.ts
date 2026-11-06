// US 62 : retrouver les dernières conditions connues quand Open-Meteo ne répond pas (PLAN §4, §8.2).
// Le vrai ConditionsCache tourne sur fake-indexeddb ; Open-Meteo, Hub'Eau et l'eau sont des doubles.
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

const RELEVE_27_10: ReleveConditions = {
  conditions: {
    tempEau: 11.2,
    sourceTempEau: 'capteur',
    debitTendance: 'stable',
    pressionTendance48h: -4,
    nuages: 40,
    vent: 12,
    moment: 'soir',
    saison: 'automne',
    categorie: null,
    departement: '49',
    niveau: 'debutant',
  },
  pressionHpa: 1016,
  obtenuesA: '2026-10-27T17:00:00.000Z', // 18 h à Paris
};

const METEO_REUSSIE = {
  disponible: true,
  pressionHpa: 1002,
  pressionTendance48h: { disponible: true, ecartHpa: -7 },
  couvertureNuageusePct: 85,
  ventKmh: 30,
  temperatureAirC: 9,
  heure: new Date('2026-10-28T08:00:00Z'),
};

function miseEnPlace(meteoPrevue: ReturnType<typeof vi.fn>, eau: unknown = { statut: "température de l'eau inconnue" }) {
  const fabrique = new IDBFactory();
  TestBed.configureTestingModule({
    providers: [
      { provide: INDEXED_DB, useValue: fabrique },
      { provide: TemperatureEauService, useValue: { temperatureEauProche: vi.fn().mockResolvedValue(eau) } },
      { provide: HubeauService, useValue: { tendanceDebitProche: vi.fn().mockResolvedValue({ statut: 'aucune station' }) } },
      { provide: WeatherProvider, useValue: { meteoPrevue } },
      { provide: MomentJourneeService, useValue: { moment: vi.fn().mockReturnValue('jour') } },
      { provide: GeoService, useValue: { departement: vi.fn().mockReturnValue('49') } },
    ],
  });
  return { service: TestBed.inject(ConditionsService), cache: TestBed.inject(ConditionsCache) };
}

const enPanne = () => vi.fn().mockResolvedValue({ disponible: false });

describe('ConditionsService, cache des dernières conditions', () => {
  it('critère 1 : given Open-Meteo en panne et des conditions en cache du 27/10 à 18 h, when on demande les conditions, then pression, tendance, nuages et vent sont ceux du cache avec la mention « Conditions du 27/10 à 18 h »', async () => {
    const { service, cache } = miseEnPlace(enPanne());
    await cache.ecrire(RELEVE_27_10);
    const releve = await service.releve({ lieu: ANGERS, moment: new Date('2026-10-30T10:00:00Z') });
    expect(releve.pressionHpa).toBe(1016);
    expect(releve.conditions.pressionTendance48h).toBe(-4);
    expect(releve.conditions.nuages).toBe(40);
    expect(releve.conditions.vent).toBe(12);
    expect(releve.mention).toBe('Conditions du 27/10 à 18 h');
  });

  it('critère 1 : given Open-Meteo qui rejette et un cache du 27/10, when on demande les conditions, then le cache est utilisé de la même façon', async () => {
    const { service, cache } = miseEnPlace(vi.fn().mockRejectedValue(new Error('panne')));
    await cache.ecrire(RELEVE_27_10);
    const releve = await service.releve({ lieu: ANGERS, moment: new Date('2026-10-30T10:00:00Z') });
    expect(releve.conditions.vent).toBe(12);
    expect(releve.mention).toBe('Conditions du 27/10 à 18 h');
  });

  it('critère 1 : given un cache obtenu à 18 h 30, when Open-Meteo est en panne, then la mention indique « à 18 h 30 »', async () => {
    const { service, cache } = miseEnPlace(enPanne());
    await cache.ecrire({ ...RELEVE_27_10, obtenuesA: '2026-10-27T17:30:00.000Z' });
    const releve = await service.releve({ lieu: ANGERS, moment: new Date('2026-10-30T10:00:00Z') });
    expect(releve.mention).toBe('Conditions du 27/10 à 18 h 30');
  });

  it('critère 1 : given un cache, when Open-Meteo est en panne, then moment, saison et département sont recalculés et le cache n\'est pas modifié', async () => {
    const { service, cache } = miseEnPlace(enPanne());
    await cache.ecrire(RELEVE_27_10);
    const releve = await service.releve({
      lieu: ANGERS,
      moment: new Date('2027-01-15T10:00:00Z'),
      spot: { categorie: 2, departement: '53' },
    });
    expect(releve.conditions.moment).toBe('jour');
    expect(releve.conditions.saison).toBe('hiver');
    expect(releve.conditions.departement).toBe('53');
    expect(releve.conditions.categorie).toBe(2);
    expect(await cache.lire()).toEqual(RELEVE_27_10);
  });

  it('critère 1 : given Open-Meteo en panne et aucun cache, when on demande les conditions, then pression, nuages et vent sont nuls et il n\'y a pas de mention', async () => {
    const { service } = miseEnPlace(enPanne());
    const releve = await service.releve({ lieu: ANGERS, moment: new Date('2026-10-30T10:00:00Z') });
    expect(releve.pressionHpa).toBeNull();
    expect(releve.conditions.pressionTendance48h).toBeNull();
    expect(releve.conditions.nuages).toBeNull();
    expect(releve.conditions.vent).toBeNull();
    expect(releve.mention).toBeUndefined();
  });

  it('critère 1 : given Open-Meteo en panne et un cache, when on appelle conditions(), then elle rend les conditions du relevé', async () => {
    const { service, cache } = miseEnPlace(enPanne());
    await cache.ecrire(RELEVE_27_10);
    const demande = { lieu: ANGERS, moment: new Date('2026-10-30T10:00:00Z') };
    expect(await service.conditions(demande)).toEqual((await service.releve(demande)).conditions);
    expect((await service.conditions(demande)).nuages).toBe(40);
  });

  it('critère 2 : given des conditions en cache du 27/10 et un nouvel appel réussi le 28/10 à 9 h, when on relit le cache, then il contient les conditions du 28/10 à 9 h', async () => {
    const { service, cache } = miseEnPlace(vi.fn().mockResolvedValue(METEO_REUSSIE));
    await cache.ecrire(RELEVE_27_10);
    const releve = await service.releve({ lieu: ANGERS, moment: new Date('2026-10-28T08:00:00Z') });
    expect(releve.mention).toBeUndefined();
    const enCache = await cache.lire();
    expect(enCache?.obtenuesA).toBe('2026-10-28T08:00:00.000Z');
    expect(enCache?.pressionHpa).toBe(1002);
    expect(enCache?.conditions.pressionTendance48h).toBe(-7);
    expect(enCache?.conditions.nuages).toBe(85);
    expect(enCache?.conditions.vent).toBe(30);
    expect(enCache?.conditions).toEqual(releve.conditions);
  });

  it('critère 3 : given Open-Meteo en panne, des conditions en cache et une saisie au thermomètre de moins de 6 h, when on demande les conditions, then tempEau vaut la saisie et sourceTempEau vaut « saisie »', async () => {
    const { service, cache } = miseEnPlace(enPanne());
    await cache.ecrire(RELEVE_27_10);
    const releve = await service.releve({
      lieu: ANGERS,
      moment: new Date('2026-10-30T10:00:00Z'),
      saisieTempEau: { valeurC: 14.5, mesureeA: new Date('2026-10-30T08:00:00Z') },
    });
    expect(releve.conditions.tempEau).toBe(14.5);
    expect(releve.conditions.sourceTempEau).toBe('saisie');
    expect(releve.conditions.nuages).toBe(40);
    expect(releve.mention).toBe('Conditions du 27/10 à 18 h');
  });
});
