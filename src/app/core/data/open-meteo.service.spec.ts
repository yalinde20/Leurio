// US 49 : le fournisseur météo rend la météo du moment pour un lieu (PLAN §4 : interface WeatherProvider).
// Contrat : weather-provider.ts exporte `WeatherProvider` (classe abstraite, jeton d'injection), `Lieu`, `ResultatMeteo` ;
// open-meteo.service.ts exporte `OpenMeteoService`. Les tests passent par l'interface, avec des réponses simulées.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WeatherProvider, Lieu, MeteoPrevue } from './weather-provider';
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

const pressionSimulee = (i: number) => 1000 + i * 0.4;

// US 51 : la tendance attendue est dérivée des mêmes données simulées : disponible seulement si la réponse
// contient l'heure 48 h avant (index i - 48), sinon « indisponible ».
const attendu = (i: number, heure: Date): MeteoPrevue => ({
  disponible: true,
  pressionHpa: pressionSimulee(i),
  couvertureNuageusePct: i * 2,
  ventKmh: 10 + i * 0.5,
  temperatureAirC: 5 + i * 0.3,
  heure,
  pressionTendance48h:
    i >= 48
      ? { disponible: true, ecartHpa: Math.round((pressionSimulee(i) - pressionSimulee(i - 48)) * 10) / 10 }
      : { disponible: false },
});

