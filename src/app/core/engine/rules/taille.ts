import { TypeLeurre } from '../../data/catalog.types';
import { formaterLongueur, formaterPoids } from '../../../shared/unites';
import { Regle, TailleLeurre } from './regle';
import { bandeDe } from './temperature';

/** Gamme du type : sa taille en cm, sinon son poids en g ; null sans gamme dans le contenu. */
export function gammeDe(type: TypeLeurre): { min: number; max: number; unite: TailleLeurre['unite'] } | null {
  if (type.tailleCm) return { min: type.tailleCm[0], max: type.tailleCm[1], unite: 'cm' };
  if (type.poidsG) return { min: type.poidsG[0], max: type.poidsG[1], unite: 'g' };
  return null;
}

/** Taille par défaut, choix de l'US 71 (le plan ne la fixe pas) : le milieu de la gamme, null si le type n'en a pas. */
export function tailleParDefaut(type: TypeLeurre): TailleLeurre | null {
  const gamme = gammeDe(type);
  return gamme === null ? null : { valeur: (gamme.min + gamme.max) / 2, unite: gamme.unite };
}

const arrondiAuDemi = (n: number): number => Math.round(n * 2) / 2;
const borner = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

/**
 * Règle de la taille (PLAN §2.1, §8.3) : eau froide (plage ralentie ou quasi nulle), la moitié basse de la gamme ;
 * poisson actif, la moitié haute. Hors de ces plages, ou sans température, le conseil garde le milieu de la gamme.
 * Elle donne 0 point : tous les couples d'un même type ont la même gamme, le classement ne change pas.
 */
export const regleTaille: Regle = ({ conditions, espece, type }) => {
  const gamme = gammeDe(type);
  if (gamme === null || conditions.tempEau === null) return null;
  const bande = bandeDe(espece, conditions.tempEau);
  if (bande === null) return null;
  const { min, max, unite } = gamme;
  const milieu = (min + max) / 2;
  const froide = bande !== 'active';
  const valeur = froide
    ? borner(arrondiAuDemi(min + (max - min) / 4), min, milieu)
    : borner(arrondiAuDemi(min + (3 * (max - min)) / 4), milieu, max);
  const unites = conditions.unites ?? 'metriques';
  const chiffre = (unite === 'cm' ? formaterLongueur(valeur, unites) : formaterPoids(valeur, unites)).replace(/\s/g, '\u00a0');
  const phrase = froide
    ? `Par eau froide, prends un modèle plutôt ${unite === 'cm' ? 'petit' : 'léger'}, autour de ${chiffre}.`
    : `Le poisson est actif : un modèle plus ${unite === 'cm' ? 'gros' : 'lourd'}, autour de ${chiffre}, attire mieux.`;
  return { facteur: 'temperature', points: 0, phrase, taille: { valeur, unite } };
};
