// US 70 : la lune est un bonus, jamais une pénalité (PLAN §8.3).
import { Conditions, Saison } from '../conditions';
import { Animation, Espece, TypeLeurre } from '../../data/catalog.types';
import { regleLune } from './lune';
import { ContexteRegle } from './regle';
import { ContenuMoteur, PoidsMoteur, recommander } from '../scorer';
import poidsReels from '../../../../assets/data/engine-weights.json';

const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };
const poids = poidsReels as unknown as PoidsMoteur;
const avecPoids = (surcharge: Record<string, unknown>) => ({ ...poidsReels, ...surcharge }) as unknown as PoidsMoteur;
const PHASES = [
  'Nouvelle lune',
  'Premier croissant',
  'Premier quartier',
  'Gibbeuse croissante',
  'Pleine lune',
  'Gibbeuse décroissante',
  'Dernier quartier',
  'Dernier croissant',
];
const RYTHMES = ['lent', 'moyen', 'rapide'] as const;

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
const type = (id: string, techniques: string[]): TypeLeurre => ({
  id,
  nom: id,
  article: 'un',
  especes: ['SAN'],
  techniques,
  zoneNage: 'fond',
  interditFermetureBrochet: false,
  ...FICHE,
});
const animation = (id: string, rythme: Animation['rythme']): Animation =>
  ({ id, nom: id, geste: 'g', vitesse: 'v', rythme, erreurAEviter: 'e', difficulte: 1, videos: [], ...FICHE }) as Animation;
const conditions = (phaseLune: string | null, saison: Saison = 'hiver'): Conditions =>
  ({
    tempEau: 6,
    sourceTempEau: 'saisie',
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
    phaseLune,
  }) as Conditions;
const appliquer = (phaseLune: string | null, rythme: Animation['rythme'], p: PoidsMoteur = poids) =>
  regleLune({
    conditions: conditions(phaseLune),
    espece: sandre,
    type: type('t', ['a']),
    animation: animation('a', rythme),
    couleurs: [],
    poids: p,
  } as unknown as ContexteRegle);
const contenu = (): ContenuMoteur => ({
  especes: [sandre],
  typesLeurres: [type('t-lent', ['lent']), type('t-moyen', ['moyen']), type('t-rapide', ['rapide'])],
  animations: [animation('lent', 'lent'), animation('moyen', 'moyen'), animation('rapide', 'rapide')],
  couleurs: [],
});
const score = (phaseLune: string | null, typeId: string, p: PoidsMoteur = poids) =>
  recommander(conditions(phaseLune), contenu(), p).find((c) => c.typeId === typeId)?.score as number;

describe('regleLune', () => {
  it('critère 3 : given une phase de lune quelconque, when la règle s’applique à un couple quelconque, then elle ne donne jamais de points négatifs', () => {
    for (const phase of [...PHASES, null])
      for (const rythme of RYTHMES) {
        const r = appliquer(phase, rythme);
        expect(r === null || r.points >= 0).toBe(true);
      }
  });

  it('critère 3 : given chaque phase de lune, when le moteur calcule, then le score de chaque couple avec la lune est au moins égal à son score sans phase de lune', () => {
    expect(typeof regleLune).toBe('function');
    for (const phase of PHASES)
      for (const t of ['t-lent', 't-moyen', 't-rapide'])
        expect(score(phase, t)).toBeGreaterThanOrEqual(score(null, t));
  });

  it.each(['Nouvelle lune', 'Pleine lune'])(
    'critère 4 : given la phase « %s » qui déclenche le bonus, when la règle s’applique à un couple moyen ou rapide, then elle donne 0,25 point, facteur lune, et une phrase qui cite la lune',
    (phase) => {
      for (const rythme of ['moyen', 'rapide'] as const) {
        const r = appliquer(phase, rythme);
        expect(r?.facteur).toBe('lune');
        expect(r?.points).toBe(0.25);
        expect(r?.phrase.toLowerCase()).toContain('lune');
      }
    },
  );

  it('given la phase Pleine lune, when la règle s’applique à un couple lent, then elle n’est pas déclenchée', () => {
    expect(appliquer('Pleine lune', 'lent')).toBeNull();
  });

  it.each(['Premier croissant', 'Premier quartier', 'Gibbeuse croissante', 'Gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant', null])(
    'given la phase %s qui ne déclenche pas le bonus, when la règle s’applique, then elle n’est pas déclenchée',
    (phase) => {
      for (const rythme of RYTHMES) expect(appliquer(phase, rythme)).toBeNull();
    },
  );

  it('given des poids dont phasesLuneBonus vaut [Premier quartier], when la règle s’applique, then le bonus est sur cette phase et plus sur la pleine lune (la liste vient du contenu)', () => {
    const p = avecPoids({ phasesLuneBonus: ['Premier quartier'] });
    expect(appliquer('Premier quartier', 'moyen', p)?.points).toBe(0.25);
    expect(appliquer('Pleine lune', 'moyen', p)).toBeNull();
  });
});

describe('recommander avec la règle de lune', () => {
  it('critère 4 : given la pleine lune, when le moteur calcule, then les couples moyen et rapide gagnent 0,25 × le poids de la lune et leur pourquoi cite la lune', () => {
    for (const t of ['t-moyen', 't-rapide']) {
      expect(score('Pleine lune', t)).toBeCloseTo(score(null, t) + 0.25 * poids.lune, 10);
      const conseil = recommander(conditions('Pleine lune'), contenu(), poids).find((c) => c.typeId === t);
      expect(conseil?.pourquoi.some((p) => p.toLowerCase().includes('lune'))).toBe(true);
    }
  });

  it('critère 4 : given la pleine lune, when le moteur calcule, then le couple lent garde son score et son pourquoi ne cite pas la lune', () => {
    expect(typeof regleLune).toBe('function');
    expect(score('Pleine lune', 't-lent')).toBe(score(null, 't-lent'));
    const lent = recommander(conditions('Pleine lune'), contenu(), poids).find((c) => c.typeId === 't-lent');
    expect(lent?.pourquoi.some((p) => p.toLowerCase().includes('lune'))).toBe(false);
  });

  it('critère 5 : given des poids par défaut, la température qui préfère le couple lent et la pleine lune qui préfère le moyen ou le rapide, when le moteur calcule, then le couple lent est premier', () => {
    const conseils = recommander(conditions('Pleine lune'), contenu(), poids);
    expect(conseils[0].typeId).toBe('t-lent');
    expect(conseils[0].score).toBeGreaterThan(conseils[1].score);
    expect(conseils.some((c) => c.pourquoi.some((p) => p.toLowerCase().includes('lune')))).toBe(true);
  });
});
