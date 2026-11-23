import { inject, Injectable, InjectionToken, Injector } from '@angular/core';
import { creerSourceSpotsFirebase } from '../firebase/source-spots';

/** Type d'eau d'un spot (PLAN §7). */
export type Milieu = 'riviere' | 'lac' | 'canal';

const MILIEUX: readonly unknown[] = ['riviere', 'lac', 'canal'];

/** Un spot enregistré, réduit à ce dont le conseil a besoin (PLAN §7 : `users/{uid}/spots`). */
export interface SpotEnregistre {
  id: string;
  nom: string;
  lat: number;
  lng: number;
  categorie: 1 | 2;
  /** Absent quand le document n'a pas de type d'eau valide : le spot reste utilisable (position, catégorie). */
  milieu?: Milieu;
  departement: string;
  /** Écrit en local, pas encore confirmé par le serveur (hors ligne). Absent quand la source ne le dit pas. */
  enAttente?: boolean;
}

/** Un document Firestore lu tel quel : son identifiant et ses champs. */
export interface DocumentSpot {
  id: string;
  data: unknown;
  /** Écrit en local, pas encore confirmé par le serveur (`hasPendingWrites`). */
  enAttente?: boolean;
}

/** Ce que l'on écrit pour un nouveau spot (PLAN §7) : toujours privé. */
export interface SaisieSpot {
  nom: string;
  lat: number;
  lng: number;
  categorie: 1 | 2;
  milieu: Milieu;
  departement: string;
}

/** Ce que le service lit de Firebase (remplacé par un double dans les tests). */
export interface SourceSpots {
  /** L'identifiant de l'utilisateur connecté, `null` sans compte. */
  uid(): Promise<string | null>;
  /** Suit l'utilisateur connecté (`null` sans compte), à l'ouverture puis à chaque changement ; rend la fonction qui arrête le suivi. Facultative : sans elle, `uid` est lu une fois. */
  surUid?(rappel: (uid: string | null) => void, surErreur: (erreur: unknown) => void): () => void;
  /** Les documents de `users/{uid}/spots`. */
  documents(uid: string): Promise<DocumentSpot[]>;
  /**
   * Écoute en continu `users/{uid}/spots`, y compris les écritures locales pas encore confirmées (`enAttente`) ; rend la fonction qui arrête l'écoute.
   * Facultative : sans elle, le service lit `documents` une fois.
   */
  ecouter?(uid: string, surChangement: (documents: DocumentSpot[]) => void, surErreur: (erreur: unknown) => void): () => void;
  /** Crée un document dans `users/{uid}/spots` sans attendre l'accusé du serveur (hors ligne, il ne vient pas). */
  ajouter?(uid: string, data: Record<string, unknown>): Promise<void>;
}

export const SOURCE_SPOTS = new InjectionToken<SourceSpots>('SOURCE_SPOTS', {
  providedIn: 'root',
  factory: () => creerSourceSpotsFirebase(inject(Injector)),
});

const estTexte = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Un document mal formé (champ manquant ou d'un autre type) est ignoré, sauf pour `milieu` : sans type d'eau valide, le spot est gardé sans lui. */
function enSpot({ id, data, enAttente }: DocumentSpot): SpotEnregistre | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const { nom, lat, lng, categorie, departement, milieu } = d;
  if (!estTexte(nom) || !estNombre(lat) || !estNombre(lng) || !estTexte(departement)) return null;
  if (categorie !== 1 && categorie !== 2) return null;
  const spot: SpotEnregistre = { id, nom, lat, lng, categorie, departement };
  if (MILIEUX.includes(milieu)) spot.milieu = milieu as Milieu;
  if (enAttente !== undefined) spot.enAttente = enAttente;
  return spot;
}

const enSpots = (documents: DocumentSpot[]): SpotEnregistre[] => documents.map(enSpot).filter((s): s is SpotEnregistre => s !== null);

/** Les spots de l'utilisateur (PLAN §7). */
@Injectable({ providedIn: 'root' })
export class SpotsService {
  private readonly source = inject(SOURCE_SPOTS);

  /** Sans utilisateur connecté, aucun spot. Une erreur de lecture est propagée à l'appelant. */
  async mesSpots(): Promise<SpotEnregistre[]> {
    const uid = await this.source.uid();
    if (uid === null) return [];
    return enSpots(await this.source.documents(uid));
  }

  /**
   * Suit les spots de l'utilisateur : `surChangement` reçoit la liste complète à chaque changement (écriture locale comprise).
   * La liste suit le compte (US 99) : sans utilisateur elle est vide, et un compte qui apparaît ou change (compte anonyme créé
   * après l'ouverture, suppression du compte) rebranche l'écoute. Rend la fonction qui arrête tout.
   * Une source sans `ecouter` est lue une fois, pour l'utilisateur connu à l'ouverture.
   */
  ecouter(surChangement: (spots: SpotEnregistre[]) => void, surErreur: (erreur: unknown) => void): () => void {
    const source = this.source;
    let arrete = false;
    let arreterEcoute: () => void = () => undefined;
    const pour = (uid: string | null): void => {
      arreterEcoute();
      arreterEcoute = () => undefined;
      if (arrete) return;
      if (uid === null) return surChangement([]);
      if (!source.ecouter) {
        source.documents(uid).then((documents) => !arrete && surChangement(enSpots(documents)), surErreur);
        return;
      }
      arreterEcoute = source.ecouter(uid, (documents) => surChangement(enSpots(documents)), surErreur);
    };
    let arreterUid: () => void = () => undefined;
    if (source.surUid && source.ecouter) arreterUid = source.surUid(pour, surErreur);
    else source.uid().then(pour, surErreur);
    return () => {
      arrete = true;
      arreterUid();
      arreterEcoute();
    };
  }

  /** Crée un spot privé. Rejette sans utilisateur connecté. Résout dès l'écriture locale : hors ligne, le serveur confirmera plus tard. */
  async ajouter(saisie: SaisieSpot): Promise<void> {
    const uid = await this.source.uid();
    if (uid === null) throw new Error('Aucun utilisateur connecté');
    if (!this.source.ajouter) throw new Error("Cette source ne permet pas d'ajouter un spot");
    await this.source.ajouter(uid, {
      nom: saisie.nom.trim(),
      lat: saisie.lat,
      lng: saisie.lng,
      categorie: saisie.categorie,
      milieu: saisie.milieu,
      departement: saisie.departement,
      prive: true,
    });
  }
}
