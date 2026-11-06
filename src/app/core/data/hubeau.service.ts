import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { Lieu } from './weather-provider';

const URL_STATIONS_HYDRO = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie/referentiel/stations';
const URL_OBSERVATIONS_TR = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr';
const URL_OBS_ELAB = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie/obs_elab';
const URL_CHRONIQUE = 'https://hubeau.eaufrance.fr/api/v1/temperature/chronique';
/** Au-delà, la requête est abandonnée : un réseau faible ne bloque jamais le conseil (PLAN §4). */
const DELAI_MAX_MS = 10_000;
const CHAMPS = 'code_station,libelle_station,longitude,latitude,date_mesure_temp,heure_mesure_temp,resultat';
const CHAMPS_STATIONS_HYDRO = 'code_station,libelle_station,longitude_station,latitude_station';
const CHAMPS_OBSERVATIONS = 'code_station,date_obs,resultat_obs';
const CHAMPS_MOYENNES = 'code_station,resultat_obs_elab';
const MS_PAR_JOUR = 86_400_000;
/** Hub'Eau donne les débits en L/s ; l'app les affiche en m³/s. */
const LITRES_PAR_M3 = 1000;
const RAYON_TERRE_KM = 6371;
const TOLERANCE_KM = 1e-6;
/** Une mesure datée de plus d'une heure dans le futur est une donnée douteuse : elle est ignorée. */
const MARGE_FUTUR_MS = 3_600_000;

/** Rayon de recherche des stations autour du lieu, en km (PLAN §8.2) : une station à 30 km ou plus est trop loin. */
export const RAYON_MAX_KM = 30;
/**
 * Une station dont la dernière mesure est plus vieille que cette durée, en heures (7 jours), est inactive (PLAN §8.2).
 * Hub'Eau publie les températures avec quelques jours de retard (le 06/11/2026, la mesure la plus récente en France datait
 * du 03/11) : un seuil de 48 h ne retenait presque jamais de station. Choix du propriétaire, US 53.
 */
export const ANCIENNETE_MAX_H = 7 * 24;

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

/** Débit actuel ≥ 1,5 × la moyenne des 30 derniers jours : crue (PLAN §8.1). */
export const SEUIL_CRUE = 1.5;
/** Débit actuel ≤ 0,5 × la moyenne des 30 derniers jours : étiage (PLAN §8.1). */
export const SEUIL_ETIAGE = 0.5;
/** Durée, en jours, de la moyenne à laquelle on compare le débit actuel (PLAN §8.1). */
export const DUREE_MOYENNE_JOURS = 30;

export type TendanceDebit = 'crue' | 'normal' | 'étiage';

/** Tendance du débit de la station active la plus proche. */
export interface TendanceDebitMesuree {
  statut: 'tendance';
  tendance: TendanceDebit;
  station: { code: string; nom: string };
  /** Distance du lieu à la station en km, arrondie à 0,1 km. */
  distanceKm: number;
  /** Dernier débit observé, en m³/s. */
  debitActuelM3s: number;
  /** Moyenne des débits moyens journaliers des 30 derniers jours, en m³/s. */
  debitMoyenM3s: number;
  /** Date de l'observation, « date_obs » telle que Hub'Eau la donne. */
  dateMesure: string;
}

export type ResultatTendanceDebit = TendanceDebitMesuree | AucuneStationEau | HubeauIndisponible;

interface StationHydro {
  code: string;
  nom: string;
  latitude: number;
  longitude: number;
}

interface ObservationDebit {
  instant: number;
  date: string;
  debitM3s: number;
}