function miseEnPlacePrevue(maintenant: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(maintenant));
  const { fournisseur, http } = miseEnPlace();
  return { fournisseur, http };
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
    // Évolution de la requête exigée par l'US 51 : la fenêtre démarre 48 h avant le moment (tendance de la pression).
    expect(req.request.params.get('start_hour')).toBe('2026-11-04T06:00');
    expect(req.request.params.get('end_hour')).toBe('2026-11-06T06:00');
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

  it('given une date invalide, when on demande la météo prévue, then il rend « météo indisponible » sans rejeter ni appeler le réseau', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-05T10:20:00Z');
    await expect(fournisseur.meteoPrevue(LIEU, new Date(''))).resolves.toStrictEqual({ disponible: false });
    http.expectNone(() => true);
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

// US 51 : tendance de la pression sur 48 h (PLAN §8.1 `pressionTendance48h`).
// Contrat : MeteoPrevue.pressionTendance48h vaut { disponible: true, ecartHpa } (pression(heure) - pression(heure - 48 h),
// arrondi à 0,1 hPa) ou { disponible: false } ; les quatre valeurs du moment restent rendues dans les deux cas.

const MOMENT_TENDANCE = new Date('2026-11-06T07:00:00+01:00'); // demain 7 h France = 06:00 GMT
const HEURE_TENDANCE = new Date('2026-11-06T06:00:00Z');
const AVANT_48H = new Date('2026-11-04T06:00:00Z');
const MAINTENANT_TENDANCE = '2026-11-05T10:20:00Z';

/** 49 heures, de heure - 48 h (index 0) à heure (index 48), valeurs distinctes, pressions des deux bouts imposées. */
const reponseTendance = (pressionAvant: number | null, pressionMoment: number | null) => {
  const reponse = reponseHoraire(AVANT_48H, 49);
  const pression: (number | null)[] = reponse.hourly.pressure_msl.map((_, i) => 1000 + i * 0.4);
  pression[0] = pressionAvant;
  pression[48] = pressionMoment;
  return { ...reponse, hourly: { ...reponse.hourly, pressure_msl: pression } };
};

const valeursDuMoment = {
  couvertureNuageusePct: 96,
  ventKmh: 34,
  temperatureAirC: 5 + 48 * 0.3,
};

describe('WeatherProvider (Open-Meteo) — tendance de la pression sur 48 h (US 51)', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } finally {
      vi.useRealTimers();
    }
  });

  it('critère 0 : given 1020 hPa 48 h avant le moment choisi et 1012 hPa au moment choisi, when on demande la météo pour ce moment, then la tendance de la pression sur 48 h vaut −8 hPa', async () => {
    const { fournisseur, http } = miseEnPlacePrevue(MAINTENANT_TENDANCE);
    const resultat = fournisseur.meteoPrevue(LIEU, MOMENT_TENDANCE);
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseTendance(1020, 1012));
    expect(await resultat).toEqual({
      disponible: true,
      pressionHpa: 1012,
      ...valeursDuMoment,
      heure: HEURE_TENDANCE,
      pressionTendance48h: { disponible: true, ecartHpa: -8 },
    });
  });

  it('critère 1 : given 1008 hPa 48 h avant le moment choisi et 1013 hPa au moment choisi, when on demande la météo pour ce moment, then la tendance de la pression sur 48 h vaut +5 hPa', async () => {
    const { fournisseur, http } = miseEnPlacePrevue(MAINTENANT_TENDANCE);
    const resultat = fournisseur.meteoPrevue(LIEU, MOMENT_TENDANCE);
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseTendance(1008, 1013));
    expect(await resultat).toEqual({
      disponible: true,
      pressionHpa: 1013,
      ...valeursDuMoment,
      heure: HEURE_TENDANCE,
      pressionTendance48h: { disponible: true, ecartHpa: 5 },
    });
  });

  it('critère 1 : given 1008,1 hPa 48 h avant et 1013,2 hPa au moment choisi, when on demande la météo, then l\'écart est arrondi à 0,1 hPa (5,1 exactement)', async () => {
    const { fournisseur, http } = miseEnPlacePrevue(MAINTENANT_TENDANCE);
    const resultat = fournisseur.meteoPrevue(LIEU, MOMENT_TENDANCE);
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseTendance(1008.1, 1013.2));
    const meteo = await resultat;
    expect(meteo).toMatchObject({ disponible: true, pressionTendance48h: { disponible: true, ecartHpa: 5.1 } });
  });

  it('given un moment, when on demande la météo prévue, then la requête couvre de 48 h avant le moment jusqu\'au moment (start_hour et end_hour en GMT)', async () => {
    const { fournisseur, http } = miseEnPlacePrevue(MAINTENANT_TENDANCE);
    const resultat = fournisseur.meteoPrevue(LIEU, MOMENT_TENDANCE);
    const req = http.expectOne((r) => r.url === URL_PREVISION);
    expect(req.request.params.get('timezone')).toBe('GMT');
    expect(req.request.params.get('start_hour')).toBe('2026-11-04T06:00');
    expect(req.request.params.get('end_hour')).toBe('2026-11-06T06:00');
    req.flush(reponseTendance(1020, 1012));
    await resultat;
  });

  it.each([
    ['la pression 48 h avant est null', () => reponseTendance(null, 1012)],
    ['la pression 48 h avant n\'est pas un nombre', () => reponseTendance('1020' as unknown as number, 1012)],
    [
      'l\'heure 48 h avant est absente de la réponse',
      () => {
        const r = reponseTendance(1020, 1012);
        const h = r.hourly;
        return {
          ...r,
          hourly: {
            time: h.time.slice(1),
            temperature_2m: h.temperature_2m.slice(1),
            cloud_cover: h.cloud_cover.slice(1),
            wind_speed_10m: h.wind_speed_10m.slice(1),
            pressure_msl: h.pressure_msl.slice(1),
          },
        };
      },
    ],
  ])(
    'critère 2 : given une réponse où %s, when on demande la météo pour ce moment, then la tendance est « indisponible » et la pression, les nuages, le vent et la température de l\'air du moment restent rendus',
    async (_cas, fabrique) => {
      const { fournisseur, http } = miseEnPlacePrevue(MAINTENANT_TENDANCE);
      const resultat = fournisseur.meteoPrevue(LIEU, MOMENT_TENDANCE);
      http.expectOne((r) => r.url === URL_PREVISION).flush(fabrique());
      expect(await resultat).toStrictEqual({
        disponible: true,
        pressionHpa: 1012,
        ...valeursDuMoment,
        heure: HEURE_TENDANCE,
        pressionTendance48h: { disponible: false },
      });
    },
  );

  it('critère 2 : given une réponse sans la pression du moment lui-même, when on demande la météo, then toute la météo reste « indisponible » (comme en US 50)', async () => {
    const { fournisseur, http } = miseEnPlacePrevue(MAINTENANT_TENDANCE);
    const resultat = fournisseur.meteoPrevue(LIEU, MOMENT_TENDANCE);
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseTendance(1020, null));
    expect(await resultat).toStrictEqual({ disponible: false });
  });
});

// US 52 : moyenne de la température de l'air des 7 jours précédant le jour du moment choisi (PLAN §8.2, §4).
// Contrat : WeatherProvider.moyenneAirDerniersJours(lieu, moment) rend { disponible: true, moyenneC, joursUtilises }
// (au moins 5 jours, moyenne arrondie à 0,1 °C) ou { disponible: false } ; ne rejette jamais. Un seul appel à l'archive.

const URL_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const MOMENT_MOYENNE = new Date('2026-11-05T10:00:00Z'); // jour à Paris : 2026-11-05
const SEPT_JOURS = ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'];
const SEPT_VALEURS = [10.2, 9.8, 11.1, 12.4, 8.7, 9.3, 10.0]; // somme 71,5 : moyenne 10,214…

