// US 60 : réunir météo, eau, soleil, lune et département en un seul relevé `Conditions` (PLAN §4, §8.1).
// Contrat : conditions.service.ts exporte `ConditionsService` (providedIn root) avec
// `conditions(demande: DemandeConditions): Promise<Conditions>` qui ne rejette jamais.
// Il injecte TemperatureEauService, HubeauService, WeatherProvider, MomentJourneeService et GeoService,
// remplacés ici par des doubles (aucun appel réel).
import { TestBed } from '@angular/core/testing';
import { ConditionsService } from './conditions.service';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
import { TemperatureEauService } from './temperature-eau.service';
import { Lieu, WeatherProvider } from './weather-provider';

const ANGERS: Lieu = { latitude: 47.47, longitude: -0.55 };
const MAINTENANT = new Date('2026-11-06T10:00:00Z');

interface Doubles {
  tempEau?: unknown;
  debit?: unknown;
  meteo?: unknown;
  moment?: string;
  departement?: string;
}

function miseEnPlace(d: Doubles = {}) {
  const temperatureEauProche = vi.fn().mockResolvedValue(
    d.tempEau ?? {
      statut: 'connue',
      source: 'capteur',
      tempEauC: 12.3,
      station: { code: 'S1', nom: 'La Mayenne à Angers' },
      distanceKm: 12,
      date: '2026-11-05',
      heure: '09:39:42',
    },
  );
  const tendanceDebitProche = vi.fn().mockResolvedValue(
    d.debit ?? {
      statut: 'tendance',
      tendance: 'crue',
      station: { code: 'H1', nom: 'La Maine' },
      distanceKm: 5,
      debitActuelM3s: 90,
      debitMoyenM3s: 50,
      dateMesure: '2026-11-05',
    },
  );
  const meteoPrevue = vi.fn().mockResolvedValue(
    d.meteo ?? {
      disponible: true,
      heure: MAINTENANT,
      pressionHpa: 1012,
      couvertureNuageusePct: 65,
      ventKmh: 14,
      temperatureAirC: 9,
      pressionTendance48h: { disponible: true, ecartHpa: -6 },
    },
  );
  const moment = vi.fn().mockReturnValue(d.moment ?? 'jour');
  const departement = vi.fn().mockReturnValue(d.departement ?? '49');
  TestBed.configureTestingModule({
    providers: [
      { provide: TemperatureEauService, useValue: { temperatureEauProche } },
      { provide: HubeauService, useValue: { tendanceDebitProche } },
      { provide: WeatherProvider, useValue: { meteoPrevue } },
      { provide: MomentJourneeService, useValue: { moment } },
      { provide: GeoService, useValue: { departement } },
    ],
  });
  return {
    service: TestBed.inject(ConditionsService),
    temperatureEauProche,
    tendanceDebitProche,
    meteoPrevue,
    moment,
    departement,
  };
}

