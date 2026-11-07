// US 68 : couleur du leurre selon la clarté de l'eau (PLAN §8.1, §8.3, §2.1).
import { Conditions, Saison } from '../conditions';
import { Animation, Couleur, Espece, TypeLeurre } from '../../data/catalog.types';
import { ContenuMoteur, PoidsMoteur, recommander } from '../scorer';
import poidsReels from '../../../../assets/data/engine-weights.json';
import especesReelles from '../../../../assets/data/species.json';
import typesReels from '../../../../assets/data/lure-types.json';
import animationsReelles from '../../../../assets/data/techniques.json';
import couleursReelles from '../../../../assets/data/couleurs.json';

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
  ...FICHE,
};
const type = (id: string, techniques: string[]): TypeLeurre => ({
  id,
  nom: id,
  especes: ['SAN'],
  techniques,
  zoneNage: 'fond',
  interditFermetureBrochet: false,
  ...FICHE,
});
const animation = (id: string, rythme: Animation['rythme']): Animation =>
  ({
    id,
    nom: id,
    geste: 'g',
    vitesse: 'v',
    rythme,
    erreurAEviter: 'e',
    difficulte: 1,
    videos: [],
    ...FICHE,
  }) as Animation;
const couleur = (id: string, classe: Couleur['classe']): Couleur => ({ id, nom: id, classe, ...FICHE });

// Les couleurs de la fixture ont d'autres identifiants que celles du contenu réel, la vive est en premier.
const couleursTest: Couleur[] = [
  couleur('vive-test', 'vive'),
  couleur('naturelle-test', 'naturelle'),
  couleur('naturelle-test-2', 'naturelle'),
];
const fixture: ContenuMoteur = {
  especes: [sandre],
  typesLeurres: [type('t1', ['a']), type('t2', ['b'])],
  animations: [animation('a', 'lent'), animation('b', 'moyen')],
  couleurs: couleursTest,
};
const reel: ContenuMoteur = {
  especes: especesReelles as Espece[],
  typesLeurres: typesReels as TypeLeurre[],
  animations: animationsReelles as unknown as Animation[],
  couleurs: couleursReelles as Couleur[],
};

const conditions = (debitTendance: Conditions['debitTendance'], saison: Saison = 'été'): Conditions => ({
  tempEau: 14,
  sourceTempEau: 'saisie',
  debitTendance,
  pressionTendance48h: null,
  nuages: null,
  vent: null,
  moment: 'jour',
  saison,
  categorie: 2,
  departement: '44',
  especeCible: 'SAN',
  niveau: 'debutant',
});

const classeDe = (contenu: ContenuMoteur, id: string) => contenu.couleurs.find((c) => c.id === id)?.classe;
const parle = (pourquoi: string[], mot: string) => pourquoi.some((p) => p.includes(mot));
const CLARTE = ['eau trouble', 'eau claire', 'clarté'];

describe('US 68 critère 1 : crue, eau trouble, couleur vive', () => {
  it('US 68 critère 1 : given un débit en crue et un contenu de test, when le moteur calcule, then chaque conseil porte la couleur vive du contenu et son pourquoi cite l’eau trouble', () => {
    const conseils = recommander(conditions('crue'), fixture, poids);
    expect(conseils.length).toBeGreaterThan(0);
    for (const c of conseils) {
      expect(c.couleur).toBe('vive-test');
      expect(parle(c.pourquoi, 'eau trouble')).toBe(true);
    }
  });

  it('US 68 critère 1 : given un débit en crue et le contenu réel, when le moteur calcule, then chaque conseil porte une couleur classée vive et son pourquoi cite l’eau trouble', () => {
    const conseils = recommander(conditions('crue'), reel, poids);
    expect(conseils.length).toBeGreaterThan(0);
    for (const c of conseils) {
      expect(classeDe(reel, c.couleur)).toBe('vive');
      expect(parle(c.pourquoi, 'eau trouble')).toBe(true);
    }
  });
});

describe('US 68 critère 2 : étiage, eau claire, couleur naturelle', () => {
  it('US 68 critère 2 : given un débit en étiage et un contenu de test où la vive est en premier, when le moteur calcule, then chaque conseil porte une couleur naturelle du contenu et son pourquoi cite l’eau claire', () => {
    const conseils = recommander(conditions('étiage'), fixture, poids);
    expect(conseils.length).toBeGreaterThan(0);
    for (const c of conseils) {
      expect(classeDe(fixture, c.couleur)).toBe('naturelle');
      expect(parle(c.pourquoi, 'eau claire')).toBe(true);
    }
  });

  it('US 68 critère 2 : given un débit en étiage et le contenu réel, when le moteur calcule, then chaque conseil porte une couleur classée naturelle et son pourquoi cite l’eau claire', () => {
    const conseils = recommander(conditions('étiage'), reel, poids);
    expect(conseils.length).toBeGreaterThan(0);
    for (const c of conseils) {
      expect(classeDe(reel, c.couleur)).toBe('naturelle');
      expect(parle(c.pourquoi, 'eau claire')).toBe(true);
    }
  });
});

