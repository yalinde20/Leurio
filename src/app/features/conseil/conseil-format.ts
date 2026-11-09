import { TEMP_SAISIE_MAX_C, TEMP_SAISIE_MIN_C } from '../../core/engine/temperature-eau';
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

/** Lit une température saisie (virgule ou point) ; `null` si vide, non numérique ou hors de 0 à 35 °C. */
export function lireTempSaisie(texte: string): number | null {
  const propre = texte.trim();
  if (!/^[+-]?\d+([.,]\d+)?$/.test(propre)) return null;
  const valeur = Number(propre.replace(',', '.')) + 0; // + 0 : jamais de −0
  return valeur >= TEMP_SAISIE_MIN_C && valeur <= TEMP_SAISIE_MAX_C ? valeur : null;
}
