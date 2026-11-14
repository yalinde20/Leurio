/**
 * Unités d'affichage (US 93, PLAN §3) : TypeScript pur, sans Angular, pour que le moteur et la réglementation puissent s'en servir.
 * Seul l'affichage change : les données (°C, cm, g) et les saisies restent métriques. Format français : virgule, zéros inutiles retirés.
 */
export type Unites = 'metriques' | 'imperiales';

export type Grandeur = 'longueur' | 'poids';

const INSECABLE = String.fromCharCode(0xa0);
const CM_PAR_POUCE = 2.54;
const G_PAR_ONCE = 28.3495;

const format = (decimales: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales, useGrouping: false });
const UN_CHIFFRE = format(1);
const DEUX_CHIFFRES = format(2);

const avecUnite = (nombre: string, unite: string): string => `${nombre}${INSECABLE}${unite}`;

/** « 11,5 °C » ou « 52,7 °F » (°F = °C × 9/5 + 32). */
export function formaterTemperature(celsius: number, unites: Unites): string {
  return unites === 'imperiales' ? avecUnite(UN_CHIFFRE.format((celsius * 9) / 5 + 32), '°F') : avecUnite(UN_CHIFFRE.format(celsius), '°C');
}

/** Le nombre seul, converti et arrondi selon le système. */
function nombreDe(valeur: number, grandeur: Grandeur, unites: Unites): string {
  if (unites === 'metriques') return DEUX_CHIFFRES.format(valeur);
  return grandeur === 'longueur' ? UN_CHIFFRE.format(valeur / CM_PAR_POUCE) : DEUX_CHIFFRES.format(valeur / G_PAR_ONCE);
}

function uniteDe(grandeur: Grandeur, unites: Unites): string {
  if (grandeur === 'longueur') return unites === 'imperiales' ? 'po' : 'cm';
  return unites === 'imperiales' ? 'oz' : 'g';
}

/** « 8 cm » ou « 3,1 po ». */
export function formaterLongueur(cm: number, unites: Unites): string {
  return avecUnite(nombreDe(cm, 'longueur', unites), uniteDe('longueur', unites));
}

/** « 10 g » ou « 0,35 oz ». */
export function formaterPoids(g: number, unites: Unites): string {
  return avecUnite(nombreDe(g, 'poids', unites), uniteDe('poids', unites));
}

/** « 5 à 10 g » ou « 0,18 à 0,35 oz » : les deux bornes sont converties, l'unité n'est écrite qu'une fois. */
export function formaterPlage(min: number, max: number, grandeur: Grandeur, unites: Unites, separateur = ' à '): string {
  return `${nombreDe(min, grandeur, unites)}${separateur}${avecUnite(nombreDe(max, grandeur, unites), uniteDe(grandeur, unites))}`;
}
