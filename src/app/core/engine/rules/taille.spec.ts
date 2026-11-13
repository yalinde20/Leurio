// US 71 : taille (cm) ou poids (g) du leurre selon l'activité du poisson (PLAN §2.1, §8.3).
import { Conditions } from '../conditions';
import { Animation, Couleur, Espece, TypeLeurre } from '../../data/catalog.types';
import { ContenuMoteur, PoidsMoteur, recommander } from '../scorer';
import { regleTaille } from './taille';
import poidsReels from '../../../../assets/data/engine-weights.json';

const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };
const poids: PoidsMoteur = poidsReels;

const sandre: Espece = {
  code: 'SAN',
  nom: 'Sandre',
  tempEauC: { active: [12, 24], ralentie: [6, 12], quasiNulle: [0, 6] },
  postes: [],
  proies: [],
  tailleMinCm: null,
  fermetureAvecBrochet: false,
  verifDepartementPrintemps: false,
  ...FICHE,
};
const type = (id: string, gamme: Partial<Pick<TypeLeurre, 'tailleCm' | 'poidsG'>>): TypeLeurre => ({
  id,
  nom: id,
  article: 'un',
  especes: ['SAN'],
  techniques: ['a'],
  zoneNage: 'fond',
  interditFermetureBrochet: false,
  ...gamme,
  ...FICHE,
});
const animationA = {
  id: 'a',
  nom: 'a',
  geste: 'g',
  vitesse: 'v',
  rythme: 'lent',
  erreurAEviter: 'e',
  difficulte: 1,
  videos: [],
  ...FICHE,
} as Animation;
const couleur: Couleur = { id: 'c', nom: 'c', classe: 'naturelle', ...FICHE };

const CM: [number, number] = [6, 12]; // milieu 9
const G: [number, number] = [10, 20]; // milieu 15
const shad = type('shad', { tailleCm: CM });
const jig = type('jig', { poidsG: G });
const sansGamme = type('sans-gamme', {});

const contenu = (t: TypeLeurre): ContenuMoteur => ({
  especes: [sandre],
  typesLeurres: [t],
  animations: [animationA],
  couleurs: [couleur],
});
const conditions = (tempEau: number | null): Conditions => ({
  tempEau,
  sourceTempEau: 'saisie',
  debitTendance: 'normal',
  pressionTendance48h: null,
  nuages: null,
  vent: null,
  moment: 'jour',
  saison: 'été',
  categorie: 2,
  departement: '44',
  especeCible: 'SAN',
  niveau: 'debutant',
});
const conseil = (t: TypeLeurre, tempEau: number | null) => {
  const conseils = recommander(conditions(tempEau), contenu(t), poids);
  expect(conseils.length).toBe(1);
  return conseils[0];
};
const dit = (pourquoi: string[], mot: string) => pourquoi.some((p) => p.includes(mot));

describe('US 71 critère 1 : la taille ou le poids est dans la gamme du contenu', () => {
  it('critère 1 : given un type avec tailleCm et une eau à 18 °C, when le moteur calcule le conseil, then la taille est en cm et dans la gamme', () => {
    const { taille } = conseil(shad, 18);
    expect(taille?.unite).toBe('cm');
    expect(taille!.valeur).toBeGreaterThanOrEqual(CM[0]);
    expect(taille!.valeur).toBeLessThanOrEqual(CM[1]);
  });

  it('critère 1 : given un type avec poidsG et une eau à 8 °C, when le moteur calcule le conseil, then le poids est en g et dans la gamme', () => {
    const { taille } = conseil(jig, 8);
    expect(taille?.unite).toBe('g');
    expect(taille!.valeur).toBeGreaterThanOrEqual(G[0]);
    expect(taille!.valeur).toBeLessThanOrEqual(G[1]);
  });

  it('critère 1 : given une eau sans température connue, when le moteur calcule le conseil, then la taille est le milieu de la gamme et le pourquoi ne parle ni d’eau froide ni de poisson actif', () => {
    const c = conseil(shad, null);
    expect(c.taille).toEqual({ valeur: 9, unite: 'cm' });
    expect(dit(c.pourquoi, 'eau froide')).toBe(false);
    expect(dit(c.pourquoi, 'actif')).toBe(false);
    expect(regleTaille({ conditions: conditions(null), espece: sandre, type: shad, animation: animationA, couleurs: [couleur], poids })).toBeNull();
  });

  it('critère 1 : given une eau hors de toute plage de l’espèce, when le moteur calcule le conseil, then la taille est le milieu de la gamme', () => {
    expect(conseil(jig, 30).taille).toEqual({ valeur: 15, unite: 'g' });
  });

  it('critère 1 : given un type sans gamme de taille ni de poids, when le moteur calcule le conseil, then la taille est null et aucune phrase ne la mentionne', () => {
    const c = conseil(sansGamme, 8);
    expect(c.taille).toBeNull();
    expect(dit(c.pourquoi, 'eau froide')).toBe(false);
    expect(regleTaille({ conditions: conditions(8), espece: sandre, type: sansGamme, animation: animationA, couleurs: [couleur], poids })).toBeNull();
  });

  it('critère 1 : given la même eau, when on ajoute une gamme au type, then le score ne change pas (la règle donne 0 point)', () => {
    const avec = conseil(shad, 8).score;
    const sans = conseil(sansGamme, 8).score;
    expect(avec).toBe(sans);
  });
});