interface ReponseHubeau {
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

/** Lit une station du référentiel hydrométrique ; rend undefined si un champ utile manque. */
function lireStationHydro(ligne: unknown): StationHydro | undefined {
  if (typeof ligne !== 'object' || ligne === null) return undefined;
  const { code_station: code, libelle_station: nom, latitude_station: latitude, longitude_station: longitude } = ligne as Record<string, unknown>;
  if (typeof code !== 'string' || code === '' || !estUnNombre(latitude) || !estUnNombre(longitude)) return undefined;
  return { code, nom: typeof nom === 'string' ? nom : code, latitude, longitude };
}

/** Lit une observation de débit (L/s chez Hub'Eau, m³/s ici) ; rend undefined si elle est invalide. */
function lireObservationDebit(ligne: unknown): (ObservationDebit & { code: string }) | undefined {
  if (typeof ligne !== 'object' || ligne === null) return undefined;
  const { code_station: code, date_obs: date, resultat_obs: resultat } = ligne as Record<string, unknown>;
  if (typeof code !== 'string' || typeof date !== 'string' || !estUnNombre(resultat)) return undefined;
  const instant = Date.parse(date);
  if (!Number.isFinite(instant)) return undefined;
  return { code, instant, date, debitM3s: resultat / LITRES_PAR_M3 };
}

function tendanceDuDebit(actuel: number, moyen: number): TendanceDebit {
  if (actuel >= SEUIL_CRUE * moyen) return 'crue';
  if (actuel <= SEUIL_ETIAGE * moyen) return 'étiage';
  return 'normal';
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
        this.http.get<ReponseHubeau>(URL_CHRONIQUE, {
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
        // Inactive (dernière mesure de plus de 7 jours) ou datée dans le futur (donnée douteuse) : ignorée.
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

  /**
   * Tendance du débit près du lieu (PLAN §4, §8.1) : débit actuel de la station active la plus proche (< 30 km)
   * comparé à la moyenne des 30 derniers jours. Trois appels séquentiels ; ne rejette jamais.
   */
  async tendanceDebitProche(lieu: Lieu, maintenant: Date = new Date()): Promise<ResultatTendanceDebit> {
    const limite = maintenant.getTime() - ANCIENNETE_MAX_H * 3_600_000;
    try {
      const stationsReponse = await firstValueFrom(
        this.http.get<ReponseHubeau>(URL_STATIONS_HYDRO, {
          params: {
            latitude: lieu.latitude,
            longitude: lieu.longitude,
            distance: RAYON_MAX_KM,
            en_service: true,
            size: 200,
            fields: CHAMPS_STATIONS_HYDRO,
          },
        }).pipe(timeout(DELAI_MAX_MS)),
      );
      if (!Array.isArray(stationsReponse?.data)) return { statut: "Hub'Eau indisponible" };
      const stations = new Map<string, StationHydro>();
      for (const ligne of stationsReponse.data) {
        const station = lireStationHydro(ligne);
        if (station) stations.set(station.code, station);
      }
      if (stations.size === 0) return { statut: 'aucune station' };

      const observationsReponse = await firstValueFrom(
        this.http.get<ReponseHubeau>(URL_OBSERVATIONS_TR, {
          params: {
            code_entite: [...stations.keys()].join(','),
            grandeur_hydro: 'Q',
            date_debut_obs: new Date(limite).toISOString(),
            // Pas de `timestep` : Hub'Eau le refuse (HTTP 400) dès que plusieurs stations sont demandées.
            // Tri décroissant : si la limite tronque la réponse, seules les mesures les plus anciennes manquent.
            sort: 'desc',
            size: 20000,
            fields: CHAMPS_OBSERVATIONS,
          },
        }).pipe(timeout(DELAI_MAX_MS)),
      );
      if (!Array.isArray(observationsReponse?.data)) return { statut: "Hub'Eau indisponible" };

      // Dernière observation valide de chaque station, sans compter sur l'ordre du serveur.
      const dernieres = new Map<string, ObservationDebit>();
      for (const ligne of observationsReponse.data) {
        const observation = lireObservationDebit(ligne);
        const connue = observation && dernieres.get(observation.code);
        if (observation && (!connue || observation.instant > connue.instant)) dernieres.set(observation.code, observation);
      }

      let meilleure: { station: StationHydro; observation: ObservationDebit; distance: number } | undefined;
      for (const [code, observation] of dernieres) {
        const station = stations.get(code);
        if (!station) continue;
        // Inactive (plus de 7 jours) ou datée dans le futur (donnée douteuse) : ignorée.
        if (observation.instant < limite || observation.instant > maintenant.getTime() + MARGE_FUTUR_MS) continue;
        const distance = distanceKm(lieu, station);
        if (distance >= RAYON_MAX_KM - TOLERANCE_KM) continue;
        if (
          !meilleure ||
          distance < meilleure.distance ||
          (distance === meilleure.distance && observation.instant > meilleure.observation.instant)
        ) {
          meilleure = { station, observation, distance };
        }
      }
      if (!meilleure) return { statut: 'aucune station' };
      const { station, observation, distance } = meilleure;

      const moyennesReponse = await firstValueFrom(
        this.http.get<ReponseHubeau>(URL_OBS_ELAB, {
          params: {
            code_entite: station.code,
            grandeur_hydro_elab: 'QmnJ',
            date_debut_obs_elab: new Date(maintenant.getTime() - DUREE_MOYENNE_JOURS * MS_PAR_JOUR).toISOString().slice(0, 10),
            size: 100,
            fields: CHAMPS_MOYENNES,
          },
        }).pipe(timeout(DELAI_MAX_MS)),
      );
      if (!Array.isArray(moyennesReponse?.data)) return { statut: "Hub'Eau indisponible" };
      const valeurs = moyennesReponse.data
        .map((ligne: unknown) => (ligne as Record<string, unknown> | null)?.['resultat_obs_elab'])
        .filter(estUnNombre)
        .map((litres) => litres / LITRES_PAR_M3);
      if (valeurs.length === 0) return { statut: 'aucune station' };
      const moyen = valeurs.reduce((somme, v) => somme + v, 0) / valeurs.length;
      if (moyen <= 0) return { statut: 'aucune station' };

      return {
        statut: 'tendance',
        tendance: tendanceDuDebit(observation.debitM3s, moyen),
        station: { code: station.code, nom: station.nom },
        distanceKm: Math.round(distance * 10) / 10,
        debitActuelM3s: observation.debitM3s,
        debitMoyenM3s: moyen,
        dateMesure: observation.date,
      };
    } catch {
      // Réseau coupé, erreur HTTP ou délai dépassé : une source indisponible ne bloque jamais le conseil (PLAN §4).
      return { statut: "Hub'Eau indisponible" };
    }
  }
}
