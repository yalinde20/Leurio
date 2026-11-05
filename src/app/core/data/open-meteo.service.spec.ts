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
