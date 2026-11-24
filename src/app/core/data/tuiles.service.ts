import { Injectable } from '@angular/core';
import { Lieu } from './weather-provider';

/** Les tuiles du fond de carte (OpenStreetMap), partagées par la carte Leaflet et la mise en cache. */
export const TUILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Côté, en km, du demi-carré de tuiles gardé autour d'un lieu (carré de 2 km de demi-côté). */
const DEMI_COTE_KM = 2;
const KM_PAR_DEGRE = 111;
/** Zooms gardés. Jamais 17 ou plus : politique d'usage des tuiles d'OpenStreetMap. */
const ZOOM_MIN = 10;
const ZOOM_MAX = 16;
const REQUETES_EN_VOL = 2;

const tuileX = (longitude: number, zoom: number): number => Math.floor(((longitude + 180) / 360) * 2 ** zoom);

function tuileY(latitude: number, zoom: number): number {
  const radians = (latitude * Math.PI) / 180;
  return Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * 2 ** zoom);
}

/** Les URL des tuiles du carré autour du lieu, zooms 10 à 16. */
function urlsAutour(lieu: Lieu): string[] {
  const dLat = DEMI_COTE_KM / KM_PAR_DEGRE;
  const dLng = DEMI_COTE_KM / (KM_PAR_DEGRE * Math.cos((lieu.latitude * Math.PI) / 180));
  const urls: string[] = [];
  for (let z = ZOOM_MIN; z <= ZOOM_MAX; z++) {
    const [ouest, est] = [tuileX(lieu.longitude - dLng, z), tuileX(lieu.longitude + dLng, z)];
    const [nord, sud] = [tuileY(lieu.latitude + dLat, z), tuileY(lieu.latitude - dLat, z)];
    // Les tuiles du centre d'abord : si la mise en cache est interrompue, le plus proche du lieu est déjà gardé.
    const [centreX, centreY] = [tuileX(lieu.longitude, z), tuileY(lieu.latitude, z)];
    const tuiles: [number, number][] = [];
    for (let x = ouest; x <= est; x++) for (let y = nord; y <= sud; y++) tuiles.push([x, y]);
    tuiles.sort(([x1, y1], [x2, y2]) => Math.hypot(x1 - centreX, y1 - centreY) - Math.hypot(x2 - centreX, y2 - centreY));
    for (const [x, y] of tuiles) urls.push(TUILES.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
  }
  return urls;
}

/**
 * Garde les tuiles de carte autour d'un lieu pour voir la carte sans réseau (PLAN §4). Les tuiles sont demandées par une requête
 * CORS ordinaire : le service worker (groupe `tuiles-osm` de ngsw-config.json) les garde, comme celles que la carte affiche.
 */
@Injectable({ providedIn: 'root' })
export class TuilesService {
  /** Ne rejette jamais. Hors ligne, rien n'est demandé ; une tuile déjà gardée n'est pas redemandée ; 2 requêtes en vol au plus. */
  async mettreEnCacheAutour(lieu: Lieu): Promise<void> {
    try {
      if (!navigator.onLine) return;
      const restantes = urlsAutour(lieu);
      const travailleur = async (): Promise<void> => {
        for (let url = restantes.shift(); url !== undefined; url = restantes.shift()) await this.garder(url);
      };
      await Promise.all(Array.from({ length: REQUETES_EN_VOL }, travailleur));
    } catch {
      // Les tuiles sont un confort : une erreur ne doit jamais gêner l'appelant.
    }
  }

  private async garder(url: string): Promise<void> {
    try {
      if (typeof caches !== 'undefined' && (await caches.match(url))) return;
      const reponse = await fetch(url);
      // Le corps est lu en entier pour que le service worker finisse d'écrire la tuile dans son cache.
      await reponse.arrayBuffer();
    } catch {
      // Une tuile qui échoue n'empêche pas les suivantes.
    }
  }
}
