// US 72 : pénalité de difficulté selon le niveau (PLAN §8.3, §11).
// Contrat : niveau débutant = 1, intermédiaire = 2. Quand animation.difficulte > niveau, une règle (rules/difficulte.ts,
// enregistrée dans REGLES) ajoute au « pourquoi » la phrase « Animation exigeante pour ton niveau. » avec le facteur
// `penaliteDifficulte` (poids négatif) et points = difficulte - niveau : le score baisse. Sinon elle rend null.
// Test par l'interface publique : `recommander(conditions, contenu, poids)` de scorer.ts.
import { Conditions } from './conditions';
import { ContenuMoteur, PoidsMoteur, recommander } from './scorer';
import { Animation, Espece, TypeLeurre } from '../data/catalog.types';
import poidsReels from '../../../assets/data/engine-weights.json';
import especesReelles from '../../../assets/data/species.json';
import typesReels from '../../../assets/data/lure-types.json';
import animationsReelles from '../../../assets/data/techniques.json';

const POIDS: PoidsMoteur = poidsReels;
const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };
const PHRASE = 'Animation exigeante pour ton niveau';

const sandre: Espece = {
  code: 'SAN',
  nom: 'Sandre',
  tempEauC: { active: [12, 24], ralentie: [4, 12], quasiNulle: [0, 4] },
  postes: [],
  proies: [],
  tailleMinCm: null,
  fermetureAvecBrochet: false,
  verifDepartementPrintemps: false,
  ...FICHE,
};

const animation = (id: string, rythme: 'lent' | 'moyen' | 'rapide', difficulte: 1 | 2 | 3): Animation =>
  ({ id, nom: id, geste: 'Geste.', vitesse: rythme, erreurAEviter: 'Rien.', difficulte, videos: [], rythme, ...FICHE }) as Animation;

const type = (techniques: string[]): TypeLeurre => ({
  id: 'shad',
  nom: 'shad',
  article: 'un',
  especes: ['SAN'],
  techniques,
  zoneNage: 'mi-eau',
  interditFermetureBrochet: false,
  ...FICHE,
});

const conditions = (surcharge: Partial<Conditions> = {}): Conditions => ({
  tempEau: 6,
  sourceTempEau: 'saisie',
  debitTendance: 'normal',
  pressionTendance48h: null,
  nuages: null,
  vent: null,
  moment: 'jour',
  saison: 'hiver',
  categorie: 2,
  departement: '44',
  especeCible: 'SAN',
  niveau: 'debutant',
  ...surcharge,
});

const contenu = (animations: Animation[]): ContenuMoteur => ({
  especes: [sandre],
  typesLeurres: [type(animations.map((a) => a.id))],
  animations,
  couleurs: [],
});

const difficulteDe = (animations: Animation[], id: string): number =>
  animations.find((a) => a.id === id)!.difficulte;

describe('pénalité de difficulté selon le niveau', () => {
  // Garde-fou du cas §11 : depuis le choix du propriétaire (walking-the-dog en difficulté 1), le contenu réel n'a plus
  // d'animation de difficulté 3 ; ce test protège contre une future. Le test construit qui suit prouve le critère.
  it('critère 0 : given des conditions avec niveau débutant et le contenu réel (hiver, eau à 6 °C, sandre), when le moteur calcule le conseil, then le premier conseil n\'est pas une animation de difficulté 3', () => {
    const animations = animationsReelles as unknown as Animation[];
    const reel: ContenuMoteur = {
      especes: especesReelles as unknown as Espece[],
      typesLeurres: typesReels as unknown as TypeLeurre[],
      animations,
      couleurs: [],
    };
    const conseils = recommander(conditions(), reel, POIDS);
    expect(conseils.length).toBeGreaterThan(0);
    expect(difficulteDe(animations, conseils[0].techniqueId)).not.toBe(3);
  });

  it('critère 0 : given un niveau débutant et une animation de difficulté 3 seule meilleure sans pénalité, when le moteur calcule le conseil, then le premier conseil n\'est pas de difficulté 3', () => {
    const animations = [animation('dure', 'lent', 3), animation('facile', 'moyen', 1), animation('moyenne', 'rapide', 2)];
    const conseils = recommander(conditions(), contenu(animations), POIDS);
    expect(difficulteDe(animations, conseils[0].techniqueId)).not.toBe(3);
  });

  it('critère 1 : given un niveau débutant et une animation de difficulté 3 qui serait première sans pénalité, when le moteur calcule le conseil, then elle est classée après une animation de difficulté 1 et son pourquoi contient « Animation exigeante pour ton niveau »', () => {
    // Eau à 6 °C (plage ralentie) : lent = 1 point, moyen = 0,5 point ; l'écart (1,5) est inférieur à la pénalité (2).
    const animations = [animation('dure', 'lent', 3), animation('facile', 'moyen', 1)];
    const conseils = recommander(conditions(), contenu(animations), POIDS);
    const rang = (id: string) => conseils.findIndex((c) => c.techniqueId === id);
    expect(rang('dure')).toBeGreaterThan(rang('facile'));
    expect(rang('facile')).toBe(0);
    const dure = conseils[rang('dure')];
    expect(dure.pourquoi.some((p) => p.includes(PHRASE))).toBe(true);
    expect(conseils[rang('facile')].pourquoi.some((p) => p.includes(PHRASE))).toBe(false);
  });

  it('critère 2 : given un niveau intermédiaire, when le moteur calcule le conseil, then une animation de difficulté 2 n\'est pas pénalisée et une animation de difficulté 3 l\'est', () => {
    const animations = [animation('d1', 'lent', 1), animation('d2', 'lent', 2), animation('d3', 'lent', 3)];
    const conseils = recommander(conditions({ niveau: 'intermediaire' }), contenu(animations), POIDS);
    const de = (id: string) => conseils.find((c) => c.techniqueId === id)!;
    expect(de('d2').pourquoi.some((p) => p.includes(PHRASE))).toBe(false);
    expect(de('d2').score).toBe(de('d1').score);
    expect(de('d3').pourquoi.some((p) => p.includes(PHRASE))).toBe(true);
    expect(de('d3').score).toBeLessThan(de('d1').score);
  });
});
