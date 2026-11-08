import { Conditions, Saison } from '../conditions';
import { Animation, Espece, TypeLeurre } from '../../data/catalog.types';
import { regleSaison } from './saison';
import { ContenuMoteur, PoidsMoteur, recommander } from '../scorer';
import poidsReels from '../../../../assets/data/engine-weights.json';
import especesReelles from '../../../../assets/data/species.json';
import typesReels from '../../../../assets/data/lure-types.json';
import animationsReelles from '../../../../assets/data/techniques.json';

const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };
const poids: PoidsMoteur = poidsReels;

// Sandre : eau à 6 °C = plage ralentie (lent 1 point, moyen 0,5, rapide 0).
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
const type = (id: string, techniques: string[], saisons?: Saison[]): TypeLeurre => ({
  id,
  nom: id,
  especes: ['SAN'],
  techniques,
  zoneNage: 'fond',
  interditFermetureBrochet: false,
  ...(saisons === undefined ? {} : { saisons }),
  ...FICHE,
});
const animation = (id: string, rythme: Animation['rythme'], saisons?: Saison[]): Animation =>
  ({
    id,
    nom: id,
    geste: 'g',
    vitesse: 'v',
    rythme,
    erreurAEviter: 'e',
    difficulte: 1,
    videos: [],
    ...(saisons === undefined ? {} : { saisons }),
    ...FICHE,
  }) as Animation;
const conditions = (saison: Saison, tempEau: number | null = 6): Conditions => ({
  tempEau,
  sourceTempEau: tempEau === null ? null : 'saisie',
  debitTendance: 'normal',
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
const appliquer = (saison: Saison, t: TypeLeurre, a: Animation) =>
  regleSaison({ conditions: conditions(saison), espece: sandre, type: t, animation: a, couleurs: [] });

describe('regleSaison', () => {
  it('given ni le type ni l’animation ne listent de saison, when la règle s’applique, then elle n’est pas déclenchée', () => {
    expect(appliquer('hiver', type('t', ['a']), animation('a', 'lent'))).toBeNull();
  });

  it('given une animation favorable seulement au printemps, when la saison est l’hiver, then la règle n’est pas déclenchée', () => {
    expect(appliquer('hiver', type('t', ['a']), animation('a', 'lent', ['printemps']))).toBeNull();
  });

  it('given un type favorable à l’hiver, when la saison est l’hiver, then la règle donne 0,5 point et une phrase qui commence par « En hiver »', () => {
    const r = appliquer('hiver', type('t', ['a'], ['hiver']), animation('a', 'lent'));
    expect(r?.facteur).toBe('saison');
    expect(r?.points).toBe(0.5);
    expect(r?.phrase.startsWith('En hiver')).toBe(true);
  });

  it('given une animation favorable à l’hiver, when la saison est l’hiver, then la règle donne 0,5 point et une phrase qui cite l’hiver', () => {
    const r = appliquer('hiver', type('t', ['a']), animation('a', 'lent', ['hiver', 'automne']));
    expect(r?.facteur).toBe('saison');
    expect(r?.points).toBe(0.5);
    expect(r?.phrase).toContain('hiver');
  });

  it.each([
    ['printemps', 'Au printemps'],
    ['été', 'En été'],
    ['automne', 'En automne'],
  ] as [Saison, string][])(
    'given une animation favorable en %s, when la saison est %s, then la phrase commence par « %s »',
    (saison, debut) => {
      const r = appliquer(saison, type('t', ['a']), animation('a', 'lent', [saison]));
      expect(r?.phrase.startsWith(debut)).toBe(true);
    },
  );
});

describe('recommander avec la règle de saison', () => {
  it('given le contenu réel et les conditions hiver, eau à 6 °C, sandre (PLAN §11), when le moteur calcule, then le premier conseil est une verticale ou une tirée-relâchée et son pourquoi cite l’hiver', () => {
    const contenu: ContenuMoteur = {
      especes: especesReelles as Espece[],
      typesLeurres: typesReels as TypeLeurre[],
      animations: animationsReelles as unknown as Animation[],
      couleurs: [],
    };
    const [premier] = recommander(conditions('hiver'), contenu, poids);
    expect(['verticale', 'tiree-relachee']).toContain(premier.techniqueId);
    expect(premier.pourquoi.some((p) => p.startsWith('En hiver'))).toBe(true);
  });

  it('given un couple adapté à l’hiver et un autre non, à température égale, when le moteur calcule en hiver, then le couple adapté est mieux classé et son pourquoi cite l’hiver', () => {
    // Même rythme, donc même point de température ; le second est placé en premier dans le contenu.
    const contenu: ContenuMoteur = {
      especes: [sandre],
      typesLeurres: [type('neutre', ['a']), type('hivernal', ['b'], ['hiver'])],
      animations: [animation('a', 'lent'), animation('b', 'lent')],
      couleurs: [],
    };
    const [premier, second] = recommander(conditions('hiver'), contenu, poids);
    expect(premier.typeId).toBe('hivernal');
    expect(premier.score).toBeGreaterThan(second.score);
    expect(premier.pourquoi.some((p) => p.includes('hiver'))).toBe(true);
    expect(second.pourquoi.some((p) => p.includes('hiver'))).toBe(false);
  });

  it('given le même couple adapté à l’hiver, when la saison est l’été, then il n’a ni avantage ni phrase de saison', () => {
    const contenu: ContenuMoteur = {
      especes: [sandre],
      typesLeurres: [type('neutre', ['a']), type('hivernal', ['b'], ['hiver'])],
      animations: [animation('a', 'lent'), animation('b', 'lent')],
      couleurs: [],
    };
    const [premier, second] = recommander(conditions('été'), contenu, poids);
    expect(premier.score).toBe(second.score);
    expect([...premier.pourquoi, ...second.pourquoi].some((p) => p.includes('hiver'))).toBe(false);
  });

  it('given la température préfère A de 1 point contre 0,5 et la saison préfère B, when le moteur calcule avec les poids par défaut, then A l’emporte', () => {
    // A : lent = 1 point ; B : moyen = 0,5 point mais étiqueté hiver.
    const contenu: ContenuMoteur = {
      especes: [sandre],
      typesLeurres: [type('b', ['moyen'], ['hiver']), type('a', ['lent'])],
      animations: [animation('lent', 'lent'), animation('moyen', 'moyen')],
      couleurs: [],
    };
    const conseils = recommander(conditions('hiver'), contenu, poids);
    expect(conseils.map((c) => c.typeId)).toEqual(['a', 'b']);
    expect(conseils[0].score).toBeGreaterThan(conseils[1].score);
  });

  it('given la température préfère A de 1 point contre 0 et la saison préfère B, when le moteur calcule avec les poids par défaut, then A l’emporte', () => {
    const contenu: ContenuMoteur = {
      especes: [sandre],
      typesLeurres: [type('b', ['rapide'], ['hiver']), type('a', ['lent'])],
      animations: [animation('lent', 'lent'), animation('rapide', 'rapide')],
      couleurs: [],
    };
    const conseils = recommander(conditions('hiver'), contenu, poids);
    expect(conseils.map((c) => c.typeId)).toEqual(['a', 'b']);
  });
});
