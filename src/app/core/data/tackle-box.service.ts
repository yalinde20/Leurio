import { inject, Injectable, InjectionToken, Injector, signal } from '@angular/core';
import { creerSourceTackleBoxFirebase } from '../firebase/source-tackle-box';
import { compresserPhoto, EchecEnvoiPhoto } from './photo-leurre';

/** Un leurre de la boîte (PLAN §7 : `users/{uid}/tackleBox`). `enAttente` : écrit en local, pas encore confirmé par le serveur. */
export interface Leurre {
  id: string;
  typeId: string;
  tailleCm: number;
  poidsG: number;
  couleur: string;
  marque?: string;
  /** Adresse de la photo dans Storage (`users/{uid}/lures/`), absente sans photo. */
  photoUrl?: string;
  createdAt: number;
  enAttente: boolean;
}

/** Ce que le pêcheur saisit pour un leurre, à l'ajout comme à la modification. */
export interface SaisieLeurre {
  typeId: string;
  tailleCm: number;
  poidsG: number;
  couleur: string;
  marque?: string;
  /** `undefined` : garder la photo actuelle ; un `Blob` : nouvelle photo à envoyer ; `null` : retirer la photo. */
  photo?: Blob | null;
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
  surUid?(rappel: (uid: string | null) => void, surErreur: (erreur: unknown) => void): () => void;
  /** Appelle `surChangement` avec tous les documents de `users/{uid}/tackleBox` à chaque changement. Rend le désabonnement. */
  ecouter(uid: string, surChangement: (documents: DocumentLeurre[]) => void, surErreur: (erreur: unknown) => void): () => void;
  /** Crée un document ; résout dès l'écriture locale, sans attendre le serveur. */
  ajouter(uid: string, data: Record<string, unknown>): Promise<void>;
  /** Met à jour les champs donnés d'un document (un champ à `null` est retiré du document) ; résout dès l'écriture locale, sans attendre le serveur. */
  modifier(uid: string, id: string, data: Record<string, unknown>): Promise<void>;
  /** Supprime un document ; résout dès l'écriture locale, sans attendre le serveur. */
  supprimer(uid: string, id: string): Promise<void>;
  /** Envoie une photo dans `users/{uid}/lures/` de Storage et rend son adresse de téléchargement. Sans cache hors ligne. */
  envoyerPhoto(uid: string, photo: Blob): Promise<string>;
  /** Supprime de Storage la photo qui a cette adresse de téléchargement. */
  supprimerPhoto(url: string): Promise<void>;
}

export const SOURCE_TACKLE_BOX = new InjectionToken<SourceTackleBox>('SOURCE_TACKLE_BOX', {
  providedIn: 'root',
  factory: () => creerSourceTackleBoxFirebase(inject(Injector)),
});

