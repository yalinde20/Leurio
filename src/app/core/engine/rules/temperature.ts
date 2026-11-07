import { Animation, Espece } from '../../data/catalog.types';
import { Regle } from './regle';

type Bande = 'active' | 'ralentie' | 'quasiNulle';
type Rythme = Animation['rythme'];

/** Ordre de recherche ; les plages sont [min, max[, sauf le haut de la plage active, inclus. */
const BANDES: Bande[] = ['quasiNulle', 'ralentie', 'active'];

const POINTS: Record<Bande, Record<Rythme, number>> = {
  active: { rapide: 1, moyen: 1, lent: 0.5 },
  ralentie: { lent: 1, moyen: 0.5, rapide: 0 },
  quasiNulle: { lent: 1, moyen: 0.5, rapide: 0 },
};

const TEMPERATURE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function bandeDe(espece: Espece, temperature: number): Bande | null {
  return (
    BANDES.find((bande) => {
      const [min, max] = espece.tempEauC[bande];
      return (
        temperature >= min && (temperature < max || (bande === 'active' && temperature === max))
      );
    }) ?? null
  );
}

function etat(bande: Bande, nom: string): string {
  if (bande === 'active') return `${nom} est actif`;
  return bande === 'ralentie' ? `${nom} est ralenti` : `${nom} est quasi inactif`;
}

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
  const nom = `le ${espece.nom.toLowerCase()}`;
  const degres = `${TEMPERATURE.format(conditions.tempEau)} °C`.replace(/\s/g, ' ');
  const sujet = etat(bande, nom);
  return {
    facteur: 'temperature',
    points: POINTS[bande][animation.rythme],
    phrase: `L'eau est à ${degres} : ${sujet}, ${conseilRythme(bande, animation.rythme)}.`,
  };
};