describe('US 71 critère 2 : eau ralentie ou quasi nulle, moitié basse et eau froide', () => {
  it.each([
    ['ralentie', 8],
    ['quasiNulle', 3],
  ])('critère 2 : given une eau %s (%d °C) et un type en cm, when le moteur calcule le conseil, then la taille est dans la moitié basse et le pourquoi cite l’eau froide', (_bande, temp) => {
    const c = conseil(shad, temp);
    expect(c.taille?.unite).toBe('cm');
    expect(c.taille!.valeur).toBeGreaterThanOrEqual(CM[0]);
    expect(c.taille!.valeur).toBeLessThanOrEqual((CM[0] + CM[1]) / 2);
    expect(dit(c.pourquoi, 'eau froide')).toBe(true);
  });

  it.each([
    ['ralentie', 8],
    ['quasiNulle', 3],
  ])('critère 2 : given une eau %s (%d °C) et un type en g, when le moteur calcule le conseil, then le poids est dans la moitié basse et le pourquoi cite l’eau froide', (_bande, temp) => {
    const c = conseil(jig, temp);
    expect(c.taille?.unite).toBe('g');
    expect(c.taille!.valeur).toBeGreaterThanOrEqual(G[0]);
    expect(c.taille!.valeur).toBeLessThanOrEqual((G[0] + G[1]) / 2);
    expect(dit(c.pourquoi, 'eau froide')).toBe(true);
  });

  it('critère 2 : given une eau ralentie, when on évalue la règle seule, then elle donne 0 point sur le facteur température et une taille dans la moitié basse', () => {
    const r = regleTaille({ conditions: conditions(8), espece: sandre, type: shad, animation: animationA, couleurs: [couleur], poids });
    expect(r).not.toBeNull();
    expect(r!.facteur).toBe('temperature');
    expect(r!.points).toBe(0);
    expect(r!.phrase).toContain('eau froide');
    expect(r!.taille!.valeur).toBeLessThanOrEqual(9);
  });
});

describe('US 71 critère 3 : eau active, moitié haute', () => {
  it('critère 3 : given une eau active et un type en cm, when le moteur calcule le conseil, then la taille est dans la moitié haute et le pourquoi ne cite pas l’eau froide', () => {
    const c = conseil(shad, 18);
    expect(c.taille?.unite).toBe('cm');
    expect(c.taille!.valeur).toBeGreaterThanOrEqual((CM[0] + CM[1]) / 2);
    expect(c.taille!.valeur).toBeLessThanOrEqual(CM[1]);
    expect(dit(c.pourquoi, 'actif')).toBe(true);
    expect(dit(c.pourquoi, 'eau froide')).toBe(false);
  });

  it('critère 3 : given une eau active et un type en g, when le moteur calcule le conseil, then le poids est dans la moitié haute', () => {
    const c = conseil(jig, 24); // haut de la plage active, inclus
    expect(c.taille?.unite).toBe('g');
    expect(c.taille!.valeur).toBeGreaterThanOrEqual((G[0] + G[1]) / 2);
    expect(c.taille!.valeur).toBeLessThanOrEqual(G[1]);
  });
});
