import { inject, Injectable } from '@angular/core';
import { estimerTempEau } from '../engine/temperature-eau';
import { HubeauService, ResultatTemperatureEau, TemperatureEauMesuree } from './hubeau.service';
import { Lieu, MoyenneAir, WeatherProvider } from './weather-provider';

/** Température de l'eau mesurée par une station Hub'Eau active à moins de 30 km. */
export interface TempEauCapteur {
  statut: 'connue';
  tempEauC: number;
  source: 'capteur';
  station: TemperatureEauMesuree['station'];
  distanceKm: number;
  date: string;
  heure: string;
}

/** Température de l'eau estimée depuis la moyenne de l'air des derniers jours, bornée à 0 °C. */
export interface TempEauEstimee {
  statut: 'connue';
  tempEauC: number;
  source: 'estimation';
  moyenneAirC: number;
  joursUtilises: number;
}

/** Ni mesure ni moyenne de l'air : aucune valeur n'est inventée. */
export interface TempEauInconnue {
  statut: "température de l'eau inconnue";
}

export type ResultatTempEau = TempEauCapteur | TempEauEstimee | TempEauInconnue;

/**
 * Température de l'eau près d'un lieu (PLAN §4, §8.2) : la mesure d'une station Hub'Eau active à moins de 30 km,
 * sinon l'estimation depuis la moyenne de l'air, sinon « température de l'eau inconnue ».
 */
@Injectable({ providedIn: 'root' })
export class TemperatureEauService {
  private readonly hubeau = inject(HubeauService);
  private readonly weather = inject(WeatherProvider);

  /** Ne rejette jamais : une source en panne est traitée comme indisponible et on passe à la suivante. */
  async temperatureEauProche(lieu: Lieu, moment: Date = new Date()): Promise<ResultatTempEau> {
    let mesure: ResultatTemperatureEau | undefined;
    try {
      mesure = await this.hubeau.temperatureEauProche(lieu, moment);
    } catch {
      mesure = undefined;
    }
    if (mesure?.statut === 'mesure') {
      return {
        statut: 'connue',
        tempEauC: mesure.temperatureC,
        source: 'capteur',
        station: mesure.station,
        distanceKm: mesure.distanceKm,
        date: mesure.date,
        heure: mesure.heure,
      };
    }

    let moyenne: MoyenneAir;
    try {
      // Sans réseau (mode avion), la moyenne de l'air n'est même pas demandée.
      moyenne = navigator.onLine === false ? { disponible: false } : await this.weather.moyenneAirDerniersJours(lieu, moment);
    } catch {
      moyenne = { disponible: false };
    }
    if (moyenne.disponible) {
      return { statut: 'connue', ...estimerTempEau(moyenne.moyenneC), moyenneAirC: moyenne.moyenneC, joursUtilises: moyenne.joursUtilises };
    }
    return { statut: "température de l'eau inconnue" };
  }
}
