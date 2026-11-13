import { computed, inject, Injectable, signal } from '@angular/core';
import { Couleur, TypeLeurre } from '../../core/data/catalog.types';
import { TackleBoxService } from '../../core/data/tackle-box.service';
import { trouverDansLaBoite } from '../../core/engine/matcher';
import { Conseil } from '../../core/engine/scorer';
import { LigneBoite, ligneDeLaBoite } from './conseil-format';

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
  /** Vrai quand le top 3 vient de « Toutes les espèces » : le détail le rappelle (maquette, état 4). */
  readonly toutesEspeces = signal(false);

  /** Ce qu'il faut pour confronter le top 3 à la boîte (US 105) ; `null` tant qu'aucun conseil n'est calculé. */
  readonly pourLaBoite = signal<{ conseils: Conseil[]; types: TypeLeurre[]; couleurs: Couleur[] } | null>(null);

  private readonly boite = inject(TackleBoxService);

  /**
   * Une ligne par conseil du top 3 (même ordre), recalculée à chaque instantané de la boîte, cache Firestore compris.
   * Vide tant que la boîte n'est pas lue ou en cas d'erreur de lecture : mieux vaut aucune ligne qu'un « Il te manque » faux.
   */
  readonly lignes = computed<LigneBoite[]>(() => {
    const contenu = this.pourLaBoite();
    const leurres = this.boite.leurres();
    if (contenu === null || leurres === null || this.boite.erreur()) return [];
    return trouverDansLaBoite(contenu.conseils, leurres, contenu.types).map((c) => ligneDeLaBoite(c, contenu));
  });
}
