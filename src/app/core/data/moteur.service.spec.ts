/*
 * US 81 : MoteurService donne à l'app les 3 conseils du moteur pour des conditions et un moment.
 * Contrat : src/app/core/data/moteur.service.ts exporte `MoteurService` (providedIn: 'root') avec
 *   conseiller(conditions: Conditions, moment: Date): Promise<ResultatConseil>
 * Il lit le contenu (especes, types de leurres, animations, couleurs) et les poids du moteur avec le CatalogService,
 * dont la nouvelle méthode `poidsMoteur(): Promise<PoidsMoteur>` lit assets/data/engine-weights.json,
 * puis appelle `conseiller` du moteur avec `etatReglementaire(conditions.categorie, moment)`.
 */
import { TestBed } from '@angular/core/testing';
import { CatalogService } from './catalog.service';
import { MoteurService } from './moteur.service';
import { Conditions } from '../engine/conditions';
import { conseiller } from '../engine/scorer';
import { etatReglementaire } from '../regulation/calendar';
import species from '../../../assets/data/species.json';
import lureTypes from '../../../assets/data/lure-types.json';
import techniques from '../../../assets/data/techniques.json';
import couleurs from '../../../assets/data/couleurs.json';
import poids from '../../../assets/data/engine-weights.json';

const CONDITIONS: Conditions = {
  tempEau: 11.5,
  sourceTempEau: 'capteur',
  debitTendance: 'normal',
  pressionTendance48h: -8,
  nuages: 80,
  vent: 12,
  moment: 'jour',
  saison: 'automne',
  categorie: null,
  departement: '49',
  niveau: 'debutant',
};
const MOMENT = new Date('2026-11-09T12:00:00Z');

function service(): MoteurService {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: CatalogService,
        useValue: {
          especes: async () => species,
          typesDeLeurres: async () => lureTypes,
          animations: async () => techniques,
          couleurs: async () => couleurs,
          poidsMoteur: async () => poids,
        },
      },
    ],
  });
  return TestBed.inject(MoteurService);
}

describe('MoteurService (US 81)', () => {
  it('critère 3 : given le contenu et les poids, when on demande le conseil, then il rend 3 conseils triés par score décroissant', async () => {
    const { conseils } = await service().conseiller(CONDITIONS, MOMENT);

    expect(conseils).toHaveLength(3);
    expect(conseils[0].score).toBeGreaterThanOrEqual(conseils[1].score);
    expect(conseils[1].score).toBeGreaterThanOrEqual(conseils[2].score);
  });

  it("critère 3 : given les mêmes conditions, when on demande le conseil, then le résultat est celui du moteur avec la réglementation du moment", async () => {
    const resultat = await service().conseiller(CONDITIONS, MOMENT);

    const attendu = conseiller(
      CONDITIONS,
      { especes: species as never, typesLeurres: lureTypes as never, animations: techniques as never, couleurs: couleurs as never },
      poids as never,
      etatReglementaire(CONDITIONS.categorie, MOMENT),
    );
    expect(resultat).toEqual(attendu);
    expect(resultat.conseils.every((c: { couleur: string; taille: unknown }) => c.couleur !== '' && c.taille !== null)).toBe(true);
  });
});
