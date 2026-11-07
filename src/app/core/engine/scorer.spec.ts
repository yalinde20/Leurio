// US 66 : classer leurres et animations selon la température de l'eau (PLAN §8.3, §8.6, §7, §11).
// Contrat : scorer.ts (TypeScript pur) exporte `recommander(conditions, contenu, poids): Conseil[]`, au plus 3 conseils
// `{ typeId, techniqueId, especeCode, score, pourquoi }` triés par score décroissant (égalités : ordre du contenu).
// Un couple (type, animation) est compatible avec une espèce si type.especes contient son code et type.techniques l'id de l'animation.
import { Conditions } from './conditions';
import { ContenuMoteur, PoidsMoteur, recommander } from './scorer';
import { Animation, Espece, TypeLeurre } from '../data/catalog.types';
import poidsReels from '../../../assets/data/engine-weights.json';
import especesReelles from '../../../assets/data/species.json';
import typesReels from '../../../assets/data/lure-types.json';
import animationsReelles from '../../../assets/data/techniques.json';

const POIDS: PoidsMoteur = poidsReels;
const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };

const espece = (code: string, nom: string): Espece => ({
  code,
  nom,
  tempEauC: { active: [12, 24], ralentie: [4, 12], quasiNulle: [0, 4] },
  postes: [],
  proies: [],
  tailleMinCm: null,
  fermetureAvecBrochet: false,
  ...FICHE,
});

const animation = (id: string, rythme: 'lent' | 'moyen' | 'rapide', difficulte: 1 | 2 | 3 = 1): Animation =>
  ({ id, nom: id, geste: 'Geste.', vitesse: rythme, erreurAEviter: 'Rien.', difficulte, videos: [], rythme, ...FICHE }) as Animation;

