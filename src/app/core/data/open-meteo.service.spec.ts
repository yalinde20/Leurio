// US 49 : le fournisseur météo rend la météo du moment pour un lieu (PLAN §4 : interface WeatherProvider).
// Contrat : weather-provider.ts exporte `WeatherProvider` (classe abstraite, jeton d'injection), `Lieu`, `ResultatMeteo` ;
// open-meteo.service.ts exporte `OpenMeteoService`. Les tests passent par l'interface, avec des réponses simulées.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WeatherProvider, Lieu } from './weather-provider';
import { OpenMeteoService } from './open-meteo.service';

const URL_PREVISION = 'https://api.open-meteo.com/v1/forecast';
const LIEU: Lieu = { latitude: 47.47, longitude: -0.55 };

const reponseComplete = () => ({
  latitude: 47.47,
  longitude: -0.55,
  current_units: { time: 'iso8601', interval: 'seconds', temperature_2m: '°C', cloud_cover: '%', wind_speed_10m: 'km/h', pressure_msl: 'hPa' },
  current: { time: '2026-11-05T10:00', interval: 900, temperature_2m: 11.3, cloud_cover: 72, wind_speed_10m: 14.6, pressure_msl: 1008.4 },
});

function miseEnPlace() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), { provide: WeatherProvider, useClass: OpenMeteoService }],
  });
  return { fournisseur: TestBed.inject(WeatherProvider), http: TestBed.inject(HttpTestingController) };
}

describe('WeatherProvider (Open-Meteo)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('critère 0 : given un lieu et une réponse Open-Meteo complète, when on demande la météo de maintenant, then il rend pression, nuages, vent et température égaux aux valeurs de la réponse', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.meteoActuelle(LIEU);
    const req = http.expectOne((r) => r.url === URL_PREVISION);
    expect(req.request.params.get('latitude')).toBe(String(LIEU.latitude));
    expect(req.request.params.get('longitude')).toBe(String(LIEU.longitude));
    req.flush(reponseComplete());
    expect(await resultat).toEqual({
      disponible: true,
      pressionHpa: 1008.4,
      couvertureNuageusePct: 72,
      ventKmh: 14.6,
      temperatureAirC: 11.3,
    });
  });

  it('critère 0 : given un lieu, when on demande la météo, then la requête demande les valeurs courantes (current) de température, nuages, vent et pression', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.meteoActuelle(LIEU);
    const req = http.expectOne((r) => r.url === URL_PREVISION);
    const demandees = (req.request.params.get('current') ?? '').split(',');
    expect(demandees).toEqual(expect.arrayContaining(['temperature_2m', 'cloud_cover', 'wind_speed_10m', 'pressure_msl']));
    req.flush(reponseComplete());
    await resultat;
  });

  it('critère 1 : given une erreur réseau simulée, when on demande la météo de maintenant, then il rend « météo indisponible » sans erreur non gérée', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.meteoActuelle(LIEU);
    http.expectOne((r) => r.url === URL_PREVISION).error(new ProgressEvent('error'));
    await expect(resultat).resolves.toEqual({ disponible: false });
  });

  it('critère 2 : given une réponse HTTP 500 simulée, when on demande la météo de maintenant, then il rend « météo indisponible »', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.meteoActuelle(LIEU);
    http.expectOne((r) => r.url === URL_PREVISION).flush({ error: true, reason: 'panne' }, { status: 500, statusText: 'Server Error' });
    await expect(resultat).resolves.toEqual({ disponible: false });
  });

  it('critère 3 : given une réponse sans pression, when on demande la météo de maintenant, then il rend « météo indisponible » et n\'invente aucune valeur', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.meteoActuelle(LIEU);
    const reponse = reponseComplete();
    const sansPression: Record<string, unknown> = { ...reponse.current };
    delete sansPression['pressure_msl'];
    http.expectOne((r) => r.url === URL_PREVISION).flush({ ...reponse, current: sansPression });
    expect(await resultat).toEqual({ disponible: false });
  });

  it('critère 3 : given une réponse dont la pression est null, when on demande la météo de maintenant, then il rend « météo indisponible » et n\'invente aucune valeur', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.meteoActuelle(LIEU);
    const reponse = reponseComplete();
    http.expectOne((r) => r.url === URL_PREVISION).flush({ ...reponse, current: { ...reponse.current, pressure_msl: null } });
    expect(await resultat).toEqual({ disponible: false });
  });

  it.each(['temperature_2m', 'cloud_cover', 'wind_speed_10m'] as const)(
    'critère 3 : given une réponse sans %s, when on demande la météo de maintenant, then il rend « météo indisponible » en entier',
    async (champ) => {
      const { fournisseur, http } = miseEnPlace();
      const resultat = fournisseur.meteoActuelle(LIEU);
      const reponse = reponseComplete();
      const courant: Record<string, unknown> = { ...reponse.current };
      delete courant[champ];
      http.expectOne((r) => r.url === URL_PREVISION).flush({ ...reponse, current: courant });
      expect(await resultat).toEqual({ disponible: false });
    },
  );

  it('critère 3 : given une réponse sans bloc current, when on demande la météo de maintenant, then il rend « météo indisponible »', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.meteoActuelle(LIEU);
    http.expectOne((r) => r.url === URL_PREVISION).flush({ latitude: 47.47, longitude: -0.55 });
    expect(await resultat).toEqual({ disponible: false });
  });
  it('given un serveur qui ne répond pas, when 10 s passent, then il rend « météo indisponible » au lieu d\'attendre sans fin', async () => {
    vi.useFakeTimers();
    try {
      const { fournisseur, http } = miseEnPlace();
      const resultat = fournisseur.meteoActuelle(LIEU);
      const req = http.expectOne((r) => r.url === URL_PREVISION);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await resultat).toEqual({ disponible: false });
      expect(req.cancelled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('given un lieu, when on demande la météo, then la requête fixe les unités en °C et km/h', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.meteoActuelle(LIEU);
    const req = http.expectOne((r) => r.url === URL_PREVISION);
    expect(req.request.params.get('temperature_unit')).toBe('celsius');
    expect(req.request.params.get('wind_speed_unit')).toBe('kmh');
    req.flush(reponseComplete());
    await resultat;
  });
});