const estTexte = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Un document mal formé (champ manquant ou d'un autre type) est ignoré. */
function enLeurre({ id, data, enAttente }: DocumentLeurre): Leurre | null {
  const { typeId, tailleCm, poidsG, couleur, marque, photoUrl, createdAt } = (data ?? {}) as Record<string, unknown>;
  if (!estTexte(typeId) || !estNombre(tailleCm) || !estNombre(poidsG) || !estTexte(couleur) || !estNombre(createdAt)) return null;
  const leurre: Leurre = { id, typeId, tailleCm, poidsG, couleur, createdAt, enAttente };
  if (estTexte(marque)) leurre.marque = marque;
  if (estTexte(photoUrl)) leurre.photoUrl = photoUrl;
  return leurre;
}

/** La boîte à leurres de l'utilisateur, lue en continu (cache Firestore compris, PLAN §4). */
@Injectable({ providedIn: 'root' })
export class TackleBoxService {
  private readonly source = inject(SOURCE_TACKLE_BOX);
  private readonly _leurres = signal<Leurre[] | null>(null);

  /** `null` tant que le premier instantané n'est pas arrivé ; ensuite le plus récent d'abord. */
  readonly leurres = this._leurres.asReadonly();

  private readonly _erreur = signal(false);
  /** `true` quand la boîte n'a pas pu être lue ; revient à `false` au prochain instantané ou changement d'utilisateur. */
  readonly erreur = this._erreur.asReadonly();

  private uidCourant: string | null | undefined;

  constructor() {
    void this.suivre();
  }

  /**
   * Rejette sans utilisateur connecté. Résout dès l'écriture locale : hors ligne, le serveur confirmera plus tard.
   * Une photo est compressée puis envoyée avant l'écriture : si l'envoi échoue, rien n'est écrit.
   */
  async ajouter(saisie: SaisieLeurre): Promise<void> {
    const uid = await this.source.uid();
    if (uid === null) throw new Error('Aucun utilisateur connecté');
    const photoUrl = saisie.photo ? await this.envoyerPhoto(uid, saisie.photo) : undefined;
    await this.ecrire(
      () =>
        this.source.ajouter(uid, {
          typeId: saisie.typeId,
          tailleCm: saisie.tailleCm,
          poidsG: saisie.poidsG,
          couleur: saisie.couleur.trim(),
          marque: (saisie.marque ?? '').trim(),
          ...(photoUrl ? { photoUrl } : {}),
          createdAt: Date.now(),
        }),
      photoUrl,
    );
  }

  /**
   * Met à jour un leurre (jamais `createdAt` : l'ordre de la liste ne bouge pas). Mêmes règles d'écriture que `ajouter`.
   * Une photo remplacée ou retirée voit son ancien fichier supprimé après l'écriture, sans l'attendre (hors ligne, Storage réessaie
   * longtemps) ; un échec de cette suppression est seulement journalisé. `photo: null` écrit `photoUrl: null` : la source retire le champ.
   */
  async modifier(id: string, saisie: SaisieLeurre): Promise<void> {
    const uid = await this.source.uid();
    if (uid === null) throw new Error('Aucun utilisateur connecté');
    const anciennePhoto = this._leurres()?.find((l) => l.id === id)?.photoUrl;
    const photoUrl = saisie.photo ? await this.envoyerPhoto(uid, saisie.photo) : saisie.photo === null ? null : undefined;
    await this.ecrire(
      () =>
        this.source.modifier(uid, id, {
          typeId: saisie.typeId,
          tailleCm: saisie.tailleCm,
          poidsG: saisie.poidsG,
          couleur: saisie.couleur.trim(),
          marque: (saisie.marque ?? '').trim(),
          ...(photoUrl === undefined ? {} : { photoUrl }),
        }),
      photoUrl,
    );
    if (anciennePhoto && photoUrl !== undefined) void this.supprimerPhoto(anciennePhoto);
  }

  /** Supprime un leurre et, s'il en avait une, sa photo (sans attendre la suppression du fichier). Rejette sans utilisateur connecté ; résout dès l'écriture locale. */
  async supprimer(id: string): Promise<void> {
    const uid = await this.source.uid();
    if (uid === null) throw new Error('Aucun utilisateur connecté');
    const photoUrl = this._leurres()?.find((l) => l.id === id)?.photoUrl;
    await this.source.supprimer(uid, id);
    if (photoUrl) void this.supprimerPhoto(photoUrl);
  }

  /** Après une erreur de lecture, relit la boîte de l'utilisateur courant (la liste repasse en chargement). Sinon ne fait rien. */
  reessayer(): void {
    if (!this._erreur()) return;
    if (this.uidCourant !== undefined) return this.ecouterPour(this.uidCourant);
    // L'utilisateur n'a jamais été connu (erreur d'authentification) : on le relit.
    this.source.uid().then((uid) => this.ecouterPour(uid), () => this._erreur.set(true));
  }

  private async envoyerPhoto(uid: string, photo: Blob): Promise<string> {
    try {
      return await this.source.envoyerPhoto(uid, await compresserPhoto(photo));
    } catch (erreur) {
      throw new EchecEnvoiPhoto(erreur);
    }
  }

  /** Écrit le document ; s'il est refusé, la photo qu'on vient d'envoyer n'est plus référencée : on la supprime. */
  private async ecrire(ecriture: () => Promise<void>, photoEnvoyee: string | null | undefined): Promise<void> {
    try {
      await ecriture();
    } catch (erreur) {
      if (photoEnvoyee) void this.supprimerPhoto(photoEnvoyee);
      throw erreur;
    }
  }

  /** Le fichier n'est plus référencé : un échec de suppression (réseau coupé) ne doit pas faire échouer l'opération. */
  private async supprimerPhoto(url: string): Promise<void> {
    try {
      await this.source.supprimerPhoto(url);
    } catch (erreur) {
      console.warn("La photo du leurre n'a pas pu être supprimée du stockage.", erreur);
    }
  }

  private async suivre(): Promise<void> {
    try {
      if (this.source.surUid) {
        // Abonnement gardé pour toute la vie du service (singleton racine) : on ne le coupe jamais.
        this.source.surUid((uid) => this.ecouterPour(uid), () => this._erreur.set(true));
      } else {
        this.ecouterPour(await this.source.uid());
      }
    } catch {
      this._erreur.set(true);
    }
  }

  /** (Ré)abonne la liste à la boîte de cet utilisateur ; sans utilisateur, la boîte est vide. */
  private ecouterPour(uid: string | null): void {
    this.arreter();
    this.arreter = () => undefined;
    this._erreur.set(false);
    // Autre compte : on repasse en chargement jusqu'au premier instantané. Sans compte, la boîte est vide.
    if (uid !== null && this.uidCourant) this._leurres.set(null);
    this.uidCourant = uid;
    if (uid === null) {
      this._leurres.set([]);
      return;
    }
    this.arreter = this.source.ecouter(
      uid,
      (documents) => {
        this._erreur.set(false);
        this._leurres.set(
          documents
            .map(enLeurre)
            .filter((l): l is Leurre => l !== null)
            .sort((a, b) => b.createdAt - a.createdAt),
        );
      },
      () => this._erreur.set(true),
    );
  }

  private arreter: () => void = () => undefined;
}
