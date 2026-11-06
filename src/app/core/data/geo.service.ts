import { Injectable } from '@angular/core';
import contenu from '../../../assets/data/departements.json';
import type { Lieu } from './weather-provider';

/** Résultat quand le lieu n'est dans aucun département de la France métropolitaine. */
export const HORS_FRANCE = 'hors France';

/** Marge, en mètres, à l'extérieur d'un contour où l'on rattache encore le lieu au département le plus proche. */
const TOLERANCE_M = 500;
const METRES_PAR_DEGRE = 111_320;

type Point = [number, number]; // [longitude, latitude]
type Anneau = Point[];
/** Un polygone : l'anneau extérieur puis les trous éventuels. */
type Polygone = Anneau[];

interface Boite {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

interface DepartementIndexe {
  code: string;
  polygones: { anneaux: Polygone; boite: Boite }[];
  boite: Boite;
}

function boiteDe(anneau: Anneau): Boite {
  const lons = anneau.map((p) => p[0]);
  const lats = anneau.map((p) => p[1]);
  return { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
}

function dansBoite(b: Boite, lon: number, lat: number, marge = 0): boolean {
  return lon >= b.minLon - marge && lon <= b.maxLon + marge && lat >= b.minLat - marge && lat <= b.maxLat + marge;
}

/** Lancer de rayon : vrai si le point est à l'intérieur de l'anneau. */
function dansAnneau(anneau: Anneau, lon: number, lat: number): boolean {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i];
    const [xj, yj] = anneau[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Dans l'anneau extérieur et hors de tous les trous. */
function dansPolygone(anneaux: Polygone, lon: number, lat: number): boolean {
  const [exterieur, ...trous] = anneaux;
  return dansAnneau(exterieur, lon, lat) && !trous.some((t) => dansAnneau(t, lon, lat));
}

/** Distance en mètres d'un point à un segment, dans un plan local centré sur la latitude du point. */
function distanceSegmentM(lon: number, lat: number, a: Point, b: Point): number {
  const k = Math.cos((lat * Math.PI) / 180);
  const ax = (a[0] - lon) * k;
  const ay = a[1] - lat;
  const dx = (b[0] - a[0]) * k;
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
  return Math.hypot(ax + t * dx, ay + t * dy) * METRES_PAR_DEGRE;
}

/** Distance en mètres du point au contour le plus proche d'un polygone (extérieur et trous). */
function distanceContourM(anneaux: Polygone, lon: number, lat: number): number {
  let min = Infinity;
  for (const anneau of anneaux)
    for (let i = 1; i < anneau.length; i++) min = Math.min(min, distanceSegmentM(lon, lat, anneau[i - 1], anneau[i]));
  return min;
}

/**
 * Trouve le département d'un lieu à partir de contours simplifiés embarqués dans l'app (PLAN §2.4, §5) :
 * aucune requête réseau, le résultat est donc le même hors ligne. France métropolitaine seulement.
 * Les contours sont simplifiés : près d'une frontière ou d'une côte, l'erreur peut atteindre quelques centaines de mètres.
 */
@Injectable({ providedIn: 'root' })
export class GeoService {
  /** Contours indexés une fois, au premier usage, avec leurs boîtes englobantes. */
  private index?: DepartementIndexe[];

  /** Code du département du lieu (« 49 », « 2A »…), ou `HORS_FRANCE`. */
  departement(lieu: Lieu): string {
    const { longitude: lon, latitude: lat } = lieu;
    const departements = this.departements();

    for (const d of departements) {
      if (!dansBoite(d.boite, lon, lat)) continue;
      if (d.polygones.some((p) => dansBoite(p.boite, lon, lat) && dansPolygone(p.anneaux, lon, lat))) return d.code;
    }

    // Aucun contour ne contient le lieu : on accepte le département dont la limite est à moins de TOLERANCE_M.
    const marge = TOLERANCE_M / METRES_PAR_DEGRE / Math.cos((lat * Math.PI) / 180);
    let meilleur = { code: HORS_FRANCE, distance: TOLERANCE_M };
    for (const d of departements) {
      if (!dansBoite(d.boite, lon, lat, marge)) continue;
      for (const p of d.polygones) {
        if (!dansBoite(p.boite, lon, lat, marge)) continue;
        const distance = distanceContourM(p.anneaux, lon, lat);
        if (distance <= meilleur.distance) meilleur = { code: d.code, distance };
      }
    }
    return meilleur.code;
  }

  private departements(): DepartementIndexe[] {
    this.index ??= (contenu.departements as unknown as { code: string; polygones: Polygone[] }[]).map((d) => {
      const polygones = d.polygones.map((anneaux) => ({ anneaux, boite: boiteDe(anneaux[0]) }));
      const boites = polygones.map((p) => p.boite);
      return {
        code: d.code,
        polygones,
        boite: {
          minLon: Math.min(...boites.map((b) => b.minLon)),
          maxLon: Math.max(...boites.map((b) => b.maxLon)),
          minLat: Math.min(...boites.map((b) => b.minLat)),
          maxLat: Math.max(...boites.map((b) => b.maxLat)),
        },
      };
    });
    return this.index;
  }
}