describe('US 68 critère 3 : débit normal, couleur par défaut, pas de phrase de clarté', () => {
  it('US 68 critère 3 : given un débit normal et un contenu de test, when le moteur calcule, then chaque conseil porte la première couleur naturelle et aucune phrase ne parle de clarté', () => {
    const conseils = recommander(conditions('normal'), fixture, poids);
    expect(conseils.length).toBeGreaterThan(0);
    for (const c of conseils) {
      expect(c.couleur).toBe('naturelle-test');
      for (const mot of CLARTE) expect(parle(c.pourquoi, mot)).toBe(false);
    }
  });

  it('US 68 critère 3 : given un débit normal et le contenu réel, when le moteur calcule, then chaque conseil porte une couleur naturelle et aucune phrase ne parle de clarté', () => {
    const conseils = recommander(conditions('normal'), reel, poids);
    expect(conseils.length).toBeGreaterThan(0);
    for (const c of conseils) {
      expect(classeDe(reel, c.couleur)).toBe('naturelle');
      for (const mot of CLARTE) expect(parle(c.pourquoi, mot)).toBe(false);
    }
  });
});

describe('US 68 critère 4 : débit inconnu, règle non déclenchée', () => {
  it('US 68 critère 4 : given un débit inconnu et un contenu de test, when le moteur calcule, then la règle de clarté n’est pas déclenchée et chaque conseil porte la couleur par défaut', () => {
    const conseils = recommander(conditions('inconnu'), fixture, poids);
    expect(conseils.length).toBeGreaterThan(0);
    for (const c of conseils) {
      expect(c.couleur).toBe('naturelle-test');
      for (const mot of CLARTE) expect(parle(c.pourquoi, mot)).toBe(false);
    }
  });

  it('US 68 critère 4 : given un débit inconnu et le contenu réel, when le moteur calcule, then chaque conseil porte une couleur naturelle et son pourquoi est celui du débit normal', () => {
    const inconnu = recommander(conditions('inconnu'), reel, poids);
    const normal = recommander(conditions('normal'), reel, poids);
    expect(inconnu.length).toBeGreaterThan(0);
    for (const c of inconnu) {
      expect(classeDe(reel, c.couleur)).toBe('naturelle');
      for (const mot of CLARTE) expect(parle(c.pourquoi, mot)).toBe(false);
    }
    expect(inconnu.map((c) => c.pourquoi)).toEqual(normal.map((c) => c.pourquoi));
  });
});

describe('US 68 règle de clarté : phrase et contenu incomplet', () => {
  it('given un débit en crue et une température inconnue, when le moteur calcule, then la phrase de clarté nomme le poisson', () => {
    const c = { ...conditions('crue'), tempEau: null };
    for (const conseil of recommander(c, fixture, poids)) {
      expect(conseil.pourquoi.find((p) => p.includes('eau trouble'))).toContain('le poisson');
    }
  });

  it('given un débit en étiage et une température inconnue, when le moteur calcule, then la phrase de clarté nomme le poisson', () => {
    const c = { ...conditions('étiage'), tempEau: null };
    for (const conseil of recommander(c, fixture, poids)) {
      expect(conseil.pourquoi.find((p) => p.includes('eau claire'))).toContain('le poisson');
    }
  });

  it('given un contenu sans couleur vive, when le moteur calcule en crue, then la règle n’est pas déclenchée et le conseil garde la couleur par défaut', () => {
    const sansVive: ContenuMoteur = { ...fixture, couleurs: [couleur('nat', 'naturelle')] };
    const conseils = recommander(conditions('crue'), sansVive, poids);
    expect(conseils.length).toBeGreaterThan(0);
    for (const c of conseils) {
      expect(c.couleur).toBe('nat');
      for (const mot of CLARTE) expect(parle(c.pourquoi, mot)).toBe(false);
    }
  });

  it('given un contenu sans couleur naturelle, when le moteur calcule en étiage, then la règle n’est pas déclenchée et le conseil garde la première couleur', () => {
    const sansNat: ContenuMoteur = { ...fixture, couleurs: [couleur('viv', 'vive')] };
    const conseils = recommander(conditions('étiage'), sansNat, poids);
    for (const c of conseils) {
      expect(c.couleur).toBe('viv');
      for (const mot of CLARTE) expect(parle(c.pourquoi, mot)).toBe(false);
    }
  });
});
