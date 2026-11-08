import { Conditions, Saison } from '../conditions';
import { Animation, Espece, TypeLeurre } from '../../data/catalog.types';
import { regleLuminosite } from './luminosite';
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
const type = (
  id: string,
  techniques: string[],
  options: { faibleLumiere?: boolean; saisons?: Saison[] } = {},
): TypeLeurre =>
  ({
    id,
    nom: id,
    especes: ['SAN'],
    techniques,
    zoneNage: 'fond',
    interditFermetureBrochet: false,
    ...options,
    ...FICHE,
  }) as TypeLeurre;
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
const conditions = (
  moment: Conditions['moment'],
  nuages: number | null,
  extra: Partial<Conditions> = {},
): Conditions => ({
  tempEau: 6,
  sourceTempEau: 'saisie',
  debitTendance: 'normal',
  pressionTendance48h: null,
  nuages,
  vent: null,
  moment,
  saison: 'été',
  categorie: 2,
  departement: '44',
  especeCible: 'SAN',
  niveau: 'debutant',
  ...extra,
});
// Même rythme donc même point de température ; le couple adapté est placé en second dans le contenu.
const deuxCouples = (): ContenuMoteur => ({
  especes: [sandre],
  typesLeurres: [type('neutre', ['a']), type('sombre', ['b'], { faibleLumiere: true })],
  animations: [animation('a', 'lent'), animation('b', 'lent')],
  couleurs: [],
});

describe('regleLuminosite', () => {
  it('given la règle de luminosité, when on l’importe, then elle est exportée', () => {
    expect(typeof regleLuminosite).toBe('function');
  });
});

