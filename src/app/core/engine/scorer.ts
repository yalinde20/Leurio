import { Animation, Couleur, Espece, TypeLeurre } from '../data/catalog.types';
import { Conditions } from './conditions';
import { REGLES } from './rules';
import { couleurParDefaut } from './rules/couleur';
import { PoidsMoteur } from './rules/regle';

export type { PoidsMoteur } from './rules/regle';

/** Le contenu lu par le moteur (PLAN §7). */
export interface ContenuMoteur {
  especes: Espece[];
  typesLeurres: TypeLeurre[];
  animations: Animation[];
  couleurs: Couleur[];
}

/** Un couple « type de leurre + animation » conseillé, avec son pourquoi (PLAN §8.4). */
export interface Conseil {
  typeId: string;
  techniqueId: string;
  especeCode: string;
  score: number;
  pourquoi: string[];
  /** Identifiant de la couleur de leurre conseillée (vide si le contenu n'a aucune couleur). */
  couleur: string;
}

const NOMBRE_DE_CONSEILS = 3;

function evaluer(
  conditions: Conditions,
  espece: Espece,
  type: TypeLeurre,
  animation: Animation,
  couleurs: Couleur[],
  poids: PoidsMoteur,
): Conseil {
  let score = 0;
  let couleur = couleurParDefaut(couleurs);
  const pourquoi: string[] = [];
  for (const regle of REGLES) {
    const resultat = regle({ conditions, espece, type, animation, couleurs, poids });
    if (resultat === null) continue;
    score += (poids[resultat.facteur] ?? 0) * resultat.points;
    pourquoi.push(resultat.phrase);
    if (resultat.couleur !== undefined) couleur = resultat.couleur;
  }
  return { typeId: type.id, techniqueId: animation.id, especeCode: espece.code, score, pourquoi, couleur };
}

/**
 * Les trois meilleurs couples (type de leurre, animation) pour les conditions, du meilleur au moins bon.
 * À score égal, l'ordre du contenu décide. Sans espèce cible, chaque couple compte pour son espèce la mieux notée.
 */
export function recommander(
  conditions: Conditions,
  contenu: ContenuMoteur,
  poids: PoidsMoteur,
): Conseil[] {
  const animations = new Map(contenu.animations.map((a) => [a.id, a]));
  const especes =
    conditions.especeCible === undefined
      ? contenu.especes
      : contenu.especes.filter((e) => e.code === conditions.especeCible);

  const conseils: Conseil[] = [];
  for (const type of contenu.typesLeurres) {
    for (const id of type.techniques ?? []) {
      const animation = animations.get(id);
      if (animation === undefined) continue;
      let meilleur: Conseil | null = null;
      for (const espece of especes) {
        if (!type.especes.includes(espece.code)) continue;
        const conseil = evaluer(conditions, espece, type, animation, contenu.couleurs, poids);
        if (meilleur === null || conseil.score > meilleur.score) meilleur = conseil;
      }
      if (meilleur !== null) conseils.push(meilleur);
    }
  }
  // Array.prototype.sort est stable : les égalités gardent l'ordre du contenu.
  return conseils.sort((a, b) => b.score - a.score).slice(0, NOMBRE_DE_CONSEILS);
}
