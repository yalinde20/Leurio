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
import { libelleQuota, libelleTailleMinimale, quota } from '../../core/regulation/sizes';

/**
 * Une ligne du bandeau. `ferme` peint la valeur en rouge. Une alerte (« Sandre probablement fermé, vérifie »,
 * « Brochet fermé en 2e catégorie ») est une ligne `alerte` sans libellé.
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
  return q ? libelleQuota(q) : '';
}

type EspeceReglementee = Pick<Espece, 'nom' | 'tailleMinCm' | 'fermetureAvecBrochet' | 'verifDepartementPrintemps'> &
  Partial<Pick<Espece, 'fermetureNationale2e'>>;

/** « Sandre probablement fermé, vérifie » ou « Black-bass : vérifie ton département » ; `null` sans avertissement. */
function alerteEspece(espece: EspeceReglementee, date: Date): LigneReglementation | null {
  const avertissement = avertissementEspece(espece, date);
  // Une espèce dont la fermeture est la règle nationale de 2e catégorie est déjà couverte par la ligne de fermeture.
  if (!avertissement || (espece.fermetureNationale2e && avertissement === 'probablement-ferme')) return null;
  const separateur = avertissement === 'probablement-ferme' ? ' ' : ' : ';
  return {
    libelle: '',
    valeur: `${espece.nom}${separateur}${LIBELLES_AVERTISSEMENT[avertissement]}`,
    ferme: true,
    alerte: true,
  };
}

/**
 * Lignes du bandeau « Réglementation » pour une catégorie, une espèce visée et une date.
 * Catégorie inconnue (`null`, position GPS) : les règles de la 2e catégorie s'appliquent.
 * Espèce `null` (« Toutes les espèces ») : les alertes de chaque espèce de `especes` (lues dans le contenu).
 */
export function composerReglementation(
  categorie: Categorie | null,
  espece: EspeceReglementee | null,
  date: Date,
  especes: readonly EspeceReglementee[] = [],
): LigneReglementation[] {
  const lignes: LigneReglementation[] = [];
  if (categorie === null) {
    if (etatBrochet(2, date) === 'ferme') {
      lignes.push({ libelle: '', valeur: 'Brochet fermé en 2e catégorie', ferme: true, alerte: true });
    } else {
      lignes.push({ libelle: '2e catégorie', valeur: 'Ouvert', ferme: false });
    }
  } else {
    lignes.push({ libelle: 'Pêche', ...(categorie === 1 ? etat1re(date) : etat2e(date)) });
  }
  const alertes = (espece ? [espece] : especes).map((e) => alerteEspece(e, date));
  for (const alerte of alertes) if (alerte) lignes.push(alerte);
  if (espece) {
    lignes.push({ libelle: 'Taille minimale', valeur: libelleTailleMinimale(espece), ferme: false });
  }
  if (categorie !== 1) {
    lignes.push({ libelle: 'Quota', valeur: libelleQuota2e(), ferme: false });
  }
  return lignes;
}
