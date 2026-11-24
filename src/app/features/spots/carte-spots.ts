import * as L from 'leaflet';
import { TUILES } from '../../core/data/tuiles.service';

export { TUILES };
export const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributeurs OpenStreetMap</a>';

/** Épingle : la couleur vient du token `--lr-carte-marqueur` (voir src/theme/carte.scss). */
export function icone(grande: boolean): L.DivIcon {
  const [largeur, hauteur] = grande ? [40, 54] : [30, 40];
  // Zone tactile d'au moins 48 px autour de l'épingle ; la pointe reste sur la coordonnée (bas du centre de la zone).
  const [zoneLargeur, zoneHauteur] = [48, Math.max(48, hauteur)];
  return L.divIcon({
    className: 'marqueur-spot',
    html: `<svg width="${largeur}" height="${hauteur}" viewBox="0 0 24 32" aria-hidden="true"><path d="M12 31s-10-11-10-18a10 10 0 0 1 20 0c0 7-10 18-10 18z"/><circle cx="12" cy="12" r="4"/></svg>`,
    iconSize: [zoneLargeur, zoneHauteur],
    iconAnchor: [zoneLargeur / 2, zoneHauteur],
  });
}
