import { Saison } from '../conditions';
import { Regle } from './regle';

const DEBUT: Record<Saison, string> = {
  hiver: 'En hiver',
  printemps: 'Au printemps',
  été: 'En été',
  automne: 'En automne',
};

/**
 * Règle de saison (PLAN §8.3) : un type de leurre ou une animation dont le contenu liste la saison en cours est favorisé.
 * Elle donne 0,5 point : avec les poids par défaut, la saison pèse au plus 2 × 0,5 = 1, moins que le plus petit écart
 * que la température peut créer entre deux couples (3 × 0,5 = 1,5). Quand les deux se contredisent, la température gagne.
 */
export const regleSaison: Regle = ({ conditions, type, animation }) => {
  const { saison } = conditions;
  const typeDeSaison = type.saisons?.includes(saison) === true;
  const animationDeSaison = animation.saisons?.includes(saison) === true;
  if (!typeDeSaison && !animationDeSaison) return null;
  const nomType = type.nom.toLowerCase();
  const nomAnimation = animation.nom.toLowerCase();
  let objet = `une animation de saison (${nomAnimation})`;
  if (typeDeSaison) {
    objet = animationDeSaison
      ? `un leurre et une animation de saison (${nomType}, ${nomAnimation})`
      : `un leurre de saison (${nomType})`;
  }
  return { facteur: 'saison', points: 0.5, phrase: `${DEBUT[saison]}, c'est ${objet}.` };
};
