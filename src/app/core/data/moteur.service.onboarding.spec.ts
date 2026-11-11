// US 89, critère 9 : avec le contenu réel, un pêcheur « Débutant » ne se voit jamais conseiller en premier une animation de difficulté 3.
// Garde-fou : le contenu actuel n'en a pas (voir difficulte.spec.ts) ; ce test échoue si une animation difficile en tête du conseil apparaît.
import { TestBed } from '@angular/core/testing';
import { CatalogService } from './catalog.service';
import { MoteurService } from './moteur.service';
import { Conditions } from '../engine/conditions';
import species from '../../../assets/data/species.json';
import lureTypes from '../../../assets/data/lure-types.json';
import techniques from '../../../assets/data/techniques.json';
import couleurs from '../../../assets/data/couleurs.json';
import poids from '../../../assets/data/engine-weights.json';

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

describe('MoteurService, niveau débutant (US 89)', () => {
  it("critère 9 : given j'ai choisi « Débutant » et le contenu réel, when le moteur conseille sur des conditions variées (saisons, eau de 3 à 26 °C, moments, débits), then la première animation conseillée n'est jamais de difficulté 3", async () => {
    const moteur = service();
    const difficulte = new Map((techniques as { id: string; difficulte: number }[]).map((t) => [t.id, t.difficulte]));
    let cas = 0;
    for (const saison of ['hiver', 'printemps', 'ete', 'automne'] as const) {
      for (const tempEau of [3, 6, 10, 14, 18, 22, 26]) {
        for (const moment of ['aube', 'jour', 'crepuscule'] as const) {
          for (const debitTendance of ['normal', 'crue', 'etiage'] as const) {
            const conditions = { tempEau, sourceTempEau: 'capteur', debitTendance, pressionTendance48h: -8, nuages: 50, vent: 10, moment, saison, categorie: null, departement: '49', niveau: 'debutant' } as unknown as Conditions;
            const { conseils } = await moteur.conseiller(conditions, MOMENT);
            if (conseils.length === 0) continue;
            cas++;
            expect(difficulte.get(conseils[0].techniqueId), `${saison}, ${tempEau} °C, ${moment}, ${debitTendance}`).not.toBe(3);
          }
        }
      }
    }
    expect(cas).toBeGreaterThan(50);
  });
});
