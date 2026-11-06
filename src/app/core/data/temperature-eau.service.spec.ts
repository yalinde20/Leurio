// US 55 : température de l'eau près d'un lieu, mesure Hub'Eau sinon estimation depuis l'air (PLAN §4, §8.2).
// Contrat : temperature-eau.service.ts exporte `TemperatureEauService` (providedIn root) avec
// `temperatureEauProche(lieu, moment?)` qui ne rejette jamais et rend un `ResultatTempEau` :
// { statut: 'connue', source: 'capteur', tempEauC, station, distanceKm, date, heure }
// | { statut: 'connue', source: 'estimation', tempEauC, moyenneAirC, joursUtilises }
// | { statut: "température de l'eau inconnue" }.
// Il injecte HubeauService et WeatherProvider, remplacés ici par des doubles (aucun appel réel).
import { TestBed } from '@angular/core/testing';
import { HubeauService } from './hubeau.service';
import { Lieu, MoyenneAir, WeatherProvider } from './weather-provider';
import { TemperatureEauService } from './temperature-eau.service';

const LIEU: Lieu = { latitude: 47.47, longitude: -0.55 };
const MAINTENANT = new Date('2026-11-06T10:00:00Z');

function miseEnPlace(hubeau: unknown, moyenne: MoyenneAir) {
  const temperatureEauProche = vi.fn().mockResolvedValue(hubeau);
  const moyenneAirDerniersJours = vi.fn().mockResolvedValue(moyenne);
  TestBed.configureTestingModule({
    providers: [
      { provide: HubeauService, useValue: { temperatureEauProche } },
      { provide: WeatherProvider, useValue: { moyenneAirDerniersJours } },
    ],
  });
  return { service: TestBed.inject(TemperatureEauService), temperatureEauProche, moyenneAirDerniersJours };
}

describe("TemperatureEauService", () => {
  it("critère 2 : given Hub'Eau indisponible (double en panne) et une moyenne de l'air disponible, when on demande la température de l'eau près d'un lieu, then le service rend l'estimation depuis l'air avec la source « estimation »", async () => {
    const { service, moyenneAirDerniersJours } = miseEnPlace(
      { statut: "Hub'Eau indisponible" },
      { disponible: true, moyenneC: 12.4, joursUtilises: 7 },
    );
    const resultat = await service.temperatureEauProche(LIEU, MAINTENANT);
    expect(resultat).toEqual({ statut: 'connue', tempEauC: 12.4, source: 'estimation', moyenneAirC: 12.4, joursUtilises: 7 });
    expect(moyenneAirDerniersJours).toHaveBeenCalledWith(LIEU, MAINTENANT);
  });

  it("critère 2 : given Hub'Eau indisponible et une moyenne de l'air de −3 °C, when on demande la température de l'eau, then l'estimation est bornée à 0 °C", async () => {
    const { service } = miseEnPlace({ statut: "Hub'Eau indisponible" }, { disponible: true, moyenneC: -3, joursUtilises: 6 });
    const resultat = await service.temperatureEauProche(LIEU, MAINTENANT);
    expect(resultat).toMatchObject({ statut: 'connue', source: 'estimation', tempEauC: 0, moyenneAirC: -3, joursUtilises: 6 });
  });

  it("critère 3 : given aucune station Hub'Eau active à moins de 30 km et une moyenne de l'air disponible, when on demande la température de l'eau près d'un lieu, then le service rend l'estimation depuis l'air avec la source « estimation »", async () => {
    const { service, moyenneAirDerniersJours } = miseEnPlace(
      { statut: 'aucune station' },
      { disponible: true, moyenneC: 12.4, joursUtilises: 5 },
    );
    const resultat = await service.temperatureEauProche(LIEU, MAINTENANT);
    expect(resultat).toEqual({ statut: 'connue', tempEauC: 12.4, source: 'estimation', moyenneAirC: 12.4, joursUtilises: 5 });
    expect(moyenneAirDerniersJours).toHaveBeenCalledWith(LIEU, MAINTENANT);
  });

  it("critère 3 : given aucune station et une moyenne de l'air de −3 °C, when on demande la température de l'eau, then l'estimation est bornée à 0 °C", async () => {
    const { service } = miseEnPlace({ statut: 'aucune station' }, { disponible: true, moyenneC: -3, joursUtilises: 7 });
    const resultat = await service.temperatureEauProche(LIEU, MAINTENANT);
    expect(resultat).toMatchObject({ statut: 'connue', source: 'estimation', tempEauC: 0 });
  });

  it("critère 4 : given une station Hub'Eau active à moins de 30 km, when on demande la température de l'eau près d'un lieu, then le service rend la mesure de la station avec la source « capteur »", async () => {
    const { service, moyenneAirDerniersJours } = miseEnPlace(
      {
        statut: 'mesure',
        temperatureC: 12.28,
        date: '2026-11-05',
        heure: '09:39:42',
        station: { code: 'S1', nom: 'La Mayenne à Angers' },
        distanceKm: 12,
      },
      { disponible: true, moyenneC: 5, joursUtilises: 7 },
    );
    const resultat = await service.temperatureEauProche(LIEU, MAINTENANT);
    expect(resultat).toEqual({
      statut: 'connue',
      tempEauC: 12.28,
      source: 'capteur',
      station: { code: 'S1', nom: 'La Mayenne à Angers' },
      distanceKm: 12,
      date: '2026-11-05',
      heure: '09:39:42',
    });
    expect(moyenneAirDerniersJours).not.toHaveBeenCalled();
  });

  it("critère 5 : given Hub'Eau indisponible et la moyenne de l'air indisponible, when on demande la température de l'eau près d'un lieu, then le service rend « température de l'eau inconnue »", async () => {
    const { service } = miseEnPlace({ statut: "Hub'Eau indisponible" }, { disponible: false });
    await expect(service.temperatureEauProche(LIEU, MAINTENANT)).resolves.toEqual({ statut: "température de l'eau inconnue" });
  });

  it("critère 5 : given aucune station et la moyenne de l'air indisponible, when on demande la température de l'eau, then le service rend « température de l'eau inconnue » sans inventer de valeur", async () => {
    const { service } = miseEnPlace({ statut: 'aucune station' }, { disponible: false });
    const resultat = await service.temperatureEauProche(LIEU, MAINTENANT);
    expect(resultat).toEqual({ statut: "température de l'eau inconnue" });
    expect(resultat).not.toHaveProperty('tempEauC');
  });
});