// US 50 : la météo prévue à un moment choisi (aujourd'hui ou dans les 48 h à venir).
// Contrat : WeatherProvider.meteoPrevue(lieu, moment) rend MeteoPrevue (météo + `heure`), MeteoIndisponible
// ou DemandeRefusee ({ disponible: false, refusee: true, motif }) sans aucun appel réseau.
// Le cast local ci-dessous évite qu'une erreur de type fasse échouer tout le fichier avant que la méthode existe.
type Prevue = { disponible: true; pressionHpa: number; couvertureNuageusePct: number; ventKmh: number; temperatureAirC: number; heure: Date };
type Refusee = { disponible: false; refusee: true; motif: 'moment hors des 48 h à venir' | 'moment déjà passé' };
type ResultatPrevu = Prevue | { disponible: false } | Refusee;
type AvecPrevision = { meteoPrevue(lieu: Lieu, moment: Date): Promise<ResultatPrevu> };

const HEURE_MS = 3_600_000;

/** Prévision horaire en GMT (sans suffixe de zone), `nb` heures à partir de `debut`, valeurs distinctes par heure. */
const reponseHoraire = (debut: Date, nb = 50) => {
  const heures = Array.from({ length: nb }, (_, i) => new Date(debut.getTime() + i * HEURE_MS));
  return {
    latitude: 47.47,
    longitude: -0.55,
    timezone: 'GMT',
    hourly: {
      time: heures.map((h) => h.toISOString().slice(0, 16)),
      temperature_2m: heures.map((_, i) => 5 + i * 0.3),
      cloud_cover: heures.map((_, i) => i * 2),
      wind_speed_10m: heures.map((_, i) => 10 + i * 0.5),
      pressure_msl: heures.map((_, i) => 1000 + i * 0.4),
    },
  };
};

