// US 55 : le service ne rejette jamais, même si une source lève une erreur (PLAN §4).
import { TestBed } from '@angular/core/testing';
import { HubeauService } from './hubeau.service';
import { Lieu, WeatherProvider } from './weather-provider';
import { TemperatureEauService } from './temperature-eau.service';

const LIEU: Lieu = { latitude: 47.47, longitude: -0.55 };
const MAINTENANT = new Date('2026-11-06T10:00:00Z');

describe('TemperatureEauService en cas de panne', () => {
  it("given Hub'Eau qui rejette et une moyenne de l'air disponible, when on demande la température de l'eau, then le service estime depuis l'air", async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: HubeauService, useValue: { temperatureEauProche: vi.fn().mockRejectedValue(new Error('panne')) } },
        { provide: WeatherProvider, useValue: { moyenneAirDerniersJours: vi.fn().mockResolvedValue({ disponible: true, moyenneC: 8, joursUtilises: 7 }) } },
      ],
    });
    await expect(TestBed.inject(TemperatureEauService).temperatureEauProche(LIEU, MAINTENANT)).resolves.toEqual({
      statut: 'connue',
      tempEauC: 8,
      source: 'estimation',
      moyenneAirC: 8,
      joursUtilises: 7,
    });
  });

  it("given Hub'Eau et la météo qui rejettent, when on demande la température de l'eau, then le service rend « température de l'eau inconnue »", async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: HubeauService, useValue: { temperatureEauProche: vi.fn().mockRejectedValue(new Error('panne')) } },
        { provide: WeatherProvider, useValue: { moyenneAirDerniersJours: vi.fn().mockRejectedValue(new Error('panne')) } },
      ],
    });
    await expect(TestBed.inject(TemperatureEauService).temperatureEauProche(LIEU, MAINTENANT)).resolves.toEqual({
      statut: "température de l'eau inconnue",
    });
  });
});
