import { inject, Injectable, InjectionToken, Injector } from '@angular/core';
import { collection, getDocs } from 'firebase/firestore';
import { FirebaseService } from '../firebase/firebase.service';

/** Un spot enregistré, réduit à ce dont le conseil a besoin (PLAN §7 : `users/{uid}/spots`). */
export interface SpotEnregistre {
  id: string;
  nom: string;
  lat: number;
  lng: number;
  categorie: 1 | 2;
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
  uid(): string | null;
  /** Les documents de `users/{uid}/spots`. */
  documents(uid: string): Promise<DocumentSpot[]>;
}

export const SOURCE_SPOTS = new InjectionToken<SourceSpots>('SOURCE_SPOTS', {
  providedIn: 'root',
  factory: () => {
    // Firebase ne s'initialise qu'à la première lecture : afficher la page ne le démarre pas.
    const injector = inject(Injector);
    const firebase = () => injector.get(FirebaseService);
    return {
      uid: () => firebase().auth.currentUser?.uid ?? null,
      documents: async (uid) => {
        const instantane = await getDocs(collection(firebase().db, 'users', uid, 'spots'));
        return instantane.docs.map((d) => ({ id: d.id, data: d.data() }));
      },
    };
  },
});

const estTexte = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Un document mal formé (champ manquant ou d'un autre type) est ignoré. */
function enSpot({ id, data }: DocumentSpot): SpotEnregistre | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const { nom, lat, lng, categorie, departement } = d;
  if (!estTexte(nom) || !estNombre(lat) || !estNombre(lng) || !estTexte(departement)) return null;
  if (categorie !== 1 && categorie !== 2) return null;
  return { id, nom, lat, lng, categorie, departement };
}

/** Les spots de l'utilisateur, en lecture seule (PLAN §7). */
@Injectable({ providedIn: 'root' })
export class SpotsService {
  private readonly source = inject(SOURCE_SPOTS);

  /** Sans utilisateur connecté, aucun spot. Une erreur de lecture est propagée à l'appelant. */
  async mesSpots(): Promise<SpotEnregistre[]> {
    const uid = this.source.uid();
    if (uid === null) return [];
    const documents = await this.source.documents(uid);
    return documents.map(enSpot).filter((s): s is SpotEnregistre => s !== null);
  }
}
