/*
 * US 83, critère 4 (côté moteur) : une 8e espèce ajoutée au contenu reçoit un conseil sans modification du code.
 * Le vrai MoteurService et le vrai moteur lisent le vrai contenu (species.json, lure-types.json, techniques.json, couleurs.json,
 * engine-weights.json) auquel le test ajoute une espèce « Truite fario » (TRF) et un type de leurre qui la cible : du contenu seul.
 * Le moteur sait déjà filtrer sur `conditions.especeCible` : ce test peut donc passer avant l'implémentation de l'écran.
 */
import { TestBed } from '@angular/core/testing';
import couleurs from '../../../assets/data/couleurs.json';
import poids from '../../../assets/data/engine-weights.json';
import lureTypes from '../../../assets/data/lure-types.json';
import species from '../../../assets/data/species.json';
import techniques from '../../../assets/data/techniques.json';
import { Conditions } from '../engine/conditions';
import { CatalogService } from './catalog.service';
import { MoteurService } from './moteur.service';

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

// Contenu de test : une fiche espèce et un type de leurre qui la cible (copiés de fiches réelles, rien dans le code).
const TRUITE = { ...species[1], code: 'TRF', nom: 'Truite fario' };
const CUILLER_TRUITE = { ...lureTypes[0], id: 'cuiller-truite-test', nom: 'Cuiller truite (test)', especes: ['TRF'] };

function service(): MoteurService {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: CatalogService,
        useValue: {
          especes: async () => [...species, TRUITE],
          typesDeLeurres: async () => [...lureTypes, CUILLER_TRUITE],
          animations: async () => techniques,
          couleurs: async () => couleurs,
          poidsMoteur: async () => poids,
        },
      },
    ],
  });
  return TestBed.inject(MoteurService);
}

describe('MoteurService : espèce ajoutée au contenu (US 83)', () => {
  it('critère 4 : given une 8e espèce de test dans les fichiers de contenu, when le conseil est calculé pour elle, then il est non vide et ne concerne que cette espèce', async () => {
    const { conseils } = await service().conseiller({ ...CONDITIONS, especeCible: 'TRF' }, MOMENT);

    expect(conseils.length).toBeGreaterThan(0);
    expect(conseils.every((c) => c.especeCode === 'TRF')).toBe(true);
    expect(conseils.every((c) => c.typeId === 'cuiller-truite-test')).toBe(true);
  });

  it('critère 4 : given une 8e espèce de test, when le conseil est calculé pour le sandre, then la nouvelle espèce ne s\'y mêle pas', async () => {
    const { conseils } = await service().conseiller({ ...CONDITIONS, especeCible: 'SAN' }, MOMENT);

    expect(conseils).toHaveLength(3);
    expect(conseils.every((c) => c.especeCode === 'SAN')).toBe(true);
  });
});
