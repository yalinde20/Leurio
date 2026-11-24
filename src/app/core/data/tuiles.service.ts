import { Injectable } from '@angular/core';
import { Lieu } from './weather-provider';

/** Les tuiles du fond de carte (OpenStreetMap), partagées par la carte Leaflet et la mise en cache. */
export const TUILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Distance, en km, du lieu au bord du carré de tuiles gardé autour de lui : le carré fait 4 km de large. */
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

/** Une tuile en attente de demande, avec de quoi réveiller ceux qui l'attendent. */
interface TuileEnAttente {
  url: string;
  terminee: () => void;
}

/**
 * Garde les tuiles de carte autour d'un lieu pour voir la carte sans réseau (PLAN §4). Les tuiles sont demandées par une requête
 * CORS ordinaire : le service worker (groupe `tuiles-osm` de ngsw-config.json, stratégie `performance`) répond depuis son cache
 * quand la tuile est fraîche, la redemande au réseau quand elle est périmée, et la garde.
 * Une seule file pour toute l'app : 2 requêtes en vol au plus, quel que soit le nombre d'appels, et une tuile en attente ou en
 * cours n'est demandée qu'une fois.
 */
@Injectable({ providedIn: 'root' })
export class TuilesService {
  private readonly file: TuileEnAttente[] = [];
  /** Les tuiles en attente ou en vol, par URL : la promesse se résout quand la tuile est traitée. */
  private readonly connues = new Map<string, Promise<void>>();
  private enVol = 0;

  /**
   * Ne rejette jamais ; se résout quand les tuiles du lieu sont traitées. Sans service worker qui contrôle la page (natif, serveur
   * de développement, première visite) ou hors ligne, rien n'est demandé : il n'y aurait personne pour garder les tuiles.
   */
  async mettreEnCacheAutour(lieu: Lieu): Promise<void> {
    try {
      if (!navigator.onLine || !navigator.serviceWorker?.controller) return;
      await Promise.all(urlsAutour(lieu).map((url) => this.demander(url)));
    } catch {
      // Les tuiles sont un confort : une erreur ne doit jamais gêner l'appelant.
    }
  }

  private demander(url: string): Promise<void> {
    const existante = this.connues.get(url);
    if (existante) return existante;
    const promesse = new Promise<void>((resolve) => this.file.push({ url, terminee: resolve }));
    this.connues.set(url, promesse);
    this.avancer();
    return promesse;
  }

  private avancer(): void {
    while (this.enVol < REQUETES_EN_VOL && this.file.length > 0) {
      const { url, terminee } = this.file.shift() as TuileEnAttente;
      this.enVol++;
      void this.garder(url).then(() => {
        this.enVol--;
        this.connues.delete(url);
        terminee();
        this.avancer();
      });
    }
  }

  /** Ne rejette jamais : une tuile qui échoue n'empêche pas les suivantes. */
  private async garder(url: string): Promise<void> {
    try {
      // Toujours demandée : le service worker sait si sa copie est fraîche (sans réseau) ou périmée (il la redemande) et rafraîchit son LRU.
      const reponse = await fetch(url);
      // Le service worker (stratégie `performance`) attend d'avoir écrit la tuile avant de répondre ; lire le corps libère la connexion.
      await reponse.arrayBuffer();
    } catch {
      // Tuile ignorée.
    }
  }
}
