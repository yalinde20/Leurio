import { Injectable, signal } from '@angular/core';
import type { Espece } from '../../core/data/catalog.types';
import type { SpotEnregistre } from '../../core/data/spots.service';

/** Le moment affiché ; `null` = « Maintenant ». Le libellé et la mention sont figés au choix. */
export interface MomentChoisi {
  date: Date;
  libelle: string;
  mention: string;
}

/** Le dernier résultat de « Ma sortie » (US 14), affiché au-dessus du dock. */
export interface MessageSortie {
  type: 'prete' | 'hors ligne' | 'echec';
  texte: string;
}

/**
 * Le moment, l'espèce, le spot et le message de « Ma sortie » choisis sur l'écran « Conseil », gardés en mémoire le temps de l'app : l'écran est recréé à chaque retour
 * sur l'écran (Boîte, Spots ou Compte puis retour), et « Voir le conseil » (US 7) ne doit changer que le lieu. Jamais mémorisés sur le téléphone.
 */
@Injectable({ providedIn: 'root' })
export class ConseilChoixStore {
  readonly moment = signal<MomentChoisi | null>(null);
  readonly espece = signal<Espece | null>(null);
  /** Le spot choisi dans la feuille « Lieu » ; `null` = « Ma position ». */
  readonly spot = signal<SpotEnregistre | null>(null);
  readonly messageSortie = signal<MessageSortie | null>(null);
}
