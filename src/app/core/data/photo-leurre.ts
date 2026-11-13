import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/** D'où vient la photo d'un leurre : l'appareil photo ou la galerie. */
export type OriginePhoto = 'camera' | 'galerie';

/** Lancée quand l'utilisateur refuse l'accès à l'appareil photo ou à la galerie. */
export class AccesPhotoRefuse extends Error {
  constructor() {
    super("Accès à l'appareil photo refusé.");
    this.name = 'AccesPhotoRefuse';
  }
}

/** Lancée quand la photo n'a pas pu être envoyée vers le stockage : rien n'est alors écrit. */
export class EchecEnvoiPhoto extends Error {
  constructor(cause: unknown) {
    super("La photo n'a pas pu être envoyée.", { cause });
    this.name = 'EchecEnvoiPhoto';
  }
}

/** Ce que la page demande à l'appareil pour obtenir une photo (remplacé par un double dans les tests). */
export interface SourcePhoto {
  /** Prend ou choisit une photo. Rend `null` si l'utilisateur annule ; lance `AccesPhotoRefuse` s'il refuse l'accès. */
  choisir(origine: OriginePhoto): Promise<Blob | null>;
  /** `false` sans réseau : le stockage des photos n'a pas de cache hors ligne (PLAN §4). */
  enLigne(): boolean;
}

/** Poids visé d'une photo envoyée (PLAN §4 : ~200 Ko). */
export const POIDS_MAX_PHOTO = 200 * 1024;
/** Plus grand côté, en pixels, d'une photo avant compression : assez pour une vignette et un aperçu nets. */
const COTE_MAX = 1600;
const COTE_MIN = 64;

/** Codes du plugin Camera : accès refusé à l'appareil photo (0003) ou à la galerie (0005). */
const CODES_REFUS: readonly unknown[] = ['OS-PLUG-CAMR-0003', 'OS-PLUG-CAMR-0005'];
/** Codes du plugin Camera : prise de photo annulée (0006), choix dans la galerie annulé (0020). */
const CODES_ANNULATION: readonly unknown[] = ['OS-PLUG-CAMR-0006', 'OS-PLUG-CAMR-0020'];

/** Sur le web : un sélecteur de fichier, avec `capture` pour ouvrir directement l'appareil photo des mobiles. */
function choisirFichier(origine: OriginePhoto): Promise<Blob | null> {
  return new Promise((resolve) => {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = 'image/*';
    if (origine === 'camera') champ.capture = 'environment';
    champ.hidden = true;
    const terminer = (photo: Blob | null) => {
      champ.remove();
      resolve(photo);
    };
    champ.addEventListener('change', () => terminer(champ.files?.[0] ?? null));
    champ.addEventListener('cancel', () => terminer(null));
    document.body.appendChild(champ);
    champ.click();
  });
}

/** Sur iOS et Android : le plugin Camera. */
async function choisirNatif(origine: OriginePhoto): Promise<Blob | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: origine === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      quality: 90,
      width: COTE_MAX,
      correctOrientation: true,
    });
    if (!photo.webPath) return null;
    return await (await fetch(photo.webPath)).blob();
  } catch (erreur) {
    const { code, message } = erreur as { code?: unknown; message?: unknown };
    const texte = typeof message === 'string' ? message.toLowerCase() : '';
    if (CODES_ANNULATION.includes(code) || texte.includes('cancel')) return null;
    if (CODES_REFUS.includes(code) || texte.includes('denied')) throw new AccesPhotoRefuse();
    throw erreur;
  }
}

export const SOURCE_PHOTO = new InjectionToken<SourcePhoto>('SOURCE_PHOTO', {
  providedIn: 'root',
  factory: () => ({
    // Le plugin Camera se charge à la demande (import dynamique) ; sur le web, le sélecteur de fichier s'ouvre sans attendre :
    // Safari exige qu'il soit déclenché pendant le geste de l'utilisateur.
    choisir: (origine) => (Capacitor.isNativePlatform() ? choisirNatif(origine) : choisirFichier(origine)),
    enLigne: () => navigator.onLine,
  }),
});

/** Dessine l'image réduite à `cote` pixels au plus et la rend en JPEG de qualité `qualite`. */
async function encoder(image: ImageBitmap, cote: number, qualite: number): Promise<Blob> {
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * echelle));
  canvas.height = Math.max(1, Math.round(image.height * echelle));
  const contexte = canvas.getContext('2d');
  if (!contexte) throw new Error('Canvas indisponible');
  contexte.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("L'image n'a pas pu être encodée"))), 'image/jpeg', qualite),
  );
}

/**
 * Réduit la photo pour qu'elle pèse `maxOctets` au plus (PLAN §4), en JPEG : côté ramené à 1600 px, puis qualité et taille
 * diminuées jusqu'au seuil. Une photo déjà assez légère est rendue telle quelle. Utilise le canvas : navigateur seulement.
 */
export async function compresserPhoto(photo: Blob, maxOctets: number = POIDS_MAX_PHOTO): Promise<Blob> {
  if (photo.size <= maxOctets) return photo;
  const image = await createImageBitmap(photo, { imageOrientation: 'from-image' });
  try {
    let cote = Math.min(COTE_MAX, Math.max(image.width, image.height));
    let resultat = await encoder(image, cote, 0.8);
    for (const qualite of [0.7, 0.6, 0.5]) {
      if (resultat.size <= maxOctets) break;
      resultat = await encoder(image, cote, qualite);
    }
    while (resultat.size > maxOctets && cote > COTE_MIN) {
      cote = Math.max(COTE_MIN, Math.round(cote * 0.75));
      resultat = await encoder(image, cote, 0.6);
    }
    return resultat;
  } finally {
    image.close();
  }
}
