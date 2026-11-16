import { inject, Injectable, InjectionToken, Injector } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { creerSourceExportFirebase } from '../firebase/source-export';

/** Un document Firestore lu tel quel : son identifiant et ses champs. */
export interface DocumentExport {
  id: string;
  data: Record<string, unknown>;
}

/** Les données de l'utilisateur à exporter (PLAN §7). */
export interface DonneesExport {
  /** `null` : pas de compte. */
  uid: string | null;
  /** `users/{uid}` tel que stocké, `null` s'il est absent. */
  profil: Record<string, unknown> | null;
  /** `users/{uid}/tackleBox`. */
  tackleBox: DocumentExport[];
  /** `users/{uid}/spots`. */
  spots: DocumentExport[];
}

/** Ce que le service lit de Firebase, depuis le cache hors ligne ; rejette si la lecture échoue (remplacé par un double dans les tests). */
export interface SourceExport {
  lire(): Promise<DonneesExport>;
}

export const SOURCE_EXPORT = new InjectionToken<SourceExport>('SOURCE_EXPORT', {
  providedIn: 'root',
  factory: () => creerSourceExportFirebase(inject(Injector)),
});

/** Remet le fichier à l'utilisateur (remplacé par un double dans les tests). */
export interface EnregistrementFichier {
  enregistrer(nom: string, contenu: string): Promise<void>;
}

const DELAI_LIBERATION_URL_MS = 60_000;

/** Web : téléchargement du navigateur (Blob et lien `download`). */
export function creerEnregistrementWeb(): EnregistrementFichier {
  return {
    async enregistrer(nom, contenu) {
      const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = nom;
      lien.style.display = 'none';
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      // Sur iPhone Safari, l'utilisateur confirme le téléchargement plus tard : on garde l'adresse 60 s (comme FileSaver.js).
      setTimeout(() => URL.revokeObjectURL(url), DELAI_LIBERATION_URL_MS);
    },
  };
}

/** Natif (iOS, Android) : le fichier est écrit dans le cache de l'app, puis la feuille de partage propose « Enregistrer dans Fichiers ». */
export function creerEnregistrementNatif(): EnregistrementFichier {
  return {
    async enregistrer(nom, contenu) {
      const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ]);
      const { uri } = await Filesystem.writeFile({ path: nom, data: contenu, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: nom, files: [uri] });
    },
  };
}

export const ENREGISTREMENT_FICHIER = new InjectionToken<EnregistrementFichier>('ENREGISTREMENT_FICHIER', {
  providedIn: 'root',
  factory: () => (Capacitor.isNativePlatform() ? creerEnregistrementNatif() : creerEnregistrementWeb()),
});

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

/** Exporte le profil, la boîte et les spots dans un fichier JSON indenté (US 97, PLAN §2.5, §4). */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly source = inject(SOURCE_EXPORT);
  private readonly enregistrement = inject(ENREGISTREMENT_FICHIER);

  /** Lit, construit puis enregistre le fichier ; rend son nom. Une erreur de lecture est propagée : rien n'est enregistré. */
  async exporter(): Promise<string> {
    const donnees = await this.source.lire();
    const maintenant = new Date();
    const nom = `leurio-export-${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}.json`;
    const fichier = {
      app: 'Leurio',
      exporteLe: maintenant.toISOString(),
      profil: donnees.profil ?? {},
      tackleBox: donnees.tackleBox.map((d) => ({ id: d.id, ...d.data })),
      spots: donnees.spots.map((d) => ({ id: d.id, ...d.data })),
    };
    await this.enregistrement.enregistrer(nom, JSON.stringify(fichier, null, 2));
    return nom;
  }
}
