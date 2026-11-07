import { Animation, Espece, TypeLeurre } from '../data/catalog.types';
import { Conditions } from './conditions';
import { REGLES } from './rules';
import { PoidsMoteur } from './rules/regle';

export type { PoidsMoteur } from './rules/regle';

/** Le contenu lu par le moteur (PLAN §7). */
export interface ContenuMoteur {
  especes: Espece[];
  typesLeurres: TypeLeurre[];
  animations: Animation[];
}

/** Un couple « type de leurre + animation » conseillé, avec son pourquoi (PLAN §8.4). */
export interface Conseil {
  typeId: string;
  techniqueId: string;
  especeCode: string;
  score: number;
  pourquoi: string[];
}

const NOMBRE_DE_CONSEILS = 3;

function evaluer(
  conditions: Conditions,
  espece: Espece,
  type: TypeLeurre,
  animation: Animation,
  poids: PoidsMoteur,
): Conseil {
  let score = 0;
  const pourquoi: string[] = [];
  for (const regle of REGLES) {
    const resultat = regle({ conditions, espece, type, animation, poids });
    if (resultat === null) continue;
    score += (poids[resultat.facteur] ?? 0) * resultat.points;
    pourquoi.push(resultat.phrase);
  }
  return { typeId: type.id, techniqueId: animation.id, especeCode: espece.code, score, pourquoi };
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
        const conseil = evaluer(conditions, espece, type, animation, poids);
        if (meilleur === null || conseil.score > meilleur.score) meilleur = conseil;
      }
      if (meilleur !== null) conseils.push(meilleur);
    }
  }
  // Array.prototype.sort est stable : les égalités gardent l'ordre du contenu.
  return conseils.sort((a, b) => b.score - a.score).slice(0, NOMBRE_DE_CONSEILS);
}
