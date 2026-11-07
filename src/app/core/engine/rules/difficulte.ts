import { Conditions } from '../conditions';
import { Regle } from './regle';

/** Difficulté maximale que le niveau sait jouer, choix de l'US 72 (le plan ne la fixe pas) : débutant 1, intermédiaire 2. */
const DIFFICULTE_MAX: Record<Conditions['niveau'], number> = { debutant: 1, intermediaire: 2 };

/**
 * Règle de difficulté (PLAN §8.3) : une animation plus difficile que le niveau du pêcheur est pénalisée,
 * d'autant plus qu'elle est difficile (points = difficulté - niveau, multipliés par le poids négatif `penaliteDifficulte`).
 */
export const regleDifficulte: Regle = ({ conditions, animation }) => {
  const niveau = DIFFICULTE_MAX[conditions.niveau];
  if (animation.difficulte <= niveau) return null;
  return {
    facteur: 'penaliteDifficulte',
    points: animation.difficulte - niveau,
    phrase: 'Animation exigeante pour ton niveau.',
  };
};
