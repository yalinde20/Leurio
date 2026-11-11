import { inject, Injectable, InjectionToken, Injector, signal } from '@angular/core';
import { creerSourceTackleBoxFirebase } from '../firebase/source-tackle-box';

/** Un leurre de la boîte (PLAN §7 : `users/{uid}/tackleBox`). `enAttente` : écrit en local, pas encore confirmé par le serveur. */
export interface Leurre {
  id: string;
  typeId: string;
  tailleCm: number;
  poidsG: number;
  couleur: string;
  marque?: string;
  createdAt: number;
  enAttente: boolean;
}

/** Ce que le pêcheur saisit pour un nouveau leurre. */
export interface SaisieLeurre {
  typeId: string;
  tailleCm: number;
  poidsG: number;
  couleur: string;
  marque?: string;
}

/** Un document Firestore lu tel quel. */
export interface DocumentLeurre {
  id: string;
  data: unknown;
  enAttente: boolean;
}

/** Ce que le service lit et écrit dans Firebase (remplacé par un double dans les tests). */
export interface SourceTackleBox {
  /** L'identifiant de l'utilisateur connecté, `null` sans compte. */
  uid(): Promise<string | null>;
  /** Prévient à chaque changement d'utilisateur connecté (le compte anonyme peut naître après l'ouverture de l'onglet). Facultatif. */
  surUid?(rappel: (uid: string | null) => void): () => void;
  /** Appelle `surChangement` avec tous les documents de `users/{uid}/tackleBox` à chaque changement. Rend le désabonnement. */
  ecouter(uid: string, surChangement: (documents: DocumentLeurre[]) => void, surErreur: (erreur: unknown) => void): () => void;
  /** Crée un document ; résout dès l'écriture locale, sans attendre le serveur. */
  ajouter(uid: string, data: Record<string, unknown>): Promise<void>;
}

export const SOURCE_TACKLE_BOX = new InjectionToken<SourceTackleBox>('SOURCE_TACKLE_BOX', {
  providedIn: 'root',
  factory: () => creerSourceTackleBoxFirebase(inject(Injector)),
});

const estTexte = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Un document mal formé (champ manquant ou d'un autre type) est ignoré. */
function enLeurre({ id, data, enAttente }: DocumentLeurre): Leurre | null {
  const { typeId, tailleCm, poidsG, couleur, marque, createdAt } = (data ?? {}) as Record<string, unknown>;
  if (!estTexte(typeId) || !estNombre(tailleCm) || !estNombre(poidsG) || !estTexte(couleur) || !estNombre(createdAt)) return null;
  const leurre: Leurre = { id, typeId, tailleCm, poidsG, couleur, createdAt, enAttente };
  if (estTexte(marque)) leurre.marque = marque;
  return leurre;
}

/** La boîte à leurres de l'utilisateur, lue en continu (cache Firestore compris, PLAN §4). */
@Injectable({ providedIn: 'root' })
export class TackleBoxService {
  private readonly source = inject(SOURCE_TACKLE_BOX);
  private readonly _leurres = signal<Leurre[] | null>(null);

  /** `null` tant que le premier instantané n'est pas arrivé ; ensuite le plus récent d'abord. */
  readonly leurres = this._leurres.asReadonly();

  constructor() {
    void this.suivre();
  }

  /** Rejette sans utilisateur connecté. Résout dès l'écriture locale : hors ligne, le serveur confirmera plus tard. */
  async ajouter(saisie: SaisieLeurre): Promise<void> {
    const uid = await this.source.uid();
    if (uid === null) throw new Error('Aucun utilisateur connecté');
    await this.source.ajouter(uid, {
      typeId: saisie.typeId,
      tailleCm: saisie.tailleCm,
      poidsG: saisie.poidsG,
      couleur: saisie.couleur.trim(),
      marque: (saisie.marque ?? '').trim(),
      createdAt: Date.now(),
    });
  }

  private async suivre(): Promise<void> {
    try {
      if (this.source.surUid) {
        this.source.surUid((uid) => this.ecouterPour(uid));
      } else {
        this.ecouterPour(await this.source.uid());
      }
    } catch {
      this.ecouterPour(null);
    }
  }

  /** (Ré)abonne la liste à la boîte de cet utilisateur ; sans utilisateur, la boîte est vide. */
  private ecouterPour(uid: string | null): void {
    this.arreter();
    const vide = () => this._leurres.update((l) => l ?? []);
    if (uid === null) {
      this._leurres.set([]);
      return;
    }
    this.arreter = this.source.ecouter(
      uid,
      (documents) =>
        this._leurres.set(
          documents
            .map(enLeurre)
            .filter((l): l is Leurre => l !== null)
            .sort((a, b) => b.createdAt - a.createdAt),
        ),
      vide,
    );
  }

  private arreter: () => void = () => undefined;
}
