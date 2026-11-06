// US 58 : département à partir des coordonnées, sans réseau (PLAN §2.4, §5 core/data/geo.service.ts).
// Contrat : geo.service.ts exporte `GeoService` (providedIn root) avec
//   departement(lieu: Lieu): string   (synchrone) : le code du département ('49', '2A'…) ou `HORS_FRANCE`
// ainsi que la constante `HORS_FRANCE` ('hors France'). France métropolitaine seulement, contours embarqués.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Lieu } from './weather-provider';
import { GeoService, HORS_FRANCE } from './geo.service';

function service(): GeoService {
  return TestBed.inject(GeoService);
}

describe('GeoService (département hors ligne)', () => {
  it('critère 1 : given les coordonnées d’Angers, when on demande le département, then le service rend « 49 »', () => {
    const angers: Lieu = { latitude: 47.478, longitude: -0.563 };
    expect(service().departement(angers)).toBe('49');
  });

  it('critère 2 : given les coordonnées de Rouen, when on demande le département, then le service rend « 76 »', () => {
    const rouen: Lieu = { latitude: 49.443, longitude: 1.099 };
    expect(service().departement(rouen)).toBe('76');
  });

  it('critère 3 : given les coordonnées d’Ajaccio puis de Bastia, when on demande le département, then le service rend « 2A » puis « 2B »', () => {
    const ajaccio: Lieu = { latitude: 41.9192, longitude: 8.7386 };
    const bastia: Lieu = { latitude: 42.6977, longitude: 9.4508 };
    expect(service().departement(ajaccio)).toBe('2A');
    expect(service().departement(bastia)).toBe('2B');
  });

  it('critère 4 : given des coordonnées en Belgique, when on demande le département, then le service rend « hors France »', () => {
    const bruxelles: Lieu = { latitude: 50.8503, longitude: 4.3517 };
    expect(HORS_FRANCE).toBe('hors France');
    expect(service().departement(bruxelles)).toBe(HORS_FRANCE);
  });

  it('critère 4 : given des coordonnées en pleine mer, when on demande le département, then le service rend « hors France »', () => {
    const atlantique: Lieu = { latitude: 46.0, longitude: -5.0 };
    expect(service().departement(atlantique)).toBe(HORS_FRANCE);
  });

  it('critère 5 : given tout accès réseau bloqué par un double, when on demande le département, then le résultat est rendu et aucune requête réseau n’est tentée', () => {
    const fetchOriginal = globalThis.fetch;
    const xhrOriginal = globalThis.XMLHttpRequest;
    const fetchEspion = vi.fn(() => {
      throw new Error('réseau interdit : fetch');
    });
    const xhrEspion = vi.fn(() => {
      throw new Error('réseau interdit : XMLHttpRequest');
    });
    globalThis.fetch = fetchEspion as unknown as typeof fetch;
    globalThis.XMLHttpRequest = xhrEspion as unknown as typeof XMLHttpRequest;
    try {
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      const http = TestBed.inject(HttpTestingController);

      const resultat = service().departement({ latitude: 47.478, longitude: -0.563 });

      expect(resultat).toBe('49');
      expect(fetchEspion).not.toHaveBeenCalled();
      expect(xhrEspion).not.toHaveBeenCalled();
      http.verify();
    } finally {
      globalThis.fetch = fetchOriginal;
      globalThis.XMLHttpRequest = xhrOriginal;
    }
  });
});
