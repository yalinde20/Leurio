import { Injectable, signal } from '@angular/core';
import type { SpotEnregistre } from './spots.service';

/**
 * Le spot que l'écran « Spots » demande comme lieu du conseil (« Voir le conseil »). L'écran « Conseil » le prend une seule fois,
 * qu'il soit créé après la navigation ou déjà vivant dans les onglets. Rien n'est mémorisé : ni stockage ni URL.
 */
@Injectable({ providedIn: 'root' })
export class LieuDemandeService {
  private readonly _demande = signal<SpotEnregistre | null>(null);
  /** Le spot demandé et pas encore pris ; `null` sinon. */
  readonly demande = this._demande.asReadonly();

  demander(spot: SpotEnregistre): void {
    this._demande.set(spot);
  }

  /** Rend le spot demandé et l'oublie. */
  prendre(): SpotEnregistre | null {
    const spot = this._demande();
    this._demande.set(null);
    return spot;
  }
}
