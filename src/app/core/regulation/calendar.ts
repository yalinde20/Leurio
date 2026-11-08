/** Catégorie piscicole d'un cours d'eau ou d'un plan d'eau : 1re (salmonidés) ou 2e (cyprinidés). */
export type Categorie = 1 | 2;

/** État général d'ouverture de la pêche à une date. */
export type EtatOuverture = 'ouvert' | 'ferme';

/** Période d'ouverture : `debut` et `fin` sont des jours locaux, tous deux inclus. */
export interface PeriodeOuverture {
  debut: Date;
  fin: Date;
}

const MARS = 2;
const JANVIER = 0;
const AVRIL = 3;
const SEPTEMBRE = 8;
const LUNDI = 1;
const SAMEDI = 6;
const DIMANCHE = 0;

/** Date du n-ième jour de la semaine (`jourSemaine`, 0 = dimanche) d'un mois, à minuit local. */
function ennieme(annee: number, mois: number, jourSemaine: number, n: number): Date {
  const premier = new Date(annee, mois, 1);
  const decalage = (jourSemaine - premier.getDay() + 7) % 7;
  return new Date(annee, mois, 1 + decalage + (n - 1) * 7);
}

/** Date du dernier jour de la semaine (`jourSemaine`, 0 = dimanche) d'un mois, à minuit local. */
function dernier(annee: number, mois: number, jourSemaine: number): Date {
  const dernierJour = new Date(annee, mois + 1, 0);
  const decalage = (dernierJour.getDay() - jourSemaine + 7) % 7;
  return new Date(annee, mois, dernierJour.getDate() - decalage);
}

/** Période d'ouverture de la 1re catégorie : du 2e samedi de mars au 3e dimanche de septembre inclus (PLAN §6). */
export function periodeOuverture1reCategorie(annee: number): PeriodeOuverture {
  return {
    debut: ennieme(annee, MARS, SAMEDI, 2),
    fin: ennieme(annee, SEPTEMBRE, DIMANCHE, 3),
  };
}

/**
 * État général d'ouverture à une date, comparé par jour local (la journée entière compte).
 * La 2e catégorie est toujours « ouvert » : les fermetures par espèce (brochet…) sont traitées à part (PLAN §6).
 */
export function etatOuverture(categorie: Categorie, date: Date): EtatOuverture {
  if (categorie === 2) return 'ouvert';
  const { debut, fin } = periodeOuverture1reCategorie(date.getFullYear());
  const jour = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return jour >= debut && jour <= fin ? 'ouvert' : 'ferme';
}

/** Période de fermeture : `debut` et `fin` sont des jours locaux, tous deux inclus. */
export interface PeriodeFermeture {
  debut: Date;
  fin: Date;
}

/** État du brochet : `non-applicable` quand la règle de fermeture ne concerne pas la catégorie. */
export type EtatBrochet = 'ouvert' | 'ferme' | 'non-applicable';

/** Période de fermeture du brochet en 2e catégorie : du dernier lundi de janvier au vendredi avant le dernier samedi d'avril, inclus (PLAN §6). */
export function periodeFermetureBrochet(annee: number): PeriodeFermeture {
  const dernierSamediAvril = dernier(annee, AVRIL, SAMEDI);
  return {
    debut: dernier(annee, JANVIER, LUNDI),
    fin: new Date(annee, AVRIL, dernierSamediAvril.getDate() - 1),
  };
}

/**
 * État du brochet à une date, comparé par jour local (la journée entière compte).
 * La fermeture ne vaut qu'en 2e catégorie ; en 1re catégorie la règle ne s'applique pas.
 * Catégorie inconnue (`null`) : l'état est donné pour chacune des deux catégories (PLAN §6).
 */
export function etatBrochet(categorie: Categorie, date: Date): EtatBrochet;
export function etatBrochet(categorie: null, date: Date): { 1: EtatBrochet; 2: EtatBrochet };
export function etatBrochet(
  categorie: Categorie | null,
  date: Date,
): EtatBrochet | { 1: EtatBrochet; 2: EtatBrochet };
export function etatBrochet(categorie: Categorie | null, date: Date): EtatBrochet | { 1: EtatBrochet; 2: EtatBrochet } {
  if (categorie === null) {
    return { 1: etatBrochet(1, date), 2: etatBrochet(2, date) };
  }
  if (categorie === 1) return 'non-applicable';
  const { debut, fin } = periodeFermetureBrochet(date.getFullYear());
  const jour = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return jour >= debut && jour <= fin ? 'ferme' : 'ouvert';
}
