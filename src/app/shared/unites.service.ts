import { Injectable, signal } from '@angular/core';
import type { Unites } from './unites';

/** Les choix proposés dans « Préférences », dans l'ordre d'affichage. */
export const CHOIX_UNITES: { valeur: Unites; libelle: string }[] = [
  { valeur: 'metriques', libelle: 'Métriques (°C, cm, g)' },
  { valeur: 'imperiales', libelle: 'Impériales (°F, po, oz)' },
];

const CLE = 'leurio.unites';

/**
 * Système d'unités de l'affichage (US 93, décision U1) : métrique par défaut. Le choix reste sur l'appareil (localStorage),
 * jamais dans users/{uid} ; une valeur illisible vaut « métriques ».
 */
@Injectable({ providedIn: 'root' })
export class UnitesService {
  private readonly _choix = signal<Unites>(lireChoix());
  readonly choix = this._choix.asReadonly();

  choisir(unites: Unites): void {
    this._choix.set(unites);
    try {
      localStorage.setItem(CLE, unites);
    } catch {
      // Stockage indisponible : le choix vaut pour cette session seulement.
    }
  }
}

function lireChoix(): Unites {
  try {
    const valeur = localStorage.getItem(CLE);
    return valeur === 'imperiales' ? 'imperiales' : 'metriques';
  } catch {
    return 'metriques';
  }
}
