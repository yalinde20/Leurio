import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { Lieu } from './weather-provider';

const URL_CHRONIQUE = 'https://hubeau.eaufrance.fr/api/v1/temperature/chronique';
/** Au-delà, la requête est abandonnée : un réseau faible ne bloque jamais le conseil (PLAN §4). */
const DELAI_MAX_MS = 10_000;
const CHAMPS = 'code_station,libelle_station,longitude,latitude,date_mesure_temp,heure_mesure_temp,resultat';
const RAYON_TERRE_KM = 6371;
const TOLERANCE_KM = 1e-6;
/** Une mesure datée de plus d'une heure dans le futur est une donnée douteuse : elle est ignorée. */
const MARGE_FUTUR_MS = 3_600_000;

/** Rayon de recherche des stations autour du lieu, en km (PLAN §8.2) : une station à 30 km ou plus est trop loin. */
export const RAYON_MAX_KM = 30;
/** Une station dont la dernière mesure est plus vieille que cette durée, en heures, est inactive (PLAN §8.2). */
export const ANCIENNETE_MAX_H = 48;

/** Température de l'eau mesurée par la station active la plus proche. */
export interface TemperatureEauMesuree {
  statut: 'mesure';
  /** Température de l'eau en °C. */
  temperatureC: number;
  /** Date de la mesure, « AAAA-MM-JJ », telle que Hub'Eau la donne (lue comme UTC). */
  date: string;
  /** Heure de la mesure, « HH:MM:SS », telle que Hub'Eau la donne (lue comme UTC). */
  heure: string;
  station: { code: string; nom: string };
  /** Distance du lieu à la station en km, arrondie à 0,1 km. */
  distanceKm: number;
}

/** Aucune station active dans le rayon : la source répond, mais n'a rien à proposer. */
export interface AucuneStationEau {
  statut: 'aucune station';
}

/** Hub'Eau ne répond pas (réseau, erreur HTTP, délai dépassé ou réponse illisible) : distinct d'« aucune station ». */
export interface HubeauIndisponible {
  statut: "Hub'Eau indisponible";
}

export type ResultatTemperatureEau = TemperatureEauMesuree | AucuneStationEau | HubeauIndisponible;

interface ReponseChronique {
  data?: unknown;
}

interface MesureStation {
  code: string;
  nom: string;
  latitude: number;
  longitude: number;
  instant: number;
  date: string;
  heure: string;
  temperatureC: number;
}

const estUnNombre = (valeur: unknown): valeur is number => typeof valeur === 'number' && Number.isFinite(valeur);

const enRadians = (degres: number): number => (degres * Math.PI) / 180;

/** Distance orthodromique (haversine, rayon terrestre de 6371 km) entre deux points, en km. */
export function distanceKm(a: Lieu, b: Lieu): number {
  const dLat = enRadians(b.latitude - a.latitude);
  const dLon = enRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(enRadians(a.latitude)) * Math.cos(enRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Lit une ligne de la réponse ; rend undefined si un champ utile manque ou est invalide. */
function lireMesure(ligne: unknown): MesureStation | undefined {
  if (typeof ligne !== 'object' || ligne === null) return undefined;
  const l = ligne as Record<string, unknown>;
  const { code_station: code, libelle_station: nom, latitude, longitude, date_mesure_temp: date, heure_mesure_temp: heure, resultat } = l;
  if (typeof code !== 'string' || code === '') return undefined;
  if (!estUnNombre(latitude) || !estUnNombre(longitude) || !estUnNombre(resultat)) return undefined;
  if (typeof date !== 'string' || typeof heure !== 'string') return undefined;
  const instant = Date.parse(`${date}T${heure}Z`);
  if (!Number.isFinite(instant)) return undefined;
  return { code, nom: typeof nom === 'string' ? nom : code, latitude, longitude, instant, date, heure, temperatureC: resultat };
}

/** Lit la température de l'eau chez Hub'Eau (PLAN §4, §8.2) : station active la plus proche, à moins de 30 km. */
@Injectable({ providedIn: 'root' })
export class HubeauService {
  private readonly http = inject(HttpClient);

  /** Ne rejette jamais : toute panne rend « Hub'Eau indisponible » (PLAN §4). */
  async temperatureEauProche(lieu: Lieu, maintenant: Date = new Date()): Promise<ResultatTemperatureEau> {
    const limite = maintenant.getTime() - ANCIENNETE_MAX_H * 3_600_000;
    try {
      const reponse = await firstValueFrom(
        this.http.get<ReponseChronique>(URL_CHRONIQUE, {
          params: {
            latitude: lieu.latitude,
            longitude: lieu.longitude,
            distance: RAYON_MAX_KM,
            date_debut_mesure: new Date(limite).toISOString().slice(0, 10),
            sort: 'desc',
            // Tri décroissant : si la limite tronque la réponse, seules les mesures les plus anciennes manquent.
            size: 5000,
            fields: CHAMPS,
          },
        }).pipe(timeout(DELAI_MAX_MS)),
      );
      const lignes = reponse?.data;
      if (!Array.isArray(lignes)) return { statut: "Hub'Eau indisponible" };

      // Dernière mesure valide de chaque station, sans compter sur l'ordre du serveur.
      const dernieres = new Map<string, MesureStation>();
      for (const ligne of lignes) {
        const mesure = lireMesure(ligne);
        const connue = mesure && dernieres.get(mesure.code);
        if (mesure && (!connue || mesure.instant > connue.instant)) dernieres.set(mesure.code, mesure);
      }

      let meilleure: { mesure: MesureStation; distance: number } | undefined;
      for (const mesure of dernieres.values()) {
        // Inactive (dernière mesure de plus de 48 h) ou datée dans le futur (donnée douteuse) : ignorée.
        if (mesure.instant < limite || mesure.instant > maintenant.getTime() + MARGE_FUTUR_MS) continue;
        // Borne stricte (< 30 km) sur la distance brute ; la tolérance garde dehors une station pile à 30 km malgré l'erreur flottante.
        const distance = distanceKm(lieu, mesure);
        if (distance >= RAYON_MAX_KM - TOLERANCE_KM) continue;
        if (!meilleure || distance < meilleure.distance || (distance === meilleure.distance && mesure.instant > meilleure.mesure.instant)) {
          meilleure = { mesure, distance };
        }
      }
      if (!meilleure) return { statut: 'aucune station' };
      const { mesure, distance } = meilleure;
      return {
        statut: 'mesure',
        temperatureC: mesure.temperatureC,
        date: mesure.date,
        heure: mesure.heure,
        station: { code: mesure.code, nom: mesure.nom },
        distanceKm: Math.round(distance * 10) / 10,
      };
    } catch {
      // Réseau coupé, erreur HTTP ou délai dépassé : une source indisponible ne bloque jamais le conseil (PLAN §4).
      return { statut: "Hub'Eau indisponible" };
    }
  }
}
