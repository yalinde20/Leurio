import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { Lieu, ResultatMeteo, WeatherProvider } from './weather-provider';

const URL_PREVISION = 'https://api.open-meteo.com/v1/forecast';
/** Au-delà, la requête est abandonnée : un réseau faible ne bloque jamais le conseil (PLAN §4). */
const DELAI_MAX_MS = 10_000;
const VALEURS_COURANTES = 'temperature_2m,cloud_cover,wind_speed_10m,pressure_msl';

interface ReponsePrevision {
  current?: Partial<Record<'temperature_2m' | 'cloud_cover' | 'wind_speed_10m' | 'pressure_msl', unknown>> | null;
}

const estUnNombre = (valeur: unknown): valeur is number => typeof valeur === 'number' && Number.isFinite(valeur);

/** Lit la météo du moment chez Open-Meteo (PLAN §4) : pression en hPa, nuages en %, vent en km/h, air en °C. */
@Injectable()
export class OpenMeteoService extends WeatherProvider {
  private readonly http = inject(HttpClient);

  async meteoActuelle(lieu: Lieu): Promise<ResultatMeteo> {
    try {
      const reponse = await firstValueFrom(
        this.http.get<ReponsePrevision>(URL_PREVISION, {
          params: {
            latitude: lieu.latitude,
            longitude: lieu.longitude,
            current: VALEURS_COURANTES,
            temperature_unit: 'celsius',
            wind_speed_unit: 'kmh',
          },
        }).pipe(timeout(DELAI_MAX_MS)),
      );
      const courant = reponse?.current;
      // Une valeur manquante ou invalide rend la météo indisponible en entier : on n'invente rien.
      if (
        courant &&
        estUnNombre(courant.pressure_msl) &&
        estUnNombre(courant.cloud_cover) &&
        estUnNombre(courant.wind_speed_10m) &&
        estUnNombre(courant.temperature_2m)
      ) {
        return {
          disponible: true,
          pressionHpa: courant.pressure_msl,
          couvertureNuageusePct: courant.cloud_cover,
          ventKmh: courant.wind_speed_10m,
          temperatureAirC: courant.temperature_2m,
        };
      }
    } catch {
      // Réseau coupé ou erreur HTTP : une source indisponible ne bloque jamais le conseil (PLAN §4).
    }
    return { disponible: false };
  }
}