const reponseArchive = (time: string[], temperature_2m_mean: (number | null)[]) => ({
  latitude: 47.47,
  longitude: -0.55,
  timezone: 'Europe/Paris',
  daily: { time, temperature_2m_mean },
});

describe('WeatherProvider (Open-Meteo) — moyenne de la température de l\'air des derniers jours (US 52)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('critère 0 : given une réponse archive simulée avec 7 températures moyennes journalières, when on demande la moyenne de l\'air des derniers jours, then le fournisseur rend la moyenne des 7 valeurs arrondie au dixième et 7 jours utilisés', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    http.expectOne((r) => r.url === URL_ARCHIVE).flush(reponseArchive(SEPT_JOURS, SEPT_VALEURS));
    expect(await resultat).toStrictEqual({ disponible: true, moyenneC: 10.2, joursUtilises: 7 });
  });

  it('critère 0 : given des valeurs dont la moyenne vaut 10,27, when on demande la moyenne, then elle est arrondie au dixième supérieur (10,3)', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    http.expectOne((r) => r.url === URL_ARCHIVE).flush(reponseArchive(SEPT_JOURS, [10, 10, 10, 10, 10, 10, 11.9]));
    expect(await resultat).toStrictEqual({ disponible: true, moyenneC: 10.3, joursUtilises: 7 });
  });

  it('critère 0 : given une moyenne légèrement négative qui s\'arrondit à zéro, when on demande la moyenne, then elle vaut 0 et non -0', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    http.expectOne((r) => r.url === URL_ARCHIVE).flush(reponseArchive(SEPT_JOURS, [-0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.04]));
    const moyenne = await resultat;
    expect(moyenne).toMatchObject({ disponible: true, joursUtilises: 7 });
    expect(Object.is((moyenne as { moyenneC: number }).moyenneC, 0)).toBe(true);
  });

  it('critère 0 : given un lieu et un moment, when on demande la moyenne, then un seul GET archive demande la température moyenne journalière des 7 jours précédant le jour du moment (fuseau Europe/Paris)', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    const req = http.expectOne((r) => r.url === URL_ARCHIVE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('latitude')).toBe(String(LIEU.latitude));
    expect(req.request.params.get('longitude')).toBe(String(LIEU.longitude));
    expect(req.request.params.get('daily')).toBe('temperature_2m_mean');
    expect(req.request.params.get('timezone')).toBe('Europe/Paris');
    expect(req.request.params.get('start_date')).toBe('2026-10-29');
    expect(req.request.params.get('end_date')).toBe('2026-11-04');
    http.expectNone((r) => r.url === URL_PREVISION);
    req.flush(reponseArchive(SEPT_JOURS, SEPT_VALEURS));
    await resultat;
  });

  it('critère 0 : given un moment à 00 h 30 le 5 novembre à Paris (23 h 30 UTC le 4), when on demande la moyenne, then la fenêtre est celle du jour de Paris (29 octobre au 4 novembre)', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, new Date('2026-11-04T23:30:00Z'));
    const req = http.expectOne((r) => r.url === URL_ARCHIVE);
    expect(req.request.params.get('start_date')).toBe('2026-10-29');
    expect(req.request.params.get('end_date')).toBe('2026-11-04');
    req.flush(reponseArchive(SEPT_JOURS, SEPT_VALEURS));
    expect(await resultat).toStrictEqual({ disponible: true, moyenneC: 10.2, joursUtilises: 7 });
  });

  it('critère 0 : given un moment à 0 h 30 le jour du changement d\'heure d\'été (heure de Paris), when on demande la moyenne, then la fenêtre est celle du jour de Paris', async () => {
    const { fournisseur, http } = miseEnPlace();
    // 2026-03-29 00:30 à Paris = 2026-03-28T23:30Z (UTC+1) ; fenêtre : 22 au 28 mars.
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, new Date('2026-03-28T23:30:00Z'));
    const req = http.expectOne((r) => r.url === URL_ARCHIVE);
    expect(req.request.params.get('start_date')).toBe('2026-03-22');
    expect(req.request.params.get('end_date')).toBe('2026-03-28');
    req.flush(reponseArchive([], []));
    await resultat;
  });

  it('critère 1 : given une réponse archive simulée qui ne contient que 5 des 7 jours, when on demande la moyenne, then il rend la moyenne des 5 jours disponibles et 5 jours utilisés', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    // 5 jours présents : 10-31 à 11-04 ; 10,0 + 12,0 + 8,0 + 9,0 + 11,5 = 50,5 → 10,1
    http.expectOne((r) => r.url === URL_ARCHIVE).flush(reponseArchive(SEPT_JOURS.slice(2), [10, 12, 8, 9, 11.5]));
    expect(await resultat).toStrictEqual({ disponible: true, moyenneC: 10.1, joursUtilises: 5 });
  });

  it('critère 1 : given une réponse dont 2 jours sont à null, when on demande la moyenne, then les jours null sont ignorés : moyenne des 5 autres et 5 jours utilisés', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    http.expectOne((r) => r.url === URL_ARCHIVE).flush(reponseArchive(SEPT_JOURS, [null, 10, 12, 8, 9, 11.5, null]));
    expect(await resultat).toStrictEqual({ disponible: true, moyenneC: 10.1, joursUtilises: 5 });
  });

  it('critère 1 : given une réponse avec 6 jours, when on demande la moyenne, then le nombre de jours utilisés est 6', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    http.expectOne((r) => r.url === URL_ARCHIVE).flush(reponseArchive(SEPT_JOURS.slice(1), [10, 10, 10, 10, 10, 12]));
    expect(await resultat).toStrictEqual({ disponible: true, moyenneC: 10.3, joursUtilises: 6 });
  });

  it('critère 2 : given une réponse archive simulée qui ne contient que 4 jours, when on demande la moyenne, then il rend « moyenne indisponible »', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    http.expectOne((r) => r.url === URL_ARCHIVE).flush(reponseArchive(SEPT_JOURS.slice(3), [10, 12, 8, 9]));
    expect(await resultat).toStrictEqual({ disponible: false });
  });

  it('critère 2 : given une réponse de 7 jours dont 3 sont à null (4 valeurs), when on demande la moyenne, then il rend « moyenne indisponible »', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    http.expectOne((r) => r.url === URL_ARCHIVE).flush(reponseArchive(SEPT_JOURS, [10, null, 12, null, 8, null, 9]));
    expect(await resultat).toStrictEqual({ disponible: false });
  });

  it('critère 2 : given 4 jours dans la fenêtre et 3 jours hors fenêtre, when on demande la moyenne, then les jours hors fenêtre ne comptent pas et il rend « moyenne indisponible »', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    const jours = ['2026-10-28', ...SEPT_JOURS.slice(3), '2026-11-05', '2026-11-06'];
    http.expectOne((r) => r.url === URL_ARCHIVE).flush(reponseArchive(jours, [1, 10, 12, 8, 9, 20, 20]));
    expect(await resultat).toStrictEqual({ disponible: false });
  });

  it('critère 2 : given une réponse sans bloc daily, when on demande la moyenne, then il rend « moyenne indisponible »', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    http.expectOne((r) => r.url === URL_ARCHIVE).flush({ latitude: 47.47, longitude: -0.55 });
    expect(await resultat).toStrictEqual({ disponible: false });
  });

  it('critère 2 : given une réponse HTTP 500 simulée sur l\'archive, when on demande la moyenne, then il rend « moyenne indisponible » sans rejeter', async () => {
    const { fournisseur, http } = miseEnPlace();
    const resultat = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    http.expectOne((r) => r.url === URL_ARCHIVE).flush({ error: true, reason: 'panne' }, { status: 500, statusText: 'Server Error' });
    await expect(resultat).resolves.toStrictEqual({ disponible: false });
  });

  it('given un moment invalide, when on demande la moyenne, then il rend « moyenne indisponible » sans rejeter ni appeler le réseau', async () => {
    const { fournisseur, http } = miseEnPlace();
    await expect(fournisseur.moyenneAirDerniersJours(LIEU, new Date(NaN))).resolves.toStrictEqual({ disponible: false });
    http.expectNone(() => true);
  });

  it('critère 3 : given une erreur réseau simulée sur l\'archive et une réponse forecast simulée valide, when on demande la moyenne de l\'air puis la météo du moment, then la moyenne est « indisponible » et la météo du moment est rendue normalement', async () => {
    const { fournisseur, http } = miseEnPlace();
    const moyenne = fournisseur.moyenneAirDerniersJours(LIEU, MOMENT_MOYENNE);
    http.expectOne((r) => r.url === URL_ARCHIVE).error(new ProgressEvent('error'));
    expect(await moyenne).toStrictEqual({ disponible: false });

    const meteo = fournisseur.meteoActuelle(LIEU);
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponseComplete());
    expect(await meteo).toEqual({
      disponible: true,
      pressionHpa: 1008.4,
      couvertureNuageusePct: 72,
      ventKmh: 14.6,
      temperatureAirC: 11.3,
    });
  });
});

