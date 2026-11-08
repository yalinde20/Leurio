import { Conditions } from '../conditions';
import { Animation, Espece, TypeLeurre } from '../../data/catalog.types';
import { regleTemperature } from './temperature';
import { ContenuMoteur, PoidsMoteur, recommander } from '../scorer';
import poidsReels from '../../../../assets/data/engine-weights.json';
import especesReelles from '../../../../assets/data/species.json';
import typesReels from '../../../../assets/data/lure-types.json';
import animationsReelles from '../../../../assets/data/techniques.json';

const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };
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
const type: TypeLeurre = {
  id: 't',
  nom: 't',
  especes: ['SAN'],
  techniques: ['a'],
  zoneNage: 'fond',
  interditFermetureBrochet: false,
  ...FICHE,
};
const animation = (rythme: Animation['rythme']): Animation => ({
  id: 'a',
  nom: 'a',
  geste: 'g',
  vitesse: 'v',
  rythme,
  erreurAEviter: 'e',
  difficulte: 1,
  videos: [],
  ...FICHE,
});
const conditions = (tempEau: number | null): Conditions => ({
  tempEau,
  sourceTempEau: tempEau === null ? null : 'saisie',
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
});
const appliquer = (tempEau: number | null, rythme: Animation['rythme'] = 'lent') =>
  regleTemperature({
    conditions: conditions(tempEau),
    espece: sandre,
    type,
    animation: animation(rythme),
    couleurs: [],
  });

describe('regleTemperature', () => {
  it('given une température sur la borne basse d’une plage, when la règle s’applique, then la plage commence là', () => {
    expect(appliquer(6)?.phrase).toContain('est ralentie');
    expect(appliquer(0)?.phrase).toContain('est quasi nulle');
  });

  it('given la borne commune de deux plages, when la règle s’applique, then la plage du dessus l’emporte', () => {
    expect(appliquer(12, 'rapide')).toEqual({
      facteur: 'temperature',
      points: 1,
      phrase:
        "À 12 °C, l'activité du poisson (sandre) est pleine : une animation rapide lui convient.",
    });
  });

  it('given le haut de la plage active, when la règle s’applique, then il est inclus', () => {
    expect(appliquer(24)).not.toBeNull();
    expect(appliquer(24.1)).toBeNull();
  });

  it('given une eau hors de toute plage ou inconnue, when la règle s’applique, then elle n’est pas déclenchée', () => {
    expect(appliquer(-1)).toBeNull();
    expect(appliquer(30)).toBeNull();
    expect(appliquer(null)).toBeNull();
  });

  it('given une eau à 6,5 °C, when la règle s’applique, then la phrase écrit la température en français', () => {
    expect(appliquer(6.5)?.phrase).toContain('6,5 °C');
  });

  it('given une eau froide, when l’animation est rapide, then la phrase prévient qu’elle risque de laisser le sandre indifférent', () => {
    const r = appliquer(6, 'rapide');
    expect(r?.points).toBe(0);
    expect(r?.phrase).toBe(
      "À 6 °C, l'activité du poisson (sandre) est ralentie : une animation rapide risque de le laisser indifférent.",
    );
  });

  it('given une eau froide, when l’animation est lente, then elle a le maximum de points', () => {
    expect(appliquer(6, 'lent')?.points).toBe(1);
    expect(appliquer(6, 'moyen')?.points).toBe(0.5);
  });
});

describe('recommander avec le contenu réel', () => {
  const contenu: ContenuMoteur = {
    especes: especesReelles as Espece[],
    typesLeurres: typesReels as TypeLeurre[],
    animations: animationsReelles as unknown as Animation[],
    couleurs: [],
  };
  const poids: PoidsMoteur = poidsReels;

  it('given l’hiver, une eau à 6 °C et le sandre (PLAN §11), when le moteur calcule, then le premier conseil est une animation lente', () => {
    const [premier] = recommander({ ...conditions(6), especeCible: 'SAN' }, contenu, poids);
    expect(['tiree-relachee', 'verticale']).toContain(premier.techniqueId);
  });

  it('given une espèce cible absente du contenu, when le moteur calcule, then il ne rend aucun conseil', () => {
    expect(recommander({ ...conditions(6), especeCible: 'ZZZ' }, contenu, poids)).toEqual([]);
  });

  it.each([
    ['PER', 'perche'],
    ['ASP', 'aspe'],
  ])(
    'given %s, when le moteur explique, then la phrase n’exige aucun accord avec le nom (%s)',
    (code, nom) => {
      const [conseil] = recommander({ ...conditions(8), especeCible: code }, contenu, poids);
      const phrase = conseil.pourquoi.join(' ');
      expect(phrase).toContain(`(${nom})`);
      expect(phrase).not.toContain(`le ${nom}`);
    },
  );

  it('given aucune espèce cible et un couple partagé par deux espèces, when le moteur calcule, then il garde le meilleur score', () => {
    const autre: Espece = {
      ...sandre,
      code: 'BRO',
      nom: 'Brochet',
      tempEauC: { active: [2, 24], ralentie: [0, 2], quasiNulle: [0, 0] },
    };
    const partage: TypeLeurre = { ...type, especes: ['SAN', 'BRO'], techniques: ['a'] };
    const conseils = recommander(
      { ...conditions(6), especeCible: undefined },
      { especes: [sandre, autre], typesLeurres: [partage], animations: [animation('lent')], couleurs: [] },
      poids,
    );
    // Sandre : eau ralentie, lente = 1 point. Brochet : eau active, lente = 0,5 point.
    expect(conseils).toHaveLength(1);
    expect(conseils[0].especeCode).toBe('SAN');
    expect(conseils[0].score).toBe(poids.temperature);
  });
});
