import { Injectable, signal } from '@angular/core';
import type { Espece } from '../../core/data/catalog.types';

/** Le moment affiché ; `null` = « Maintenant ». Le libellé et la mention sont figés au choix. */
export interface MomentChoisi {
  date: Date;
  libelle: string;
  mention: string;
}

/**
 * Le moment et l'espèce choisis sur l'écran « Conseil », gardés en mémoire le temps de l'app : l'écran est recréé à chaque retour
 * sur l'onglet, et « Voir le conseil » (US 7) ne doit changer que le lieu. Jamais mémorisés sur le téléphone.
 */
@Injectable({ providedIn: 'root' })
export class ConseilChoixStore {
  readonly moment = signal<MomentChoisi | null>(null);
  readonly espece = signal<Espece | null>(null);
}