describe('ConditionsService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('critère 0 : given des doubles qui répondent, un lieu GPS à Angers et le moment « maintenant », when on demande les conditions, then elles contiennent tempEau, sourceTempEau, debitTendance, pressionTendance48h, nuages, vent, moment, saison, departement « 49 » et niveau', async () => {
    const m = miseEnPlace();
    const conditions = await m.service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions).toEqual({
      tempEau: 12.3,
      sourceTempEau: 'capteur',
      debitTendance: 'crue',
      pressionTendance48h: -6,
      nuages: 65,
      vent: 14,
      moment: 'jour',
      saison: 'automne',
      categorie: null,
      departement: '49',
      niveau: 'debutant',
    });
    expect(m.temperatureEauProche).toHaveBeenCalledWith(ANGERS, MAINTENANT);
    expect(m.tendanceDebitProche).toHaveBeenCalledWith(ANGERS, MAINTENANT);
    expect(m.meteoPrevue).toHaveBeenCalledWith(ANGERS, MAINTENANT);
    expect(m.moment).toHaveBeenCalledWith(ANGERS, MAINTENANT);
    expect(m.departement).toHaveBeenCalledWith(ANGERS);
  });

  it("critère 0 : given une température de l'eau estimée, when on demande les conditions, then sourceTempEau vaut « estimation »", async () => {
    const { service } = miseEnPlace({
      tempEau: {
        statut: 'connue',
        source: 'estimation',
        tempEauC: 11.1,
        moyenneAirC: 11.1,
        joursUtilises: 7,
      },
    });
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions.tempEau).toBe(11.1);
    expect(conditions.sourceTempEau).toBe('estimation');
  });

  it("critère 0 : given « température de l'eau inconnue », when on demande les conditions, then tempEau et sourceTempEau valent null", async () => {
    const { service } = miseEnPlace({ tempEau: { statut: "température de l'eau inconnue" } });
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions.tempEau).toBeNull();
    expect(conditions.sourceTempEau).toBeNull();
  });

  it('critère 0 : given la météo indisponible, when on demande les conditions, then nuages, vent et pressionTendance48h valent null et le reste est rendu', async () => {
    const { service } = miseEnPlace({ meteo: { disponible: false } });
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions).toMatchObject({
      nuages: null,
      vent: null,
      pressionTendance48h: null,
      tempEau: 12.3,
      debitTendance: 'crue',
      departement: '49',
      moment: 'jour',
    });
  });

  it('critère 0 : given une tendance de pression indisponible, when on demande les conditions, then pressionTendance48h vaut null et nuages et vent sont rendus', async () => {
    const { service } = miseEnPlace({
      meteo: {
        disponible: true,
        heure: MAINTENANT,
        pressionHpa: 1012,
        couvertureNuageusePct: 20,
        ventKmh: 8,
        temperatureAirC: 9,
        pressionTendance48h: { disponible: false },
      },
    });
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions.pressionTendance48h).toBeNull();
    expect(conditions.nuages).toBe(20);
    expect(conditions.vent).toBe(8);
  });

  it('critère 0 : given le moment de la journée rendu « crépuscule », when on demande les conditions, then moment vaut « crépuscule »', async () => {
    const { service } = miseEnPlace({ moment: 'crépuscule' });
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions.moment).toBe('crépuscule');
  });

  it('critère 0 : given un niveau intermédiaire demandé, when on demande les conditions, then niveau vaut « intermediaire »', async () => {
    const { service } = miseEnPlace();
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      niveau: 'intermediaire',
    });
    expect(conditions.niveau).toBe('intermediaire');
  });

  it('critère 0 : given le moment omis, when on demande les conditions, then « maintenant » est utilisé et tous les champs sont rendus', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T10:00:00Z'));
    const m = miseEnPlace();
    const conditions = await m.service.conditions({ lieu: ANGERS });
    for (const champ of [
      'tempEau',
      'sourceTempEau',
      'debitTendance',
      'pressionTendance48h',
      'nuages',
      'vent',
      'moment',
      'saison',
      'categorie',
      'departement',
      'niveau',
    ]) {
      expect(conditions).toHaveProperty(champ);
    }
    expect(conditions.saison).toBe('automne');
    expect(m.meteoPrevue).toHaveBeenCalledWith(ANGERS, new Date('2026-11-06T10:00:00Z'));
  });

  it('critère 1 : given un spot de 1re catégorie dans le 44, when on demande les conditions de ce spot, then categorie vaut 1 et departement est celui du spot', async () => {
    const m = miseEnPlace({ departement: '49' });
    const conditions = await m.service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      spot: { categorie: 1, departement: '44' },
    });
    expect(conditions.categorie).toBe(1);
    expect(conditions.departement).toBe('44');
    expect(m.departement).not.toHaveBeenCalled();
  });

  it('critère 1 : given un spot de 2e catégorie, when on demande les conditions de ce spot, then categorie vaut 2', async () => {
    const { service } = miseEnPlace();
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      spot: { categorie: 2, departement: '53' },
    });
    expect(conditions.categorie).toBe(2);
    expect(conditions.departement).toBe('53');
  });

  it('critère 1 : given une position GPS sans spot, when on demande les conditions, then categorie vaut null et departement vient de la géolocalisation', async () => {
    const { service } = miseEnPlace();
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions.categorie).toBeNull();
    expect(conditions.departement).toBe('49');
  });

  it('critère 2 : given le 15 janvier, when on demande les conditions, then saison vaut « hiver »', async () => {
    const { service } = miseEnPlace();
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: new Date('2027-01-15T12:00:00Z'),
    });
    expect(conditions.saison).toBe('hiver');
  });

  it('critère 2 : given le 15 juillet, when on demande les conditions, then saison vaut « été »', async () => {
    const { service } = miseEnPlace();
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: new Date('2027-07-15T12:00:00Z'),
    });
    expect(conditions.saison).toBe('été');
  });

  it("critère 3 : given l'espèce « sandre » choisie, when on demande les conditions, then especeCible vaut le code du sandre « SAN »", async () => {
    const { service } = miseEnPlace();
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      especeCible: 'SAN',
    });
    expect(conditions.especeCible).toBe('SAN');
  });

  it('critère 3 : given le choix « toutes », when on demande les conditions, then especeCible est absente', async () => {
    const { service } = miseEnPlace();
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      especeCible: 'toutes',
    });
    expect(conditions).not.toHaveProperty('especeCible');
  });

  it('critère 3 : given aucune espèce choisie, when on demande les conditions, then especeCible est absente', async () => {
    const { service } = miseEnPlace();
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions).not.toHaveProperty('especeCible');
  });

  it("critère 4 : given la tendance du débit rendue « Hub'Eau indisponible », when on demande les conditions, then les conditions sont rendues avec debitTendance « inconnu »", async () => {
    const { service } = miseEnPlace({ debit: { statut: "Hub'Eau indisponible" } });
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions).toEqual({
      tempEau: 12.3,
      sourceTempEau: 'capteur',
      debitTendance: 'inconnu',
      pressionTendance48h: -6,
      nuages: 65,
      vent: 14,
      moment: 'jour',
      saison: 'automne',
      categorie: null,
      departement: '49',
      niveau: 'debutant',
    });
  });

  it('critère 4 : given aucune station de débit, when on demande les conditions, then debitTendance vaut « inconnu »', async () => {
    const { service } = miseEnPlace({ debit: { statut: 'aucune station' } });
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions.debitTendance).toBe('inconnu');
  });
});
