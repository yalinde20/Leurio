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
const SEPTEMBRE = 8;
const SAMEDI = 6;
const DIMANCHE = 0;

/** Date du n-ième jour de la semaine (`jourSemaine`, 0 = dimanche) d'un mois, à minuit local. */
function ennieme(annee: number, mois: number, jourSemaine: number, n: number): Date {
  const premier = new Date(annee, mois, 1);
  const decalage = (jourSemaine - premier.getDay() + 7) % 7;
  return new Date(annee, mois, 1 + decalage + (n - 1) * 7);
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
