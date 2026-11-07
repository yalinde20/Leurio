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
 * Elle ne se déclenche qu'en crue ou en étiage, et choisit la première couleur de la classe dans l'ordre du contenu.
 * Sans couleur de cette classe, elle n'est pas déclenchée : la phrase ne dirait pas la vérité ; le conseil garde la couleur par défaut.
 * La couleur est la même pour tous les couples : la règle donne donc 0 point, pour ne pas changer leur classement
 * (le poids `clarte` reste appliqué, mais à zéro).
 */
export const regleCouleur: Regle = ({ conditions, couleurs }) => {
  const trouble = conditions.debitTendance === 'crue';
  if (!trouble && conditions.debitTendance !== 'étiage') return null;
  const choisie = couleurs.find((c) => c.classe === (trouble ? 'vive' : 'naturelle'));
  if (choisie === undefined) return null;
  const nom = choisie.nom.toLowerCase();
  const phrase = trouble
    ? `En eau trouble (crue), prends une couleur vive, comme ${nom} : le poisson verra mieux ton leurre.`
    : `En eau claire (étiage), prends une couleur naturelle, comme ${nom}, pour ne pas effrayer le poisson.`;
  return { facteur: 'clarte', points: 0, phrase, couleur: choisie.id };
};
