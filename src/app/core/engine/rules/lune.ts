import { Regle } from './regle';

/**
 * Règle de lune (PLAN §8.3) : un bonus, jamais une pénalité. Si la phase est dans `phasesLuneBonus` (le contenu),
 * les animations moyennes et rapides ont 0,25 point ; sinon la règle se tait, donc aucun score ne baisse.
 * Avec le poids par défaut, la lune pèse au plus 0,5 × 0,25 = 0,125, bien moins que le plus petit écart que la
 * température peut créer entre deux couples (3 × 0,5 = 1,5) : quand les deux se contredisent, la température gagne.
 */
export const regleLune: Regle = ({ conditions, animation, poids }) => {
  const { phaseLune } = conditions;
  if (phaseLune === undefined || phaseLune === null || poids === undefined) return null;
  if (!poids.phasesLuneBonus.includes(phaseLune)) return null;
  if (animation.rythme === 'lent') return null;
  return {
    facteur: 'lune',
    points: 0.25,
    phrase: `${phaseLune} : le poisson est souvent plus actif, une animation vive peut payer.`,
  };
};
