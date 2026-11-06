// US 53 : température de l'eau de la station Hub'Eau la plus proche (PLAN §4, §8.2, §11).
// Contrat : hubeau.service.ts exporte `HubeauService`, `ResultatTemperatureEau`, `RAYON_MAX_KM` (30) et `ANCIENNETE_MAX_H` (48).
// Les tests passent par l'interface publique, avec des réponses Hub'Eau simulées (aucun appel réel).
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Lieu } from './weather-provider';
import { HubeauService, RAYON_MAX_KM, ANCIENNETE_MAX_H } from './hubeau.service';

const URL_CHRONIQUE = 'https://hubeau.eaufrance.fr/api/v1/temperature/chronique';
const LIEU: Lieu = { latitude: 47.47, longitude: -0.55 };
const MAINTENANT = new Date('2026-11-06T10:00:00Z');
// 1° de latitude = 6371·π/180 km : une station plein nord à d km est à d km (haversine).
const KM_PAR_DEGRE = (6371 * Math.PI) / 180;

/** Une ligne de mesure d'une station située plein nord du lieu, à `distanceKm` km. */
const ligne = (code: string, nom: string, distanceKm: number, date: string, heure: string, resultat: number | null = 12.28) => ({
  code_station: code,
  libelle_station: nom,
  longitude: LIEU.longitude,
  latitude: LIEU.latitude + distanceKm / KM_PAR_DEGRE,
  date_mesure_temp: date,
  heure_mesure_temp: heure,
  resultat,
  symbole_unite: '°C',
});

const reponse = (data: unknown[]) => ({ count: data.length, data });

function miseEnPlace() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { service: TestBed.inject(HubeauService), http: TestBed.inject(HttpTestingController) };
}

/** Pose la question, répond avec `corps` et rend le résultat. */
async function demande(corps: unknown[]) {
  const { service, http } = miseEnPlace();
  const resultat = service.temperatureEauProche(LIEU, MAINTENANT);
  http.expectOne((r) => r.url === URL_CHRONIQUE).flush(reponse(corps));
  return resultat;
}

