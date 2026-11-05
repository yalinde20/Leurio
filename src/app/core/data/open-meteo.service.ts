import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { heureDemandee, Lieu, ResultatMeteo, ResultatMeteoPrevue, tendancePression48h, WeatherProvider } from './weather-provider';

const URL_PREVISION = 'https://api.open-meteo.com/v1/forecast';
/** Au-delà, la requête est abandonnée : un réseau faible ne bloque jamais le conseil (PLAN §4). */
const DELAI_MAX_MS = 10_000;
const VALEURS = 'temperature_2m,cloud_cover,wind_speed_10m,pressure_msl';

interface ReponsePrevision {
  current?: Partial<Record<'temperature_2m' | 'cloud_cover' | 'wind_speed_10m' | 'pressure_msl', unknown>> | null;
  hourly?: {
    time?: unknown;
    temperature_2m?: unknown;
    cloud_cover?: unknown;
    wind_speed_10m?: unknown;
    pressure_msl?: unknown;
  } | null;
}

const estUnNombre = (valeur: unknown): valeur is number => typeof valeur === 'number' && Number.isFinite(valeur);

const valeurA = (serie: unknown, index: number): unknown => (Array.isArray(serie) ? serie[index] : undefined);

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
            current: VALEURS,
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

  async meteoPrevue(lieu: Lieu, moment: Date): Promise<ResultatMeteoPrevue> {
    const demande = heureDemandee(moment, new Date());
    if (!('heure' in demande)) {
      return demande;
    }
    const { heure } = demande;
    // Format GMT « AAAA-MM-JJTHH:00 », celui de la réponse (timezone=GMT) ; la fenêtre va de 48 h avant le moment au moment.
    const enTexte = (h: Date) => h.toISOString().slice(0, 13) + ':00';
    const heureTexte = enTexte(heure);
    const avant48hTexte = enTexte(new Date(heure.getTime() - 48 * 3_600_000));
    try {
      const reponse = await firstValueFrom(
        this.http.get<ReponsePrevision>(URL_PREVISION, {
          params: {
            latitude: lieu.latitude,
            longitude: lieu.longitude,
            hourly: VALEURS,
            timezone: 'GMT',
            start_hour: avant48hTexte,
            end_hour: heureTexte,
            temperature_unit: 'celsius',
            wind_speed_unit: 'kmh',
          },
        }).pipe(timeout(DELAI_MAX_MS)),
      );
      const horaire = reponse?.hourly;
      const index = Array.isArray(horaire?.time) ? horaire.time.indexOf(heureTexte) : -1;
      const indexAvant = Array.isArray(horaire?.time) ? horaire.time.indexOf(avant48hTexte) : -1;
      if (horaire && index >= 0) {
        const pression = valeurA(horaire.pressure_msl, index);
        const nuages = valeurA(horaire.cloud_cover, index);
        const vent = valeurA(horaire.wind_speed_10m, index);
        const temperature = valeurA(horaire.temperature_2m, index);
        if (estUnNombre(pression) && estUnNombre(nuages) && estUnNombre(vent) && estUnNombre(temperature)) {
          return {
            disponible: true,
            pressionHpa: pression,
            couvertureNuageusePct: nuages,
            ventKmh: vent,
            temperatureAirC: temperature,
            heure,
            pressionTendance48h: tendancePression48h(pression, indexAvant >= 0 ? valeurA(horaire.pressure_msl, indexAvant) : undefined),
          };
        }
      }
    } catch {
      // Réseau coupé ou erreur HTTP : une source indisponible ne bloque jamais le conseil (PLAN §4).
    }
    return { disponible: false };
  }
}