// US 14 : prévisions de toutes les heures des 48 h à venir, pour préparer une sortie hors ligne.
describe('WeatherProvider (Open-Meteo) : prévisions des 48 h à venir (US 14)', () => {
  const HEURE_MS = 3_600_000;
  const DEBUT = new Date('2026-11-24T08:00:00Z');
  const enTexte = (h: Date) => h.toISOString().slice(0, 13) + ':00';
  /** Heures GMT de DEBUT − 48 h à DEBUT + 48 h ; la pression de l'heure i (depuis DEBUT − 48 h) vaut 1000 + i. */
  const serie = (retire?: (i: number) => boolean) => {
    const heures = Array.from({ length: 97 }, (_, i) => new Date(DEBUT.getTime() + (i - 48) * HEURE_MS));
    const colonne = (f: (i: number) => number | null) => heures.map((_, i) => (retire?.(i) ? null : f(i)));
    return {
      hourly: {
        time: heures.map(enTexte),
        temperature_2m: colonne(() => 8),
        cloud_cover: colonne((i) => i),
        wind_speed_10m: colonne(() => 9),
        pressure_msl: colonne((i) => 1000 + i),
      },
    };
  };

  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } finally {
      vi.useRealTimers();
    }
  });

  it('given une réponse complète, when on demande les prévisions 48 h à 8 h 20, then 49 heures pleines de 8 h à + 48 h sont rendues avec leur tendance sur 48 h', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-24T08:20:00Z');
    const resultat = fournisseur.previsions48h(LIEU);
    const req = http.expectOne((r) => r.url === URL_PREVISION);
    expect(req.request.params.get('timezone')).toBe('GMT');
    expect(req.request.params.get('start_hour')).toBe('2026-11-22T08:00');
    expect(req.request.params.get('end_hour')).toBe('2026-11-26T08:00');
    req.flush(serie());

    const previsions = await resultat;
    expect(previsions.disponible).toBe(true);
    if (!previsions.disponible) return;
    expect(previsions.heures).toHaveLength(49);
    expect(previsions.heures[0].heure).toEqual(DEBUT);
    expect(previsions.heures[48].heure).toEqual(new Date('2026-11-26T08:00:00Z'));
    expect(previsions.heures[3]).toEqual({
      disponible: true,
      heure: new Date('2026-11-24T11:00:00Z'),
      pressionHpa: 1051,
      pressionTendance48h: { disponible: true, ecartHpa: 48 },
      couvertureNuageusePct: 51,
      ventKmh: 9,
      temperatureAirC: 8,
    });
  });

  it('given une heure dont une valeur manque, when on demande les prévisions 48 h, then elles sont indisponibles en entier', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-24T08:20:00Z');
    const resultat = fournisseur.previsions48h(LIEU);
    http.expectOne((r) => r.url === URL_PREVISION).flush(serie((i) => i === 70));
    expect(await resultat).toStrictEqual({ disponible: false });
  });

  it('given une réponse qui s\'arrête avant la 48e heure, when on demande les prévisions 48 h, then elles sont indisponibles', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-24T08:20:00Z');
    const resultat = fournisseur.previsions48h(LIEU);
    const reponse = serie();
    for (const colonne of Object.values(reponse.hourly)) colonne.length = 90;
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponse);
    expect(await resultat).toStrictEqual({ disponible: false });
  });

  it('given une heure 48 h avant absente, when on demande les prévisions 48 h, then la tendance de cette heure est indisponible mais les prévisions sont rendues', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-24T08:20:00Z');
    const resultat = fournisseur.previsions48h(LIEU);
    const reponse = serie();
    // On retire la première heure (DEBUT − 48 h) : la tendance de DEBUT n'a plus de point de départ.
    for (const colonne of Object.values(reponse.hourly)) colonne.shift();
    http.expectOne((r) => r.url === URL_PREVISION).flush(reponse);
    const previsions = await resultat;
    expect(previsions.disponible).toBe(true);
    if (previsions.disponible) expect(previsions.heures[0].pressionTendance48h).toEqual({ disponible: false });
  });

  it('given une erreur réseau, when on demande les prévisions 48 h, then elles sont indisponibles sans rejet', async () => {
    const { fournisseur, http } = miseEnPlacePrevue('2026-11-24T08:20:00Z');
    const resultat = fournisseur.previsions48h(LIEU);
    http.expectOne((r) => r.url === URL_PREVISION).error(new ProgressEvent('error'));
    expect(await resultat).toStrictEqual({ disponible: false });
  });
});
