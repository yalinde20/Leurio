// US 54 : tendance du débit près d'un lieu (PLAN §8.1, §11).
// Contrat : hubeau.service.ts exporte `SEUIL_CRUE` (1.5), `SEUIL_ETIAGE` (0.5), `DUREE_MOYENNE_JOURS` (30) et la méthode
// `HubeauService.tendanceDebitProche(lieu, maintenant)`, qui ne rejette jamais. Appels Hub'Eau séquentiels :
// référentiel des stations, observations temps réel (L/s), débit moyen journalier (L/s). Résultats en m³/s.
// Les réponses Hub'Eau sont simulées : aucun appel réel.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Lieu } from './weather-provider';
import { HubeauService, SEUIL_CRUE, SEUIL_ETIAGE, DUREE_MOYENNE_JOURS } from './hubeau.service';

const URL_STATIONS = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie/referentiel/stations';
const URL_OBS = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr';
const URL_ELAB = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie/obs_elab';
const LIEU: Lieu = { latitude: 47.47, longitude: -0.55 };
const MAINTENANT = new Date('2026-11-06T10:00:00Z');
const KM_PAR_DEGRE = (6371 * Math.PI) / 180;
const RECENTE = '2026-11-06T09:00:00Z';

interface Station {
  code: string;
  nom: string;
  km: number;
  /** Dernière observation, en m³/s ; null = aucune observation. */
  debit?: number | null;
  dateObs?: string;
}

const refStation = (s: Station) => ({
  code_station: s.code,
  libelle_station: s.nom,
  longitude_station: LIEU.longitude,
  latitude_station: LIEU.latitude + s.km / KM_PAR_DEGRE,
});
const obs = (code: string, dateObs: string, m3s: number | null) => ({
  code_station: code,
  date_obs: dateObs,
  resultat_obs: m3s === null ? null : m3s * 1000,
});
const elab = (code: string, date: string, m3s: number | null) => ({
  code_station: code,
  date_obs_elab: date,
  resultat_obs_elab: m3s === null ? null : m3s * 1000,
});

const attendre = () => new Promise<void>((r) => setTimeout(r, 0));
const reponse = (data: unknown[]) => ({ data });

function miseEnPlace() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { service: TestBed.inject(HubeauService), http: TestBed.inject(HttpTestingController) };
}

/** Attend la prochaine requête vers `url` (les appels du service sont séquentiels). */
async function prochaine(http: HttpTestingController, url: string) {
  await attendre();
  return http.expectOne((r) => r.url === url);
}

interface Scenario {
  stations: Station[];
  /** Valeurs des débits moyens journaliers, en m³/s. */
  moyennes?: (number | null)[];
}

/** Joue les 3 appels avec des réponses simulées et rend le résultat. */
async function demande({ stations, moyennes = [80] }: Scenario) {
  const { service, http } = miseEnPlace();
  const resultat = service.tendanceDebitProche(LIEU, MAINTENANT);
  (await prochaine(http, URL_STATIONS)).flush(reponse(stations.map(refStation)));
  const avecObs = stations.filter((s) => s.debit !== undefined);
  (await prochaine(http, URL_OBS)).flush(reponse(avecObs.map((s) => obs(s.code, s.dateObs ?? RECENTE, s.debit ?? null))));
  await attendre();
  const reqs = http.match((r) => r.url === URL_ELAB);
  reqs.forEach((r) => r.flush(reponse(moyennes.map((m, i) => elab(reqs[0].request.params.get('code_entite') ?? '', `2026-10-${10 + i}`, m)))));
  return resultat;
}

/** Scénario d'une station à 12 km avec un débit actuel et une moyenne sur 30 jours. */
const unePlusProche = (actuel: number, moyenne: number) =>
  demande({ stations: [{ code: 'S1', nom: 'La Mayenne à Angers', km: 12, debit: actuel }], moyennes: [moyenne] });