describe('recommander avec la règle de luminosité', () => {
  it('critère 1 : given le contenu réel et les conditions été, aube, black-bass, when le moteur calcule, then le premier conseil est un leurre de surface', () => {
    const contenu: ContenuMoteur = {
      especes: especesReelles as Espece[],
      typesLeurres: typesReels as TypeLeurre[],
      animations: animationsReelles as unknown as Animation[],
      couleurs: [],
    };
    const c = conditions('aube', null, { tempEau: 22, especeCible: 'BBG' });
    const [premier] = recommander(c, contenu, poids);
    const types = typesReels as TypeLeurre[];
    expect(types.find((t) => t.id === premier.typeId)?.zoneNage).toBe('surface');
    expect(premier.pourquoi.some((p) => p.includes('lumière'))).toBe(true);
  });

  it.each([
    ['aube', 'aube', null],
    ['crépuscule', 'crépuscule', null],
    ['ciel couvert (nuages 80, jour)', 'jour', 80],
    ['ciel couvert au seuil (nuages 70, jour)', 'jour', 70],
  ] as [string, Conditions['moment'], number | null][])(
    'critère 2 : given deux couples identiques sauf la faible lumière, when le moteur calcule à/par %s, then le couple adapté est mieux classé et son pourquoi cite la lumière',
    (_nom, moment, nuages) => {
      const [premier, second] = recommander(conditions(moment, nuages), deuxCouples(), poids);
      expect(premier.typeId).toBe('sombre');
      expect(premier.score).toBeGreaterThan(second.score);
      expect(premier.pourquoi.some((p) => p.includes('lumière'))).toBe(true);
      expect(second.pourquoi.some((p) => p.includes('lumière'))).toBe(false);
    },
  );

  it('critère 2 : given deux couples identiques sauf la faible lumière, when il fait jour avec 30 % de nuages, then ils sont à égalité et aucune phrase ne cite la lumière', () => {
    const [premier, second] = recommander(conditions('jour', 30), deuxCouples(), poids);
    expect(premier.score).toBe(second.score);
    expect([...premier.pourquoi, ...second.pourquoi].some((p) => p.includes('lumière'))).toBe(false);
  });

  it('critère 2 : given nuages inconnus (null) en plein jour, when le moteur calcule, then la règle n’est pas déclenchée', () => {
    const [premier, second] = recommander(conditions('jour', null), deuxCouples(), poids);
    expect(premier.score).toBe(second.score);
    expect([...premier.pourquoi, ...second.pourquoi].some((p) => p.includes('lumière'))).toBe(false);
  });

  it('critère 2 : given 69 % de nuages en plein jour, when le moteur calcule, then la règle n’est pas déclenchée (seuil à 70)', () => {
    const [premier, second] = recommander(conditions('jour', 69), deuxCouples(), poids);
    expect(premier.score).toBe(second.score);
  });

  it('critère 2 : given un seuil de ciel couvert à 90 dans les poids, when il y a 80 % de nuages en plein jour, then la règle n’est pas déclenchée (seuil lu dans les poids)', () => {
    const [premier, second] = recommander(
      conditions('jour', 80),
      deuxCouples(),
      { ...poids, seuilCielCouvert: 90 },
    );
    expect(premier.score).toBe(second.score);
  });

  it.each([
    ['aube', 'aube', null, "À l'aube, la lumière est faible : c'est le moment d'un leurre adapté (sombre)."],
    ['crépuscule', 'crépuscule', null, "À la tombée du jour, la lumière est faible : c'est le moment d'un leurre adapté (sombre)."],
    ['ciel couvert', 'jour', 80, "Par ciel couvert, la lumière est faible : c'est le moment d'un leurre adapté (sombre)."],
  ] as [string, Conditions['moment'], number | null, string][])(
    'critère 2 : given un couple adapté, when le moteur calcule à/par %s, then la phrase est exactement celle attendue',
    (_nom, moment, nuages, phrase) => {
      const [premier] = recommander(conditions(moment, nuages), deuxCouples(), poids);
      expect(premier.pourquoi).toContain(phrase);
    },
  );

  it('critère 2 : given la nuit avec 90 % de nuages, when le moteur calcule, then ils sont à égalité et aucune phrase ne cite la lumière', () => {
    const [premier, second] = recommander(conditions('nuit', 90), deuxCouples(), poids);
    expect(premier.score).toBe(second.score);
    expect([...premier.pourquoi, ...second.pourquoi].some((p) => p.includes('lumière'))).toBe(false);
  });

  it('critère 2 : given la nuit, when le moteur calcule, then la règle n’est pas déclenchée', () => {
    const [premier, second] = recommander(conditions('nuit', null), deuxCouples(), poids);
    expect(premier.score).toBe(second.score);
  });

  it('critère 2 : given un type qui n’est pas adapté à la faible lumière, when il y a 100 % de nuages, then rien n’est dit sur la lumière', () => {
    const contenu: ContenuMoteur = {
      especes: [sandre],
      typesLeurres: [type('neutre', ['a'])],
      animations: [animation('a', 'lent')],
      couleurs: [],
    };
    const [seul] = recommander(conditions('aube', 100), contenu, poids);
    expect(seul.pourquoi.some((p) => p.includes('lumière'))).toBe(false);
  });

  it('critère 3 : given la température préfère A (lent, 1 point) et la luminosité préfère B (rapide, 0 point), when le moteur calcule à l’aube avec les poids par défaut, then A l’emporte', () => {
    const contenu: ContenuMoteur = {
      especes: [sandre],
      typesLeurres: [type('b', ['rapide'], { faibleLumiere: true }), type('a', ['lent'])],
      animations: [animation('lent', 'lent'), animation('rapide', 'rapide')],
      couleurs: [],
    };
    const conseils = recommander(conditions('aube', 90), contenu, poids);
    expect(conseils.map((c) => c.typeId)).toEqual(['a', 'b']);
    expect(conseils[0].score).toBeGreaterThan(conseils[1].score);
  });

  it('critère 3 : given la température préfère A (lent, 1 point) contre B (moyen, 0,5) adapté à la faible lumière, when le moteur calcule à l’aube, then A l’emporte', () => {
    const contenu: ContenuMoteur = {
      especes: [sandre],
      typesLeurres: [type('b', ['moyen'], { faibleLumiere: true }), type('a', ['lent'])],
      animations: [animation('lent', 'lent'), animation('moyen', 'moyen')],
      couleurs: [],
    };
    const conseils = recommander(conditions('aube', null), contenu, poids);
    expect(conseils.map((c) => c.typeId)).toEqual(['a', 'b']);
  });

  it('critère 3 : given la température préfère A et B cumule saison et faible lumière, when le moteur calcule en hiver à l’aube, then A l’emporte', () => {
    const contenu: ContenuMoteur = {
      especes: [sandre],
      typesLeurres: [
        type('b', ['moyen'], { faibleLumiere: true, saisons: ['hiver'] }),
        type('a', ['lent']),
      ],
      animations: [animation('lent', 'lent'), animation('moyen', 'moyen')],
      couleurs: [],
    };
    const conseils = recommander(conditions('aube', null, { saison: 'hiver' }), contenu, poids);
    expect(conseils.map((c) => c.typeId)).toEqual(['a', 'b']);
    expect(conseils[0].score).toBeGreaterThan(conseils[1].score);
  });
});
