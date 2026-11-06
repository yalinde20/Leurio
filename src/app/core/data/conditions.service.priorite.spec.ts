// US 61 : choisir la température de l'eau par priorité (PLAN §4, §8.2) :
// 1. saisie au thermomètre de moins de 6 h, 2. station Hub'Eau active à moins de 30 km (capteur), 3. estimation depuis l'air.
// Contrat : `DemandeConditions` gagne `saisieTempEau?: { valeurC: number; mesureeA: Date }`. Une saisie dont l'âge
// (moment − mesureeA) est dans [0, 6 h[ donne tempEau = valeurC et sourceTempEau = « saisie » ; sinon le comportement
// de TemperatureEauService (capteur, sinon estimation, sinon null) est inchangé.
// Ici le vrai TemperatureEauService est branché sur des doubles de HubeauService et de WeatherProvider :
// toute la chaîne de priorité est exercée, sans appel réel.
import { TestBed } from '@angular/core/testing';
import { ConditionsService } from './conditions.service';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
import { Lieu, WeatherProvider } from './weather-provider';

const ANGERS: Lieu = { latitude: 47.47, longitude: -0.55 };
const MAINTENANT = new Date('2026-11-06T10:00:00Z');

const IL_Y_A_2H = new Date('2026-11-06T08:00:00Z');
const IL_Y_A_7H = new Date('2026-11-06T03:00:00Z');
const IL_Y_A_6H = new Date('2026-11-06T04:00:00Z');
const IL_Y_A_5H59 = new Date('2026-11-06T04:01:00Z');

const STATION_A_10_KM = {
  statut: 'mesure',
  temperatureC: 11.2,
  date: '2026-11-06',
  heure: '09:40:00',
  station: { code: 'S1', nom: 'La Mayenne à Angers' },
  distanceKm: 10,
};

type ReponseHubeau = typeof STATION_A_10_KM | { statut: "Hub'Eau indisponible" } | { statut: 'aucune station' };

function miseEnPlace(hubeauEau: ReponseHubeau, moyenneAir: unknown = { disponible: true, moyenneC: 9.6, joursUtilises: 7 }) {
  const temperatureEauProche = vi.fn().mockResolvedValue(hubeauEau);
  const tendanceDebitProche = vi.fn().mockResolvedValue({ statut: "Hub'Eau indisponible" });
  const moyenneAirDerniersJours = vi.fn().mockResolvedValue(moyenneAir);
  const meteoPrevue = vi.fn().mockResolvedValue({ disponible: false });
  TestBed.configureTestingModule({
    providers: [
      // TemperatureEauService n'est pas remplacé : c'est le vrai, branché sur les doubles ci-dessous.
      { provide: HubeauService, useValue: { temperatureEauProche, tendanceDebitProche } },
      { provide: WeatherProvider, useValue: { moyenneAirDerniersJours, meteoPrevue } },
      { provide: MomentJourneeService, useValue: { moment: vi.fn().mockReturnValue('jour') } },
      { provide: GeoService, useValue: { departement: vi.fn().mockReturnValue('49') } },
    ],
  });
  return { service: TestBed.inject(ConditionsService) };
}

describe('ConditionsService : priorité de la température de l\'eau', () => {
  it("critère 0 : given une température saisie au thermomètre il y a 2 h et une station Hub'Eau active à 10 km, when on demande les conditions, then tempEau vaut la saisie et sourceTempEau vaut « saisie »", async () => {
    const { service } = miseEnPlace(STATION_A_10_KM);
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      saisieTempEau: { valeurC: 14.5, mesureeA: IL_Y_A_2H },
    });
    expect(conditions.tempEau).toBe(14.5);
    expect(conditions.sourceTempEau).toBe('saisie');
  });

  it("critère 0 : given une saisie vieille de 5 h 59 min et une station active à 10 km, when on demande les conditions, then la saisie, encore valable, l'emporte", async () => {
    const { service } = miseEnPlace(STATION_A_10_KM);
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      saisieTempEau: { valeurC: 14.5, mesureeA: IL_Y_A_5H59 },
    });
    expect(conditions.tempEau).toBe(14.5);
    expect(conditions.sourceTempEau).toBe('saisie');
  });

  it("critère 0 : given une saisie récente et aucune station ni moyenne de l'air, when on demande les conditions, then la saisie est quand même retenue", async () => {
    const { service } = miseEnPlace({ statut: "Hub'Eau indisponible" }, { disponible: false });
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      saisieTempEau: { valeurC: 8, mesureeA: IL_Y_A_2H },
    });
    expect(conditions.tempEau).toBe(8);
    expect(conditions.sourceTempEau).toBe('saisie');
  });

  it("critère 1 : given une saisie datant de 7 h et une station Hub'Eau active à 10 km, when on demande les conditions, then tempEau vaut la mesure de la station et sourceTempEau vaut « capteur »", async () => {
    const { service } = miseEnPlace(STATION_A_10_KM);
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      saisieTempEau: { valeurC: 14.5, mesureeA: IL_Y_A_7H },
    });
    expect(conditions.tempEau).toBe(11.2);
    expect(conditions.sourceTempEau).toBe('capteur');
  });

  it("critère 2 : given une saisie datant d'exactement 6 h et une station Hub'Eau active à 10 km, when on demande les conditions, then la saisie est ignorée et sourceTempEau vaut « capteur »", async () => {
    const { service } = miseEnPlace(STATION_A_10_KM);
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      saisieTempEau: { valeurC: 14.5, mesureeA: IL_Y_A_6H },
    });
    expect(conditions.tempEau).toBe(11.2);
    expect(conditions.sourceTempEau).toBe('capteur');
  });

  it("critère 3 : given aucune saisie et Hub'Eau indisponible, avec une moyenne de l'air disponible, when on demande les conditions, then tempEau vaut l'estimation depuis l'air et sourceTempEau vaut « estimation »", async () => {
    const { service } = miseEnPlace({ statut: "Hub'Eau indisponible" });
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions.tempEau).toBe(9.6);
    expect(conditions.sourceTempEau).toBe('estimation');
  });

  it("critère 3 : given une saisie de 7 h et Hub'Eau indisponible, avec une moyenne de l'air disponible, when on demande les conditions, then la saisie périmée est ignorée et l'estimation est retenue", async () => {
    const { service } = miseEnPlace({ statut: "Hub'Eau indisponible" });
    const conditions = await service.conditions({
      lieu: ANGERS,
      moment: MAINTENANT,
      saisieTempEau: { valeurC: 14.5, mesureeA: IL_Y_A_7H },
    });
    expect(conditions.tempEau).toBe(9.6);
    expect(conditions.sourceTempEau).toBe('estimation');
  });

  it("critère 4 : given aucune saisie et aucune station active à moins de 30 km, avec une moyenne de l'air disponible, when on demande les conditions, then sourceTempEau vaut « estimation »", async () => {
    const { service } = miseEnPlace({ statut: 'aucune station' });
    const conditions = await service.conditions({ lieu: ANGERS, moment: MAINTENANT });
    expect(conditions.tempEau).toBe(9.6);
    expect(conditions.sourceTempEau).toBe('estimation');
  });
});