describe("HubeauService (tendance du débit)", () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('les constantes du contrat valent 1,5, 0,5 et 30 jours', () => {
    miseEnPlace();
    expect(SEUIL_CRUE).toBe(1.5);
    expect(SEUIL_ETIAGE).toBe(0.5);
    expect(DUREE_MOYENNE_JOURS).toBe(30);
  });

  it('critère 0 : given une station hydrométrique à moins de 30 km, débit actuel 150 m³/s et moyenne des 30 derniers jours 80 m³/s, when on demande la tendance du débit, then il rend « crue » et le nom de la station', async () => {
    const resultat = await unePlusProche(150, 80);
    expect(resultat).toEqual({
      statut: 'tendance',
      tendance: 'crue',
      station: { code: 'S1', nom: 'La Mayenne à Angers' },
      distanceKm: 12,
      debitActuelM3s: 150,
      debitMoyenM3s: 80,
      dateMesure: RECENTE,
    });
  });

  it('critère 0 : given un lieu, when on demande la tendance, then les trois requêtes GET partent dans l\'ordre avec les bons paramètres', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.tendanceDebitProche(LIEU, MAINTENANT);

    const r1 = await prochaine(http, URL_STATIONS);
    expect(r1.request.method).toBe('GET');
    expect(r1.request.params.get('latitude')).toBe(String(LIEU.latitude));
    expect(r1.request.params.get('longitude')).toBe(String(LIEU.longitude));
    expect(r1.request.params.get('distance')).toBe('30');
    expect(r1.request.params.get('en_service')).toBe('true');
    r1.flush(reponse([refStation({ code: 'S1', nom: 'Mayenne', km: 5 })]));

    const r2 = await prochaine(http, URL_OBS);
    expect(r2.request.method).toBe('GET');
    expect(r2.request.params.get('code_entite')).toBe('S1');
    expect(r2.request.params.get('grandeur_hydro')).toBe('Q');
    expect(r2.request.params.get('date_debut_obs')).toMatch(/^2026-10-30T10:00:00/);
    expect(r2.request.params.get('sort')).toBe('desc');
    r2.flush(reponse([obs('S1', RECENTE, 80)]));

    const r3 = await prochaine(http, URL_ELAB);
    expect(r3.request.method).toBe('GET');
    expect(r3.request.params.get('code_entite')).toBe('S1');
    expect(r3.request.params.get('grandeur_hydro_elab')).toBe('QmnJ');
    expect(r3.request.params.get('date_debut_obs_elab')).toBe('2026-10-07');
    r3.flush(reponse([elab('S1', '2026-10-20', 80)]));

    expect(await resultat).toMatchObject({ statut: 'tendance', tendance: 'normal' });
  });

  it('critère 0 : given plusieurs stations, when on demande la tendance, then les codes sont envoyés séparés par des virgules et les débits sont convertis de L/s en m³/s', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.tendanceDebitProche(LIEU, MAINTENANT);
    (await prochaine(http, URL_STATIONS)).flush(
      reponse([refStation({ code: 'S1', nom: 'A', km: 5 }), refStation({ code: 'S2', nom: 'B', km: 20 })]),
    );
    const r2 = await prochaine(http, URL_OBS);
    expect(r2.request.params.get('code_entite')?.split(',').sort()).toEqual(['S1', 'S2']);
    // Hub'Eau refuse `timestep` (HTTP 400) quand plusieurs codes sont demandés.
    expect(r2.request.params.has('timestep')).toBe(false);
    r2.flush(reponse([obs('S1', RECENTE, 12.5), obs('S2', RECENTE, 99)]));
    (await prochaine(http, URL_ELAB)).flush(reponse([elab('S1', '2026-10-20', 10), elab('S1', '2026-10-21', 20)]));
    expect(await resultat).toMatchObject({ station: { code: 'S1' }, debitActuelM3s: 12.5, debitMoyenM3s: 15 });
  });

  it('critère 1 : given la même station, débit actuel 30 m³/s et moyenne 80 m³/s, when on demande la tendance, then il rend « étiage »', async () => {
    expect(await unePlusProche(30, 80)).toMatchObject({ statut: 'tendance', tendance: 'étiage', station: { nom: 'La Mayenne à Angers' } });
  });

  it('critère 2 : given la même station, débit actuel 85 m³/s et moyenne 80 m³/s, when on demande la tendance, then il rend « normal »', async () => {
    expect(await unePlusProche(85, 80)).toMatchObject({ statut: 'tendance', tendance: 'normal' });
  });

  it('critère 2 : given un débit pile à 1,5 fois la moyenne, when on demande la tendance, then il rend « crue » (borne incluse)', async () => {
    expect(await unePlusProche(120, 80)).toMatchObject({ tendance: 'crue' });
  });

  it('critère 2 : given un débit pile à 0,5 fois la moyenne, when on demande la tendance, then il rend « étiage » (borne incluse)', async () => {
    expect(await unePlusProche(40, 80)).toMatchObject({ tendance: 'étiage' });
  });

  it('critère 2 : given un débit juste sous 1,5 fois la moyenne, when on demande la tendance, then il rend « normal »', async () => {
    expect(await unePlusProche(119, 80)).toMatchObject({ tendance: 'normal' });
  });

  it('critère 2 : given un débit juste au-dessus de 0,5 fois la moyenne, when on demande la tendance, then il rend « normal »', async () => {
    expect(await unePlusProche(41, 80)).toMatchObject({ tendance: 'normal' });
  });

  it('critère 3 : given aucune station dans le référentiel, when on demande la tendance, then il rend « aucune station » sans autre appel', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.tendanceDebitProche(LIEU, MAINTENANT);
    (await prochaine(http, URL_STATIONS)).flush(reponse([]));
    expect(await resultat).toEqual({ statut: 'aucune station' });
    http.expectNone((r) => r.url === URL_OBS || r.url === URL_ELAB);
  });

  it('critère 3 : given une station sans observation récente (dernière mesure à plus de 7 jours), when on demande la tendance, then il rend « aucune station »', async () => {
    const resultat = await demande({ stations: [{ code: 'S1', nom: 'Vieille', km: 10, debit: 80, dateObs: '2026-10-29T09:00:00Z' }] });
    expect(resultat).toEqual({ statut: 'aucune station' });
  });

  it('critère 3 : given une station à exactement 30 km, when on demande la tendance, then elle est exclue (borne stricte) et il rend « aucune station »', async () => {
    const resultat = await demande({ stations: [{ code: 'S1', nom: 'Limite', km: 30, debit: 80 }] });
    expect(resultat).toEqual({ statut: 'aucune station' });
  });

  it('critère 3 : given une station active à plus de 30 km renvoyée par erreur, when on demande la tendance, then elle est exclue', async () => {
    const resultat = await demande({ stations: [{ code: 'S1', nom: 'Loin', km: 45, debit: 80 }] });
    expect(resultat).toEqual({ statut: 'aucune station' });
  });

  it('critère 3 : given une station proche inactive et une station plus loin active, when on demande la tendance, then la station active est choisie', async () => {
    const resultat = await demande({
      stations: [
        { code: 'S1', nom: 'Proche inactive', km: 5, debit: 80, dateObs: '2026-10-01T09:00:00Z' },
        { code: 'S2', nom: 'Loin active', km: 25, debit: 80 },
      ],
    });
    expect(resultat).toMatchObject({ statut: 'tendance', station: { code: 'S2', nom: 'Loin active' }, distanceKm: 25 });
  });

  it('critère 3 : given une station sans moyenne sur 30 jours (aucune valeur valide), when on demande la tendance, then il rend « aucune station »', async () => {
    expect(await demande({ stations: [{ code: 'S1', nom: 'Mayenne', km: 10, debit: 80 }], moyennes: [null] })).toEqual({
      statut: 'aucune station',
    });
  });

  it('critère 4 : given une erreur réseau sur le référentiel, when on demande la tendance, then il rend « Hub\'Eau indisponible » et ne rejette pas', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.tendanceDebitProche(LIEU, MAINTENANT);
    (await prochaine(http, URL_STATIONS)).error(new ProgressEvent('error'));
    expect(await resultat).toEqual({ statut: "Hub'Eau indisponible" });
  });

  it('critère 4 : given une erreur HTTP 500 sur le référentiel, when on demande la tendance, then il rend « Hub\'Eau indisponible », distinct d\'« aucune station »', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.tendanceDebitProche(LIEU, MAINTENANT);
    (await prochaine(http, URL_STATIONS)).flush('boom', { status: 500, statusText: 'Server Error' });
    const r = await resultat;
    expect(r).toEqual({ statut: "Hub'Eau indisponible" });
    expect(r.statut).not.toBe('aucune station');
  });

  it('critère 4 : given une erreur HTTP 500 sur les observations, when on demande la tendance, then il rend « Hub\'Eau indisponible »', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.tendanceDebitProche(LIEU, MAINTENANT);
    (await prochaine(http, URL_STATIONS)).flush(reponse([refStation({ code: 'S1', nom: 'Mayenne', km: 5 })]));
    (await prochaine(http, URL_OBS)).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(await resultat).toEqual({ statut: "Hub'Eau indisponible" });
  });

  it('critère 4 : given une erreur réseau sur le débit moyen, when on demande la tendance, then il rend « Hub\'Eau indisponible »', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.tendanceDebitProche(LIEU, MAINTENANT);
    (await prochaine(http, URL_STATIONS)).flush(reponse([refStation({ code: 'S1', nom: 'Mayenne', km: 5 })]));
    (await prochaine(http, URL_OBS)).flush(reponse([obs('S1', RECENTE, 80)]));
    (await prochaine(http, URL_ELAB)).error(new ProgressEvent('error'));
    expect(await resultat).toEqual({ statut: "Hub'Eau indisponible" });
  });

  it('critère 4 : given une réponse sans tableau data, when on demande la tendance, then il rend « Hub\'Eau indisponible »', async () => {
    const { service, http } = miseEnPlace();
    const resultat = service.tendanceDebitProche(LIEU, MAINTENANT);
    (await prochaine(http, URL_STATIONS)).flush({ message: 'inattendu' });
    expect(await resultat).toEqual({ statut: "Hub'Eau indisponible" });
  });
});
