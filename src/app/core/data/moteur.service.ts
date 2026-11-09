import { inject, Injectable } from '@angular/core';
import { Conditions } from '../engine/conditions';
import { conseiller, ResultatConseil } from '../engine/scorer';
import { etatReglementaire } from '../regulation/calendar';
import { CatalogService } from './catalog.service';

/** Branche le moteur (TypeScript pur) sur le contenu embarqué : les conseils pour des conditions et un moment. */
@Injectable({ providedIn: 'root' })
export class MoteurService {
  private readonly catalogue = inject(CatalogService);

  async conseiller(conditions: Conditions, moment: Date): Promise<ResultatConseil> {
    const [especes, typesLeurres, animations, couleurs, poids] = await Promise.all([
      this.catalogue.especes(),
      this.catalogue.typesDeLeurres(),
      this.catalogue.animations(),
      this.catalogue.couleurs(),
      this.catalogue.poidsMoteur(),
    ]);
    return conseiller(
      conditions,
      { especes, typesLeurres, animations, couleurs },
      poids,
      etatReglementaire(conditions.categorie, moment),
    );
  }
}
