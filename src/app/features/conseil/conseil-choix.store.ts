import { Injectable, signal } from '@angular/core';
import type { Espece } from '../../core/data/catalog.types';
import type { SpotEnregistre } from '../../core/data/spots.service';

/** Le moment affiché ; `null` = « Maintenant ». Le libellé et la mention sont figés au choix. */
export interface MomentChoisi {
  date: Date;
  libelle: string;
  mention: string;
}

/** La dernière sortie préparée avec succès (US 14) : son message et l'instant où ses conditions s'arrêtent. Les erreurs ne sont jamais gardées. */
export interface SortiePrete {
  texte: string;
  jusquA: Date;
}

/**
 * Le moment, l'espèce, le spot choisi et la sortie préparée sur l'écran « Conseil », gardés en mémoire le temps de l'app : l'écran est recréé à chaque retour
 * sur l'écran (Boîte, Spots ou Compte puis retour), et « Voir le conseil » (US 7) ne doit changer que le lieu. Jamais mémorisés sur le téléphone.
 */
@Injectable({ providedIn: 'root' })
export class ConseilChoixStore {
  readonly moment = signal<MomentChoisi | null>(null);
  readonly espece = signal<Espece | null>(null);
  /** Le spot choisi dans la feuille « Lieu » ; `null` = « Ma position ». */
  readonly spot = signal<SpotEnregistre | null>(null);
  /** Le message « Sortie prête » ; effacé au retour quand `jusquA` est passé. */
  readonly sortiePrete = signal<SortiePrete | null>(null);

  /** Remet tout à zéro : la suppression du compte renvoie l'app à l'état du premier lancement. */
  reinitialiser(): void {
    this.moment.set(null);
    this.espece.set(null);
    this.spot.set(null);
    this.sortiePrete.set(null);
  }
}
