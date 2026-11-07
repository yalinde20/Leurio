import { Couleur } from '../../data/catalog.types';
import { Regle } from './regle';

/**
 * Couleur par défaut (PLAN §8.3) : la première couleur naturelle du contenu, sinon la première couleur.
 * Rend une chaîne vide si le contenu n'a aucune couleur.
 */
export function couleurParDefaut(couleurs: Couleur[]): string {
  return (couleurs.find((c) => c.classe === 'naturelle') ?? couleurs[0])?.id ?? '';
}

/**
 * Règle de clarté de l'eau (PLAN §8.3) : la crue trouble l'eau (couleur vive), l'étiage la clarifie (couleur naturelle).
 * Elle ne se déclenche qu'en crue ou en étiage ; elle choisit la première couleur de la classe dans l'ordre du contenu,
 * ou, à défaut de couleur de cette classe, la couleur par défaut.
 * La couleur est la même pour tous les couples : la règle donne donc 0 point, pour ne pas changer leur classement
 * (le poids `clarte` reste appliqué, mais à zéro).
 */
export const regleCouleur: Regle = ({ conditions, couleurs }) => {
  const trouble = conditions.debitTendance === 'crue';
  if (!trouble && conditions.debitTendance !== 'étiage') return null;
  const classe = trouble ? 'vive' : 'naturelle';
  const choisie = couleurs.find((c) => c.classe === classe) ?? couleurs.find((c) => c.id === couleurParDefaut(couleurs));
  if (choisie === undefined) return null;
  const phrase = trouble
    ? `Avec l'eau trouble (crue), prends une couleur vive, comme ${choisie.nom.toLowerCase()}, pour qu'il voie ton leurre.`
    : `Avec l'eau claire (étiage), prends une couleur naturelle, comme ${choisie.nom.toLowerCase()}, pour ne pas l'effrayer.`;
  return { facteur: 'clarte', points: 0, phrase, couleur: choisie.id };
};
