import { Injectable, signal } from '@angular/core';

/** Un conseil du top 3, déjà traduit en noms et formaté pour l'écran de détail (US 86). */
export interface DetailConseil {
  rang: number;
  type: string;
  animationId: string;
  animation: string;
  /** Nom de l'espèce du conseil, `null` si la fiche est introuvable dans le contenu. */
  espece: string | null;
  couleur: string;
  taille: { libelle: string; valeur: string } | null;
  /** « 5 à 10 g », seulement pour un type qui a `poidsTeteG`. */
  poidsTete: string | null;
  /** Tous les postes de l'espèce, séparés par « , » ; `null` si l'espèce est introuvable. */
  postes: string | null;
  /** Une phrase par règle déclenchée, dans l'ordre du moteur. */
  pourquoi: string[];
}

/**
 * Le top 3 affiché par l'écran « Conseil », partagé avec le détail : revenir en arrière réaffiche ce top 3
 * sans nouveau calcul. Vide tant qu'aucun conseil n'a été calculé (rechargement sur l'URL d'un détail).
 */
@Injectable({ providedIn: 'root' })
export class ConseilDetailStore {
  readonly details = signal<DetailConseil[]>([]);
}
