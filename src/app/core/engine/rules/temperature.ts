import { Animation, Espece } from '../../data/catalog.types';
import { formaterTemperature } from '../../../shared/unites';
import { Regle } from './regle';

export type Bande = 'active' | 'ralentie' | 'quasiNulle';
type Rythme = Animation['rythme'];

/** Ordre de recherche ; les plages sont [min, max[, sauf le haut de la plage active, inclus. */
const BANDES: Bande[] = ['quasiNulle', 'ralentie', 'active'];

const POINTS: Record<Bande, Record<Rythme, number>> = {
  active: { rapide: 1, moyen: 1, lent: 0.5 },
  ralentie: { lent: 1, moyen: 0.5, rapide: 0 },
  quasiNulle: { lent: 1, moyen: 0.5, rapide: 0 },
};

export function bandeDe(espece: Espece, temperature: number): Bande | null {
  return (
    BANDES.find((bande) => {
      const [min, max] = espece.tempEauC[bande];
      return (
        temperature >= min && (temperature < max || (bande === 'active' && temperature === max))
      );
    }) ?? null
  );
}

const ACTIVITE: Record<Bande, string> = {
  active: 'pleine',
  ralentie: 'ralentie',
  quasiNulle: 'quasi nulle',
};

function conseilRythme(bande: Bande, rythme: Rythme): string {
  if (bande === 'active') {
    return rythme === 'lent'
      ? 'une animation lente passe, mais il accepte aussi plus de vitesse'
      : `une animation ${rythme === 'rapide' ? 'rapide' : 'moyenne'} lui convient`;
  }
  if (rythme === 'lent') return 'une animation lente lui convient';
  if (rythme === 'moyen') return 'une animation moyenne passe, une plus lente est meilleure';
  return 'une animation rapide risque de le laisser indifférent';
}

/** Règle de la température de l'eau (PLAN §8.3) : l'animation doit suivre l'activité de l'espèce dans la plage où se trouve l'eau. */
export const regleTemperature: Regle = ({ conditions, espece, animation }) => {
  if (conditions.tempEau === null) return null;
  const bande = bandeDe(espece, conditions.tempEau);
  if (bande === null) return null;
  const degres = formaterTemperature(conditions.tempEau, conditions.unites ?? 'metriques').replace(/\s/g, ' ');
  return {
    facteur: 'temperature',
    points: POINTS[bande][animation.rythme],
    phrase: `À ${degres}, l'activité du poisson (${espece.nom.toLowerCase()}) est ${ACTIVITE[bande]} : ${conseilRythme(bande, animation.rythme)}.`,
  };
};
