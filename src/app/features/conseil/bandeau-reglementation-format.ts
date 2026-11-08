import type { Espece } from '../../core/data/catalog.types';
import {
  avertissementEspece,
  Categorie,
  etatBrochet,
  etatOuverture,
  LIBELLES_AVERTISSEMENT,
  periodeFermetureBrochet,
  prochaineOuverture1reCategorie,
} from '../../core/regulation/calendar';
import { libelleTailleMinimale, quota } from '../../core/regulation/sizes';

/**
 * Une ligne du bandeau. `ferme` peint la valeur en rouge. Un avertissement d'espèce
 * (« Sandre : probablement fermé, vérifie ») est une ligne `alerte` sans libellé.
 */
export interface LigneReglementation {
  libelle: string;
  valeur: string;
  ferme: boolean;
  alerte?: boolean;
}

/** « 14/03 » (jour et mois, heure locale). */
export function formaterJourMois(date: Date): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${deux(date.getDate())}/${deux(date.getMonth() + 1)}`;
}

function etat1re(date: Date): Pick<LigneReglementation, 'valeur' | 'ferme'> {
  return etatOuverture(1, date) === 'ferme'
    ? { valeur: `Fermé jusqu'au ${formaterJourMois(prochaineOuverture1reCategorie(date))}`, ferme: true }
    : { valeur: 'Ouvert', ferme: false };
}

function etat2e(date: Date): Pick<LigneReglementation, 'valeur' | 'ferme'> {
  return etatBrochet(2, date) === 'ferme'
    ? {
        valeur: `Brochet fermé jusqu'au ${formaterJourMois(periodeFermetureBrochet(date.getFullYear()).fin)}`,
        ferme: true,
      }
    : { valeur: 'Ouvert', ferme: false };
}

/** Quota de la 2e catégorie, construit à partir des nombres de `quota(2)`. */
function libelleQuota2e(): string {
  const q = quota(2);
  return q ? `${q.carnassiersParJour} carnassiers par jour, dont ${q.brochetsParJour} brochets maximum` : '';
}

/** Lignes du bandeau « Réglementation » pour une catégorie (ou inconnue), une espèce visée (ou toutes) et une date. */
export function composerReglementation(
  categorie: Categorie | null,
  espece: Pick<Espece, 'nom' | 'tailleMinCm' | 'fermetureAvecBrochet' | 'verifDepartementPrintemps'> | null,
  date: Date,
): LigneReglementation[] {
  const lignes: LigneReglementation[] = [];
  if (categorie === null) {
    lignes.push({ libelle: '1re catégorie', ...etat1re(date) }, { libelle: '2e catégorie', ...etat2e(date) });
  } else {
    lignes.push({ libelle: 'Pêche', ...(categorie === 1 ? etat1re(date) : etat2e(date)) });
  }
  if (espece) {
    const avertissement = avertissementEspece(espece, date);
    if (avertissement) {
      lignes.push({
        libelle: '',
        valeur: `${espece.nom} : ${LIBELLES_AVERTISSEMENT[avertissement]}`,
        ferme: true,
        alerte: true,
      });
    }
    lignes.push({ libelle: 'Taille minimale', valeur: libelleTailleMinimale(espece), ferme: false });
  }
  if (categorie !== 1) {
    lignes.push({
      libelle: categorie === null ? 'Quota en 2e catégorie' : 'Quota',
      valeur: libelleQuota2e(),
      ferme: false,
    });
  }
  return lignes;
}
