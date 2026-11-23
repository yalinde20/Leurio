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
}

/** Un document Firestore lu tel quel : son identifiant et ses champs. */
export interface DocumentSpot {
  id: string;
  data: unknown;
}

/** Ce que le service lit de Firebase (remplacé par un double dans les tests). */
export interface SourceSpots {
  /** L'identifiant de l'utilisateur connecté, `null` sans compte. */
  uid(): Promise<string | null>;
  /** Les documents de `users/{uid}/spots`. */
  documents(uid: string): Promise<DocumentSpot[]>;
}

export const SOURCE_SPOTS = new InjectionToken<SourceSpots>('SOURCE_SPOTS', {
  providedIn: 'root',
  factory: () => creerSourceSpotsFirebase(inject(Injector)),
});

const estTexte = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Un document mal formé (champ manquant ou d'un autre type) est ignoré, sauf pour `milieu` : sans type d'eau valide, le spot est gardé sans lui. */
function enSpot({ id, data }: DocumentSpot): SpotEnregistre | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const { nom, lat, lng, categorie, departement, milieu } = d;
  if (!estTexte(nom) || !estNombre(lat) || !estNombre(lng) || !estTexte(departement)) return null;
  if (categorie !== 1 && categorie !== 2) return null;
  return MILIEUX.includes(milieu)
    ? { id, nom, lat, lng, categorie, milieu: milieu as Milieu, departement }
    : { id, nom, lat, lng, categorie, departement };
}

/** Les spots de l'utilisateur, en lecture seule (PLAN §7). */
@Injectable({ providedIn: 'root' })
export class SpotsService {
  private readonly source = inject(SOURCE_SPOTS);

  /** Sans utilisateur connecté, aucun spot. Une erreur de lecture est propagée à l'appelant. */
  async mesSpots(): Promise<SpotEnregistre[]> {
    const uid = await this.source.uid();
    if (uid === null) return [];
    const documents = await this.source.documents(uid);
    return documents.map(enSpot).filter((s): s is SpotEnregistre => s !== null);
  }
}