const attendu = (i: number, heure: Date): Prevue => ({
  disponible: true,
  pressionHpa: 1000 + i * 0.4,
  couvertureNuageusePct: i * 2,
  ventKmh: 10 + i * 0.5,
  temperatureAirC: 5 + i * 0.3,
  heure,
});

function miseEnPlacePrevue(maintenant: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(maintenant));
  const { fournisseur, http } = miseEnPlace();
  return { fournisseur: fournisseur as unknown as AvecPrevision, http };
}

describe('WeatherProvider (Open-Meteo) — météo prévue à un moment choisi (US 50)', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } finally {
      vi.useRealTimers();
    }
  });

  it('critère 0 : given une réponse simulée couvrant les 48 h à venir, when on demande la météo pour demain 7 h, then le fournisseur rend la pression, les nuages, le vent et la température prévus pour demain 7 h', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = fournisseur.meteoPrevue(LIEU, new Date('2026-11-06T07:00:00+01:00'));
    const req = http.expectOne((r) => r.url === URL_PREVISION);
    req.flush(reponseHoraire(new Date('2026-11-05T10:00:00Z')));
    // 06:00 GMT = index 20 depuis 10:00 GMT
    expect(await resultat).toEqual(attendu(20, new Date('2026-11-06T06:00:00Z')));
  });

  it('critère 0 : given un lieu et un moment, when on demande la météo prévue, then la requête demande les valeurs horaires en GMT, en °C et km/h', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = fournisseur.meteoPrevue(LIEU, new Date('2026-11-06T07:00:00+01:00'));
    const req = http.expectOne((r) => r.url === URL_PREVISION);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('latitude')).toBe(String(LIEU.latitude));
    expect(req.request.params.get('longitude')).toBe(String(LIEU.longitude));
    expect((req.request.params.get('hourly') ?? '').split(',')).toEqual(
      expect.arrayContaining(['temperature_2m', 'cloud_cover', 'wind_speed_10m', 'pressure_msl']),
    );
    expect(req.request.params.get('timezone')).toBe('GMT');
    expect(req.request.params.get('temperature_unit')).toBe('celsius');
    expect(req.request.params.get('wind_speed_unit')).toBe('kmh');
    req.flush(reponseHoraire(new Date('2026-11-05T10:00:00Z')));
    await resultat;
  });

  it('critère 1 : given une réponse simulée heure par heure, when on demande la météo pour demain 7 h 40, then le fournisseur rend les valeurs de l\'heure la plus proche (8 h)', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = fournisseur.meteoPrevue(LIEU, new Date('2026-11-06T07:40:00+01:00'));
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseHoraire(new Date('2026-11-05T10:00:00Z')));
    // 8 h France = 07:00 GMT = index 21
    expect(await resultat).toEqual(attendu(21, new Date('2026-11-06T07:00:00Z')));
  });

  it('critère 1 : given une réponse simulée heure par heure, when on demande la météo pour demain 7 h 20, then le fournisseur rend les valeurs de l\'heure la plus proche (7 h)', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = fournisseur.meteoPrevue(LIEU, new Date('2026-11-06T07:20:00+01:00'));
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseHoraire(new Date('2026-11-05T10:00:00Z')));
    expect(await resultat).toEqual(attendu(20, new Date('2026-11-06T06:00:00Z')));
  });

  it('critère 1 : given une réponse simulée heure par heure, when on demande la météo pour demain 7 h 30, then la demi-heure est arrondie à l\'heure suivante (8 h)', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = fournisseur.meteoPrevue(LIEU, new Date('2026-11-06T07:30:00+01:00'));
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseHoraire(new Date('2026-11-05T10:00:00Z')));
    expect(await resultat).toEqual(attendu(21, new Date('2026-11-06T07:00:00Z')));
  });

  it('critère 2 : given un moment situé à plus de 48 h de maintenant, when on demande la météo, then la demande est refusée avec le motif « moment hors des 48 h à venir » et aucun appel réseau n\'est fait', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:00:00Z');
    const resultat = await fournisseur.meteoPrevue(LIEU, new Date('2026-11-08T10:00:00Z'));
    expect(resultat).toEqual({ disponible: false, refusee: true, motif: 'moment hors des 48 h à venir' });
    http.expectNone(() => true);
  });

  it('critère 2 : given un moment 1 minute après maintenant + 48 h, when on demande la météo, then la demande est refusée « moment hors des 48 h à venir » sans appel réseau', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = await fournisseur.meteoPrevue(LIEU, new Date('2026-11-07T10:21:00Z'));
    expect(resultat).toEqual({ disponible: false, refusee: true, motif: 'moment hors des 48 h à venir' });
    http.expectNone(() => true);
  });

  it('critère 3 : given un moment antérieur à l\'heure en cours, when on demande la météo, then la demande est refusée avec le motif « moment déjà passé » et aucun appel réseau n\'est fait', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = await fournisseur.meteoPrevue(LIEU, new Date('2026-11-05T07:00:00Z'));
    expect(resultat).toEqual({ disponible: false, refusee: true, motif: 'moment déjà passé' });
    http.expectNone(() => true);
  });

  it('critère 3 : given un moment une milliseconde avant le début de l\'heure en cours, when on demande la météo, then la demande est refusée « moment déjà passé » sans appel réseau', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = await fournisseur.meteoPrevue(LIEU, new Date('2026-11-05T09:59:59.999Z'));
    expect(resultat).toEqual({ disponible: false, refusee: true, motif: 'moment déjà passé' });
    http.expectNone(() => true);
  });

  it('critère 3 : given un moment au début de l\'heure en cours (avant maintenant), when on demande la météo, then la demande est acceptée et les valeurs de cette heure sont rendues', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = fournisseur.meteoPrevue(LIEU, new Date('2026-11-05T10:00:00Z'));
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseHoraire(new Date('2026-11-05T10:00:00Z')));
    expect(await resultat).toEqual(attendu(0, new Date('2026-11-05T10:00:00Z')));
  });

  it('critère 4 : given un moment situé exactement 48 h après maintenant, when on demande la météo, then la demande est acceptée et les valeurs de cette heure sont rendues', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:00:00Z');
    const resultat = fournisseur.meteoPrevue(LIEU, new Date('2026-11-07T10:00:00Z'));
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseHoraire(new Date('2026-11-05T10:00:00Z'), 49));
    expect(await resultat).toEqual(attendu(48, new Date('2026-11-07T10:00:00Z')));
  });

  it('given une valeur nulle à l\'heure retenue, when on demande la météo prévue, then il rend « météo indisponible » sans champ refusee', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = fournisseur.meteoPrevue(LIEU, new Date('2026-11-06T07:00:00+01:00'));
    const reponse = reponseHoraire(new Date('2026-11-05T10:00:00Z'));
    const pression: (number | null)[] = [...reponse.hourly.pressure_msl];
    pression[20] = null;
    http.expectOne((r) => r.url === URL_PREVISION).flush({ ...reponse, hourly: { ...reponse.hourly, pressure_msl: pression } });
    expect(await resultat).toStrictEqual({ disponible: false });
  });

  it('given une réponse dont l\'heure retenue est absente, when on demande la météo prévue, then il rend « météo indisponible » sans champ refusee', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = fournisseur.meteoPrevue(LIEU, new Date('2026-11-06T07:00:00+01:00'));
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseHoraire(new Date('2026-11-05T10:00:00Z'), 5));
    expect(await resultat).toStrictEqual({ disponible: false });
  });

  it('given une erreur réseau simulée, when on demande la météo prévue, then il rend « météo indisponible » sans champ refusee', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    const resultat = fournisseur.meteoPrevue(LIEU, new Date('2026-11-06T07:00:00+01:00'));
    http.expectOne((r) => r.url === URL_PREVISION).error(new ProgressEvent('error'));
    expect(await resultat).toStrictEqual({ disponible: false });
  });
});
