// US 53 : cas limites de la température de l'eau Hub'Eau, hors critères d'acceptation (PLAN §4, §8.2).
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { distanceKm, HubeauService } from './hubeau.service';

const URL_CHRONIQUE = 'https://hubeau.eaufrance.fr/api/v1/temperature/chronique';
const LIEU = { latitude: 47.47, longitude: -0.55 };
const MAINTENANT = new Date('2026-11-06T10:00:00Z');

const ligne = (code: unknown, date: unknown, heure: unknown, resultat: unknown, latitude: unknown = 47.5, longitude: unknown = -0.55) => ({
  code_station: code,
  libelle_station: 'Station',
  latitude,
  longitude,
  date_mesure_temp: date,
  heure_mesure_temp: heure,
  resultat,
});

async function demande(corps: object) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const resultat = TestBed.inject(HubeauService).temperatureEauProche(LIEU, MAINTENANT);
  http.expectOne((r) => r.url === URL_CHRONIQUE).flush(corps);
  http.verify();
  return resultat;
}

describe('distanceKm (haversine)', () => {
  it('given deux points identiques, when on mesure la distance, then elle vaut 0', () => {
    expect(distanceKm(LIEU, LIEU)).toBe(0);
  });

  it('given deux points à 1° de latitude, when on mesure la distance, then elle vaut environ 111,19 km', () => {
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111.195, 2);
  });
});

describe('HubeauService, cas limites', () => {
  it('given une réponse sans tableau data, when on demande la température, then il rend « Hub\'Eau indisponible »', async () => {
    expect(await demande({ count: 0 })).toEqual({ statut: "Hub'Eau indisponible" });
  });

  it('given une réponse dont data n\'est pas un tableau, when on demande la température, then il rend « Hub\'Eau indisponible »', async () => {
    expect(await demande({ data: 'oups' })).toEqual({ statut: "Hub'Eau indisponible" });
  });

  it('given des lignes sans code, coordonnées, date ou heure valides, when on demande la température, then elles sont ignorées', async () => {
    const resultat = await demande({
      data: [
        null,
        'texte',
        ligne('', '2026-11-05', '09:00:00', 10),
        ligne(undefined, '2026-11-05', '09:00:00', 10),
        ligne('A', '2026-11-05', '09:00:00', 10, 'nord'),
        ligne('B', '2026-11-05', '09:00:00', 10, 47.5, null),
        ligne('C', 'hier', '09:00:00', 10),
        ligne('D', '2026-11-05', undefined, 10),
        ligne('E', '2026-11-05', '09:00:00', Number.NaN),
      ],
    });
    expect(resultat).toEqual({ statut: 'aucune station' });
  });

  it('given des mesures d\'une station dans le désordre, when on demande la température, then la plus récente est rendue', async () => {
    const resultat = await demande({
      data: [ligne('S1', '2026-11-05', '08:00:00', 10), ligne('S1', '2026-11-05', '12:00:00', 11), ligne('S1', '2026-11-05', '10:00:00', 9)],
    });
    expect(resultat).toMatchObject({ statut: 'mesure', temperatureC: 11, heure: '12:00:00' });
  });

  it('given deux stations à la même distance, when on demande la température, then la mesure la plus récente l\'emporte', async () => {
    const resultat = await demande({
      data: [ligne('VIEILLE', '2026-11-05', '08:00:00', 10), ligne('RECENTE', '2026-11-05', '09:00:00', 12)],
    });
    expect(resultat).toMatchObject({ station: { code: 'RECENTE' } });
  });

  it('given une station à 29,97 km, when on demande la température, then elle est dans le rayon et sa distance est arrondie à 30 km', async () => {
    const latitude = 47.47 + 29.97 / ((6371 * Math.PI) / 180);
    const resultat = await demande({ data: [ligne('LIMITE', '2026-11-05', '09:00:00', 11, latitude)] });
    expect(resultat).toMatchObject({ statut: 'mesure', station: { code: 'LIMITE' }, distanceKm: 30 });
  });

  it('given deux stations à 7,96 et 8,04 km, la plus lointaine mesurée plus récemment, when on demande la température, then la plus proche l\'emporte', async () => {
    const km = (d: number) => 47.47 + d / ((6371 * Math.PI) / 180);
    const resultat = await demande({
      data: [ligne('LOIN', '2026-11-05', '09:00:00', 12, km(8.04)), ligne('PRES', '2026-11-05', '08:00:00', 10, km(7.96))],
    });
    expect(resultat).toMatchObject({ station: { code: 'PRES' }, distanceKm: 8 });
  });

  it('given une seule station dont la mesure est datée de demain, when on demande la température, then il rend « aucune station »', async () => {
    const resultat = await demande({ data: [ligne('FUTUR', '2026-11-07', '10:00:00', 12)] });
    expect(resultat).toEqual({ statut: 'aucune station' });
  });
});