describe('HubeauService (température de l\'eau)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('les constantes du contrat valent 30 km et 48 h', () => {
    expect(RAYON_MAX_KM).toBe(30);
    expect(ANCIENNETE_MAX_H).toBe(48);
  });

  it('critère 0 : given une seule station active à 12 km (plusieurs mesures, la plus récente en premier), when on demande la température de l\'eau, then il rend la température de la dernière mesure, sa date et heure, le nom de la station et sa distance en km', async () => {
    const resultat = await demande([
      ligne('S1', 'La Mayenne à Angers', 12, '2026-11-05', '09:39:42', 12.28),
      ligne('S1', 'La Mayenne à Angers', 12, '2026-11-05', '08:39:42', 11.9),
      ligne('S1', 'La Mayenne à Angers', 12, '2026-11-04', '23:00:00', 11.5),
    ]);
    expect(resultat).toEqual({
      statut: 'mesure',
      temperatureC: 12.28,
      date: '2026-11-05',
      heure: '09:39:42',
      station: { code: 'S1', nom: 'La Mayenne à Angers' },
      distanceKm: 12,
    });
  });

  it('critère 0 : given un lieu, when on demande la température de l\'eau, then une seule requête GET part avec latitude, longitude, distance=30 et date_debut_mesure = la date UTC de maintenant moins 48 h', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.temperatureEauProche(LIEU, MAINTENANT);
    const req = http.expectOne((r) => r.url === URL_CHRONIQUE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('latitude')).toBe(String(LIEU.latitude));
    expect(req.request.params.get('longitude')).toBe(String(LIEU.longitude));
    expect(req.request.params.get('distance')).toBe('30');
    expect(req.request.params.get('date_debut_mesure')).toBe('2026-11-04');
    expect(req.request.params.get('sort')).toBe('desc');
    req.flush(reponse([]));
    await resultat;
  });

  it('critère 0 : given une station dont la dernière mesure a exactement 48 h, when on demande la température, then elle est active et sa mesure est rendue', async () => {
    const resultat = await demande([ligne('S1', 'Limite', 10, '2026-11-04', '10:00:00', 9.5)]);
    expect(resultat).toMatchObject({ statut: 'mesure', temperatureC: 9.5, station: { code: 'S1', nom: 'Limite' } });
  });

  it('critère 0 : given des lignes dont le résultat n\'est pas un nombre fini, when on demande la température, then elles sont ignorées', async () => {
    const resultat = await demande([
      ligne('S1', 'Mayenne', 12, '2026-11-05', '10:00:00', null),
      ligne('S1', 'Mayenne', 12, '2026-11-05', '09:00:00', 10.4),
    ]);
    expect(resultat).toMatchObject({ statut: 'mesure', temperatureC: 10.4, date: '2026-11-05', heure: '09:00:00' });
  });

  it('critère 1 : given deux stations actives à 8 km et 20 km, when on demande la température de l\'eau, then il rend la mesure de la station à 8 km', async () => {
    const resultat = await demande([
      ligne('LOIN', 'Station à 20 km', 20, '2026-11-05', '11:00:00', 14),
      ligne('PRES', 'Station à 8 km', 8, '2026-11-05', '09:00:00', 10),
    ]);
    expect(resultat).toEqual({
      statut: 'mesure',
      temperatureC: 10,
      date: '2026-11-05',
      heure: '09:00:00',
      station: { code: 'PRES', nom: 'Station à 8 km' },
      distanceKm: 8,
    });
  });

  it('critère 2 : given une seule station active à 35 km, when on demande la température de l\'eau, then il rend « aucune station »', async () => {
    const resultat = await demande([ligne('S1', 'Trop loin', 35, '2026-11-05', '09:00:00')]);
    expect(resultat).toEqual({ statut: 'aucune station' });
  });

  it('critère 3 : given une seule station active à 30 km, when on demande la température de l\'eau, then il rend « aucune station »', async () => {
    // 30,0004 km plein nord (distance haversine calculée ≈ 30,0004, arrondie à 30,0) : hors rayon sans ambiguïté
    // malgré les erreurs d'arrondi flottant ; la borne est stricte (< 30 km).
    const resultat = await demande([ligne('S1', 'Pile 30 km', 30.0004, '2026-11-05', '09:00:00')]);
    expect(resultat).toEqual({ statut: 'aucune station' });
  });

  it('critère 4 : given une station inactive à 5 km et une station active à 18 km, when on demande la température de l\'eau, then il rend la mesure de la station à 18 km', async () => {
    const resultat = await demande([
      ligne('ACTIVE', 'Station à 18 km', 18, '2026-11-05', '07:00:00', 13.1),
      ligne('INACTIVE', 'Station à 5 km', 5, '2026-11-04', '09:59:59', 8),
    ]);
    expect(resultat).toEqual({
      statut: 'mesure',
      temperatureC: 13.1,
      date: '2026-11-05',
      heure: '07:00:00',
      station: { code: 'ACTIVE', nom: 'Station à 18 km' },
      distanceKm: 18,
    });
  });

  it('critère 5 : given une seule station proche mais inactive, when on demande la température de l\'eau, then il rend « aucune station »', async () => {
    const resultat = await demande([ligne('S1', 'Inactive', 5, '2026-11-03', '12:00:00')]);
    expect(resultat).toEqual({ statut: 'aucune station' });
  });

  it('critère 6 : given une erreur réseau simulée, when on demande la température de l\'eau, then il rend « Hub\'Eau indisponible » sans erreur non gérée', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.temperatureEauProche(LIEU, MAINTENANT);
    http.expectOne((r) => r.url === URL_CHRONIQUE).error(new ProgressEvent('error'));
    await expect(resultat).resolves.toEqual({ statut: "Hub'Eau indisponible" });
  });

  it('critère 6 : given une réponse HTTP 500 simulée, when on demande la température de l\'eau, then il rend « Hub\'Eau indisponible », distinct de « aucune station »', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.temperatureEauProche(LIEU, MAINTENANT);
    http.expectOne((r) => r.url === URL_CHRONIQUE).flush({ error: true }, { status: 500, statusText: 'Server Error' });
    const rendu = await resultat;
    expect(rendu).toEqual({ statut: "Hub'Eau indisponible" });
    expect(rendu).not.toEqual({ statut: 'aucune station' });
  });
});
