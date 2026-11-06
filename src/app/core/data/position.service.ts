import { inject, Injectable, InjectionToken } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { GeoService } from './geo.service';

/** Motif rendu quand l'utilisateur a refusé l'accès à sa position. */
export const POSITION_REFUSEE = 'position refusée';
/** Motif rendu quand la position n'a pas pu être obtenue (délai dépassé, GPS éteint…), sans refus. */
export const POSITION_INDISPONIBLE = 'position indisponible';
/** Délai maximal, en millisecondes, accordé au GPS pour répondre. */
export const DELAI_GPS_MS = 15_000;

/** Âge maximal, en millisecondes, d'une position en cache acceptée. */
const AGE_MAX_POSITION_MS = 60_000;
/**
 * Codes d'erreur d'un refus : `1` pour l'API web de géolocalisation, `OS-PLUG-GLOC-0003` (refusée) et
 * `OS-PLUG-GLOC-0008` (restreinte, iOS) pour le plugin natif.
 */
const CODES_REFUS: readonly unknown[] = [1, 'OS-PLUG-GLOC-0003', 'OS-PLUG-GLOC-0008'];
/** Code d'une méthode que le plugin n'implémente pas sur cette plateforme (`requestPermissions` sur le web). */
const CODE_NON_IMPLEMENTE = 'UNIMPLEMENTED';

type EtatPermission = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

/** Statut rendu par le plugin ; `coarseLocation` est la position approximative (Android 12+). */
interface StatutPermission {
  location: EtatPermission;
  coarseLocation?: EtatPermission;
}

/** La position approximative suffit (météo, département) : elle compte comme une autorisation accordée. */
function etat({ location, coarseLocation }: StatutPermission): EtatPermission {
  return coarseLocation === 'granted' ? 'granted' : location;
}

/** Spot enregistré par l'utilisateur, au format du PLAN §7 (`users/{uid}/spots`), réduit à ce dont la position a besoin. */
export interface Spot {
  nom: string;
  lat: number;
  lng: number;
  departement: string;
}

/** Position obtenue, par le GPS ou depuis un spot ; `precisionM` est inconnue (`null`) pour un spot. */
export interface PositionTrouvee {
  disponible: true;
  source: 'gps' | 'spot';
  latitude: number;
  longitude: number;
  precisionM: number | null;
  departement: string;
}

/** Position non obtenue, avec son motif. */
export interface PositionManquante {
  disponible: false;
  motif: typeof POSITION_REFUSEE | typeof POSITION_INDISPONIBLE;
}

export type ResultatPosition = PositionTrouvee | PositionManquante;

/** Partie du plugin Capacitor Geolocation que le service utilise (remplacée par un double dans les tests). */
export interface Geolocalisation {
  checkPermissions(): Promise<StatutPermission>;
  /** Affiche la demande d'autorisation du système ; absente ou non implémentée sur le web. */
  requestPermissions?(): Promise<StatutPermission>;
  getCurrentPosition(options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<{ coords: { latitude: number; longitude: number; accuracy: number } }>;
}

export const GEOLOCALISATION = new InjectionToken<Geolocalisation>('GEOLOCALISATION', {
  providedIn: 'root',
  // Objet simple, pas le proxy du plugin : Angular y chercherait `ngOnDestroy`, que le proxy rend comme une méthode non implémentée.
  factory: () => ({
    checkPermissions: () => Geolocation.checkPermissions(),
    requestPermissions: () => Geolocation.requestPermissions(),
    getCurrentPosition: (options) => Geolocation.getCurrentPosition(options),
  }),
});

const REFUSEE: PositionManquante = { disponible: false, motif: POSITION_REFUSEE };
const INDISPONIBLE: PositionManquante = { disponible: false, motif: POSITION_INDISPONIBLE };

/**
 * Donne la position de pêche (PLAN §2, §4) : le GPS de l'appareil ou un spot enregistré.
 * Le service ne lève jamais d'erreur : un refus ou une panne devient un `PositionManquante`.
 */
@Injectable({ providedIn: 'root' })
export class PositionService {
  private readonly geolocalisation = inject(GEOLOCALISATION);
  private readonly geo = inject(GeoService);

  /** Position du GPS, ou « position refusée » / « position indisponible » (délai de `DELAI_GPS_MS`). */
  async positionGps(): Promise<ResultatPosition> {
    const permission = await this.permission();
    if (permission === 'denied') return REFUSEE;
    // La demande d'autorisation se fait avant le minuteur : le temps passé à la lire ne compte pas dans le délai.
    if (permission !== 'granted') {
      const reponse = await this.demanderPermission();
      if (reponse !== 'continuer') return reponse;
    }

    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const delaiDepasse = new Promise<'delai'>((resolve) => {
      minuteur = setTimeout(() => resolve('delai'), DELAI_GPS_MS);
    });
    try {
      const position = await Promise.race([
        this.geolocalisation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: DELAI_GPS_MS,
          maximumAge: AGE_MAX_POSITION_MS,
        }),
        delaiDepasse,
      ]);
      if (position === 'delai') return INDISPONIBLE;
      const { latitude, longitude, accuracy } = position.coords;
      return {
        disponible: true,
        source: 'gps',
        latitude,
        longitude,
        precisionM: accuracy,
        departement: this.geo.departement({ latitude, longitude }),
      };
    } catch (erreur) {
      if (CODES_REFUS.includes(codeErreur(erreur))) return REFUSEE;
      return (await this.permission()) === 'denied' ? REFUSEE : INDISPONIBLE;
    } finally {
      clearTimeout(minuteur);
    }
  }

  /** Position d'un spot enregistré, sans interroger le GPS. */
  async positionSpot(spot: Spot): Promise<ResultatPosition> {
    return {
      disponible: true,
      source: 'spot',
      latitude: spot.lat,
      longitude: spot.lng,
      precisionM: null,
      departement: spot.departement,
    };
  }

  /**
   * Demande l'autorisation au système. Rend « position refusée » si elle n'est pas accordée, « position
   * indisponible » si la demande échoue (localisation désactivée), ou « continuer » quand la plateforme n'a pas
   * de demande séparée (web) : `getCurrentPosition` affichera alors celle du navigateur.
   */
  private async demanderPermission(): Promise<PositionManquante | 'continuer'> {
    if (!this.geolocalisation.requestPermissions) return 'continuer';
    try {
      const statut = await this.geolocalisation.requestPermissions();
      return etat(statut) === 'granted' ? 'continuer' : REFUSEE;
    } catch (erreur) {
      if (codeErreur(erreur) === CODE_NON_IMPLEMENTE) return 'continuer';
      return CODES_REFUS.includes(codeErreur(erreur)) ? REFUSEE : INDISPONIBLE;
    }
  }

  /** État de la permission ; « prompt » si on ne peut pas le lire (web sans API Permissions). */
  private async permission(): Promise<EtatPermission> {
    try {
      return etat(await this.geolocalisation.checkPermissions());
    } catch {
      return 'prompt';
    }
  }
}

function codeErreur(erreur: unknown): unknown {
  return (erreur as { code?: unknown } | null)?.code;
}
