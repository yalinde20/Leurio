import { TailleLeurre } from '../../core/engine/rules/regle';

const INSECABLE = String.fromCharCode(0xa0);
const nombre = new Intl.NumberFormat('fr-FR');

/** Première phrase d'un pourquoi du moteur ; le texte entier s'il n'y a qu'une phrase. */
export function premierePhrase(texte: string): string {
  const fin = texte.search(/[.!?…](\s|$)/);
  return fin === -1 ? texte : texte.slice(0, fin + 1);
}

/** « Taille » pour une longueur en cm, « Poids » pour un poids en g. */
export function libelleTaille(taille: TailleLeurre): string {
  return taille.unite === 'cm' ? 'Taille' : 'Poids';
}

/** Le texte d'une taille ou d'un poids avec une espace insécable avant l'unité (8 cm, 10 g). */
export function formaterTaille(taille: TailleLeurre): string {
  return `${nombre.format(taille.valeur)}${INSECABLE}${taille.unite}`;
}
