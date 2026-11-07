import { Regle } from './regle';

const ECART = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/**
 * Règle de pression (PLAN §8.3) : un indice, pas une certitude. Elle ne se déclenche que si l'écart sur 48 h dépasse
 * `seuilPression` (en valeur absolue) ; sinon, ou si la pression est inconnue, elle se tait.
 * Baisse : les animations moyennes et rapides ont 0,4 point (le poisson est souvent plus actif avant une perturbation).
 * Hausse : seules les animations lentes ont 0,4 point (le poisson est plus méfiant). La phrase est écrite même à 0 point.
 * Avec le poids par défaut, la pression pèse au plus 1 × 0,4 = 0,4, moins que le plus petit écart que la température
 * peut créer entre deux couples (3 × 0,5 = 1,5) : quand les deux se contredisent, la température gagne.
 */
export const reglePression: Regle = ({ conditions, animation, poids }) => {
  const ecart = conditions.pressionTendance48h;
  if (ecart === null || poids === undefined || Math.abs(ecart) <= poids.seuilPression) return null;
  const baisse = ecart < 0;
  const hpa = `${baisse ? '−' : '+'}${ECART.format(Math.abs(ecart))} hPa`.replace(/\s/g, ' ');
  const favorable = baisse ? animation.rythme !== 'lent' : animation.rythme === 'lent';
  return {
    facteur: 'pression',
    points: favorable ? 0.4 : 0,
    phrase: baisse
      ? `Indice : la pression baisse (${hpa} en 48 h), le poisson est souvent plus actif avant une perturbation.`
      : `Indice : la pression monte (${hpa} en 48 h), le poisson est souvent plus méfiant.`,
  };
};
