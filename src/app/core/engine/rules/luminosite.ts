import { Regle } from './regle';

/**
 * Règle de luminosité (PLAN §8.3) : à l'aube, au crépuscule ou par ciel couvert (nuages au moins égaux à
 * `seuilCielCouvert`), un type de leurre dont le contenu est adapté à la faible lumière est favorisé.
 * Elle donne 0,4 point : avec les poids par défaut, luminosité (1 × 0,4) + saison (au plus 1) = 1,4, moins que le plus
 * petit écart que la température peut créer entre deux couples (1,5). Quand elles se contredisent, la température gagne.
 */
export const regleLuminosite: Regle = ({ conditions, type, poids }) => {
  const { moment, nuages } = conditions;
  if (moment === 'nuit') return null; // La nuit n'est pas traitée ici.
  const momentFaible = moment === 'aube' || moment === 'crépuscule';
  const cielCouvert = nuages !== null && poids !== undefined && nuages >= poids.seuilCielCouvert;
  if (type.faibleLumiere !== true || (!momentFaible && !cielCouvert)) return null;
  const nomType = type.nom.toLowerCase();
  const cause = momentFaible ? `À ${moment === 'aube' ? "l'aube" : 'la tombée du jour'}` : 'Par ciel couvert';
  return {
    facteur: 'luminosite',
    points: 0.4,
    phrase: `${cause}, la lumière est faible : c'est le moment d'un leurre adapté (${nomType}).`,
  };
};