const type = (id: string, especes: string[], techniques: string[]): TypeLeurre => ({
  id,
  nom: id,
  especes,
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

const ANIMATIONS = [
  animation('rapide-a', 'rapide'),
  animation('lente-a', 'lent'),
  animation('moyenne-a', 'moyen'),
  animation('rapide-b', 'rapide'),
  animation('lente-b', 'lent'),
];

const ESPECES = [espece('SAN', 'Sandre'), espece('BRO', 'Brochet')];

const contenu = (typesLeurres: TypeLeurre[], animations = ANIMATIONS, especes = ESPECES): ContenuMoteur => ({
  especes,
  typesLeurres,
  animations,
});

describe('recommander', () => {
  it('critère 0 : given des types compatibles et non compatibles avec le sandre, when le moteur calcule le conseil, then chaque conseil est un couple (type, animation) compatible avec le sandre', () => {
    const types = [
      type('shad', ['SAN', 'BRO'], ['rapide-a', 'lente-a']),
      type('cuiller', ['BRO'], ['rapide-b', 'lente-b']),
      type('jig', ['SAN'], ['moyenne-a', 'inconnue']),
    ];
    const conseils = recommander(conditions(), contenu(types), POIDS);
    expect(conseils.length).toBeGreaterThan(0);
    for (const c of conseils) {
      const t = types.find((x) => x.id === c.typeId);
      expect(t, `type ${c.typeId}`).toBeDefined();
      expect(t!.especes).toContain('SAN');
      expect(t!.techniques).toContain(c.techniqueId);
      expect(ANIMATIONS.map((a) => a.id)).toContain(c.techniqueId);
      expect(c.especeCode).toBe('SAN');
    }
    expect(conseils.map((c) => c.typeId)).not.toContain('cuiller');
  });

  it('critère 1 : given plus de 3 couples compatibles, when le moteur calcule le conseil, then il rend exactement 3 conseils triés par score décroissant', () => {
    const types = [
      type('shad', ['SAN'], ['rapide-a', 'lente-a', 'moyenne-a']),
      type('jig', ['SAN'], ['rapide-b', 'lente-b']),
    ];
    const conseils = recommander(conditions(), contenu(types), POIDS);
    expect(conseils).toHaveLength(3);
    for (let i = 1; i < conseils.length; i++) {
      expect(conseils[i - 1].score).toBeGreaterThanOrEqual(conseils[i].score);
    }
  });

  it('critère 2 : given seulement 2 couples compatibles, when le moteur calcule le conseil, then il rend 2 conseils', () => {
    const types = [type('shad', ['SAN'], ['rapide-a', 'lente-a']), type('cuiller', ['BRO'], ['lente-b'])];
    expect(recommander(conditions(), contenu(types), POIDS)).toHaveLength(2);
  });

  it('critère 3 : given une eau à 6 °C dans la plage ralentie du sandre, une animation lente et une rapide, when le moteur calcule le conseil, then la lente est classée avant la rapide et son pourquoi cite 6 °C et le sandre', () => {
    const types = [type('shad', ['SAN'], ['rapide-a', 'lente-a'])];
    const conseils = recommander(conditions({ tempEau: 6 }), contenu(types), POIDS);
    const ids = conseils.map((c) => c.techniqueId);
    expect(ids).toEqual(['lente-a', 'rapide-a']);
    expect(conseils[0].score).toBeGreaterThan(conseils[1].score);
    const phrase = conseils[0].pourquoi.find((p) => p.includes('6 °C'));
    expect(phrase, conseils[0].pourquoi.join(' | ')).toBeDefined();
    expect(phrase!.toLowerCase()).toContain('sandre');
  });

  it('critère 4 : given une température connue, when on lit le pourquoi, then il contient une phrase pour la règle de température déclenchée', () => {
    const types = [type('shad', ['SAN'], ['lente-a'])];
    const [conseil] = recommander(conditions({ tempEau: 6 }), contenu(types), POIDS);
    expect(conseil.pourquoi).toHaveLength(1);
    expect(conseil.pourquoi[0]).toContain('6 °C');
  });

  it('critère 4 : given une température inconnue, when on lit le pourquoi, then il ne contient aucune phrase pour la règle de température non déclenchée', () => {
    const types = [type('shad', ['SAN'], ['lente-a', 'rapide-a'])];
    const conseils = recommander(conditions({ tempEau: null, sourceTempEau: null }), contenu(types), POIDS);
    expect(conseils).toHaveLength(2);
    for (const c of conseils) expect(c.pourquoi).toEqual([]);
  });

  it('critère 5 : given le poids de la température à 0, when le moteur recalcule le même cas, then le classement change sans modification du code', () => {
    // Même difficulté, rapide listée avant lente dans le contenu : sans poids de température, l'ordre du contenu s'impose.
    const types = [type('shad', ['SAN'], ['rapide-a', 'lente-a'])];
    const cas = contenu(types);
    const avec = recommander(conditions({ tempEau: 6 }), cas, POIDS).map((c) => c.techniqueId);
    const sans = recommander(conditions({ tempEau: 6 }), cas, { ...POIDS, temperature: 0 }).map((c) => c.techniqueId);
    expect(avec).toEqual(['lente-a', 'rapide-a']);
    expect(sans).toEqual(['rapide-a', 'lente-a']);
  });

  it('critère 6 : given une 8e espèce ajoutée au contenu réel (fiche et code dans des types de leurres), when le moteur calcule un conseil pour elle, then il rend des conseils pour cette espèce sans modification du code', () => {
    const truite: Espece = {
      ...espece('TRF', 'Truite fario'),
      tempEauC: { active: [8, 16], ralentie: [4, 8], quasiNulle: [0, 4] },
    };
    const especes = [...(especesReelles as Espece[]), truite];
    const types = (typesReels as TypeLeurre[]).map((t, i) => (i < 3 ? { ...t, especes: [...t.especes, 'TRF'] } : t));
    const ajoutes = types.slice(0, 3).map((t) => t.id);
    const conseils = recommander(
      conditions({ especeCible: 'TRF', tempEau: 6 }),
      { especes, typesLeurres: types, animations: animationsReelles as unknown as Animation[] },
      POIDS,
    );
    expect(conseils.length).toBeGreaterThan(0);
    for (const c of conseils) {
      expect(c.especeCode).toBe('TRF');
      expect(ajoutes).toContain(c.typeId);
    }
    expect(conseils[0].pourquoi.join(' ').toLowerCase()).toContain('truite fario');
  });

  it('critère 7 : given des conditions sans espèce cible, when le moteur calcule le conseil, then les conseils sont des couples compatibles avec au moins une espèce du contenu', () => {
    const types = [
      type('shad', ['SAN'], ['rapide-a', 'lente-a']),
      type('cuiller', ['BRO'], ['lente-b']),
      type('fantome', ['XXX'], ['moyenne-a']),
    ];
    const conseils = recommander(conditions({ especeCible: undefined }), contenu(types), POIDS);
    expect(conseils.length).toBeGreaterThan(0);
    const codes = ESPECES.map((e) => e.code);
    for (const c of conseils) {
      const t = types.find((x) => x.id === c.typeId)!;
      expect(t.techniques).toContain(c.techniqueId);
      expect(codes).toContain(c.especeCode);
      expect(t.especes).toContain(c.especeCode);
    }
    expect(conseils.map((c) => c.typeId)).not.toContain('fantome');
  });
});
