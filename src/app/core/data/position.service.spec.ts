// US 59 : position GPS ou spot enregistré (PLAN §2, §4 ; Capacitor Geolocation remplacé par un double).
// Contrat : position.service.ts exporte `PositionService` (providedIn root) avec
//   positionGps(): Promise<ResultatPosition>
//   positionSpot(spot: Spot): Promise<ResultatPosition>
// ainsi que POSITION_REFUSEE, POSITION_INDISPONIBLE, DELAI_GPS_MS (15 000 ms) et le jeton GEOLOCALISATION.
import { TestBed } from '@angular/core/testing';
import {
  DELAI_GPS_MS,
  GEOLOCALISATION,
  Geolocalisation,
  POSITION_INDISPONIBLE,
  POSITION_REFUSEE,
  PositionService,
  Spot,
} from './position.service';

const ANGERS = { latitude: 47.478, longitude: -0.563 };

type Permission = Awaited<ReturnType<Geolocalisation['checkPermissions']>>['location'];

function doubleGeolocalisation(
  permission: Permission,
  getCurrentPosition: Geolocalisation['getCurrentPosition'],
) {
  const checkPermissions = vi.fn(async () => ({ location: permission }));
  const position = vi.fn(getCurrentPosition);
  const double: Geolocalisation = { checkPermissions, getCurrentPosition: position };
  TestBed.configureTestingModule({ providers: [{ provide: GEOLOCALISATION, useValue: double }] });
  return { checkPermissions, getCurrentPosition: position };
}

function service(): PositionService {
  return TestBed.inject(PositionService);
}

describe('PositionService (GPS ou spot enregistré)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('critère 0 : given l’autorisation accordée et une position simulée à Angers, when on demande la position en mode GPS, then le service rend latitude, longitude, précision et département « 49 »', async () => {
    doubleGeolocalisation('granted', async () => ({
      coords: { latitude: ANGERS.latitude, longitude: ANGERS.longitude, accuracy: 12 },
    }));

    const resultat = await service().positionGps();

    expect(resultat).toEqual({
      disponible: true,
      source: 'gps',
      latitude: ANGERS.latitude,
      longitude: ANGERS.longitude,
      precisionM: 12,
      departement: '49',
    });
  });

  it('critère 1 : given l’autorisation de localisation refusée, when on demande la position en mode GPS, then le service rend « position refusée »', async () => {
    const { getCurrentPosition } = doubleGeolocalisation('denied', async () => ({
      coords: { latitude: ANGERS.latitude, longitude: ANGERS.longitude, accuracy: 12 },
    }));

    const resultat = await service().positionGps();

    expect(POSITION_REFUSEE).toBe('position refusée');
    expect(resultat).toEqual({ disponible: false, motif: POSITION_REFUSEE });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('critère 1 : given l’autorisation à demander puis refusée par l’utilisateur (code 1), when on demande la position en mode GPS, then le service rend « position refusée »', async () => {
    doubleGeolocalisation('prompt', async () => {
      throw { code: 1, message: 'User denied Geolocation' };
    });

    const resultat = await service().positionGps();

    expect(resultat).toEqual({ disponible: false, motif: POSITION_REFUSEE });
  });

  it('critère 2 : given la localisation sans réponse dans le délai prévu, when on demande la position en mode GPS, then le service rend « position indisponible », distinct de « position refusée »', async () => {
    vi.useFakeTimers();
    doubleGeolocalisation('granted', () => new Promise<never>(() => undefined));

    const attente = service().positionGps();
    await vi.advanceTimersByTimeAsync(DELAI_GPS_MS);
    const resultat = await attente;

    expect(DELAI_GPS_MS).toBe(15000);
    expect(POSITION_INDISPONIBLE).toBe('position indisponible');
    expect(POSITION_INDISPONIBLE).not.toBe(POSITION_REFUSEE);
    expect(resultat).toEqual({ disponible: false, motif: POSITION_INDISPONIBLE });
    expect(resultat).not.toEqual({ disponible: false, motif: POSITION_REFUSEE });
  });

  it('critère 2 : given la localisation qui échoue par délai dépassé (code 3), when on demande la position en mode GPS, then le service rend « position indisponible »', async () => {
    doubleGeolocalisation('granted', async () => {
      throw { code: 3, message: 'Timeout expired' };
    });

    const resultat = await service().positionGps();

    expect(resultat).toEqual({ disponible: false, motif: POSITION_INDISPONIBLE });
  });

  it('critère 3 : given un spot enregistré (nom, latitude, longitude, département), when on demande la position de ce spot, then le service rend ses coordonnées et son département, sans demander le GPS', async () => {
    const { checkPermissions, getCurrentPosition } = doubleGeolocalisation('granted', async () => ({
      coords: { latitude: 0, longitude: 0, accuracy: 1 },
    }));
    const spot: Spot = { nom: 'Étang de Saint-Nicolas', lat: 47.478, lng: -0.563, departement: '49' };

    const resultat = await service().positionSpot(spot);

    expect(resultat).toMatchObject({
      disponible: true,
      source: 'spot',
      latitude: 47.478,
      longitude: -0.563,
      departement: '49',
    });
    expect(checkPermissions).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
