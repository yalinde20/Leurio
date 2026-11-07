// US 70 : la pression est un indice, pas une certitude (PLAN §8.3).
import { Conditions, Saison } from '../conditions';
import { Animation, Espece, TypeLeurre } from '../../data/catalog.types';
import { reglePression } from './pression';
import { ContexteRegle } from './regle';
import { ContenuMoteur, PoidsMoteur, recommander } from '../scorer';
import poidsReels from '../../../../assets/data/engine-weights.json';

const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };
const poids = poidsReels as unknown as PoidsMoteur;
const avecPoids = (surcharge: Record<string, unknown>) => ({ ...poidsReels, ...surcharge }) as unknown as PoidsMoteur;

// Sandre : eau à 6 °C = plage ralentie (lent 1 point, moyen 0,5, rapide 0).
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
  ({ id, nom: id, geste: 'g', vitesse: 'v', rythme, erreurAEviter: 'e', difficulte: 1, videos: [], ...FICHE }) as Animation;
const conditions = (pression: number | null, saison: Saison = 'hiver'): Conditions => ({
  tempEau: 6,
  sourceTempEau: 'saisie',
  debitTendance: 'normal',
  pressionTendance48h: pression,
  nuages: null,
  vent: null,
  moment: 'jour',
  saison,
  categorie: 2,
  departement: '44',
  especeCible: 'SAN',
  niveau: 'debutant',
});
const appliquer = (pression: number | null, rythme: Animation['rythme'], p: PoidsMoteur = poids) =>
  reglePression({
    conditions: conditions(pression),
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
const phrasesIndice = (pression: number | null, p: PoidsMoteur = poids) =>
  recommander(conditions(pression), contenu(), p).flatMap((c) => c.pourquoi.filter((x) => x.startsWith('Indice : ')));
const toutesPhrases = (pression: number | null) =>
  recommander(conditions(pression), contenu(), poids).flatMap((c) => c.pourquoi);

describe('reglePression', () => {
  it('critère 1 : given une pression en baisse de 7 hPa sur 48 h (seuil 5), when la règle s’applique, then elle est déclenchée, facteur pression, phrase « Indice : » qui dit que la pression baisse', () => {
    const r = appliquer(-7, 'moyen');
    expect(r).not.toBeNull();
    expect(r?.facteur).toBe('pression');
    expect(r?.phrase.startsWith('Indice : ')).toBe(true);
    expect(r?.phrase).toContain('baisse');
  });

  it('critère 1 : given une pression en baisse au-delà du seuil, when l’animation est moyenne ou rapide, then la règle donne 0,4 point, et 0 pour une animation lente (phrase quand même présente)', () => {
    expect(appliquer(-7, 'moyen')?.points).toBe(0.4);
    expect(appliquer(-7, 'rapide')?.points).toBe(0.4);
    const lent = appliquer(-7, 'lent');
    expect(lent?.points).toBe(0);
    expect(lent?.phrase.startsWith('Indice : ')).toBe(true);
  });

  it('critère 1 : given une pression en hausse de 6 hPa, when la règle s’applique, then la phrase commence par « Indice : », dit que la pression monte, et seule l’animation lente a 0,4 point', () => {
    const r = appliquer(6, 'lent');
    expect(r?.phrase.startsWith('Indice : ')).toBe(true);
    expect(r?.phrase).toContain('monte');
    expect(r?.points).toBe(0.4);
    expect(appliquer(6, 'moyen')?.points).toBe(0);
    expect(appliquer(6, 'rapide')?.points).toBe(0);
  });

  it.each([-5, -3, 0, 3, 5, null])(
    'critère 2 : given une pression de %s hPa (stable, seuil inclus ou inconnue), when la règle s’applique, then elle n’est pas déclenchée',
    (pression) => {
      for (const rythme of ['lent', 'moyen', 'rapide'] as const) expect(appliquer(pression, rythme)).toBeNull();
    },
  );

  it('given un seuil de 10 dans les poids et une baisse de 7 hPa, when la règle s’applique, then elle n’est pas déclenchée (le seuil vient du contenu)', () => {
    expect(appliquer(-7, 'moyen', avecPoids({ seuilPression: 10 }))).toBeNull();
    expect(appliquer(-11, 'moyen', avecPoids({ seuilPression: 10 }))).not.toBeNull();
  });
});

describe('recommander avec la règle de pression', () => {
  it('critère 1 : given une baisse de 7 hPa sur 48 h, when le moteur calcule, then le pourquoi contient une phrase qui commence par « Indice : »', () => {
    expect(phrasesIndice(-7).length).toBeGreaterThan(0);
  });

  it('critère 1 : given une baisse de 7 hPa, when le moteur calcule, then le score d’un couple moyen augmente de 0,4 × le poids de la pression', () => {
    const avec = recommander(conditions(-7), contenu(), poids).find((c) => c.typeId === 't-moyen');
    const sans = recommander(conditions(0), contenu(), poids).find((c) => c.typeId === 't-moyen');
    expect(avec?.score).toBeCloseTo((sans?.score ?? 0) + 0.4 * poids.pression, 10);
  });

  it.each([-3, 0, 3, null])(
    'critère 2 : given une pression de %s hPa, when le moteur calcule, then aucune phrase sur la pression n’est ajoutée',
    (pression) => {
      expect(phrasesIndice(pression)).toEqual([]);
      expect(toutesPhrases(pression).some((p) => /pression/i.test(p))).toBe(false);
      // La règle doit exister : un module absent ne doit pas faire passer ce test.
      expect(typeof reglePression).toBe('function');
    },
  );

  it('given un seuil de 10 dans les poids et une baisse de 7 hPa, when le moteur calcule, then aucune phrase « Indice : »', () => {
    expect(phrasesIndice(-7, avecPoids({ seuilPression: 10 }))).toEqual([]);
    expect(phrasesIndice(-11, avecPoids({ seuilPression: 10 })).length).toBeGreaterThan(0);
  });

  it('critère 5 : given la température préfère le couple lent et la pression en baisse préfère le moyen, when le moteur calcule avec les poids par défaut, then le couple lent l’emporte', () => {
    const conseils = recommander(conditions(-7), contenu(), poids);
    expect(conseils[0].typeId).toBe('t-lent');
    expect(conseils[0].score).toBeGreaterThan(conseils[1].score);
    expect(conseils.some((c) => c.pourquoi.some((p) => p.startsWith('Indice : ')))).toBe(true);
  });
});
