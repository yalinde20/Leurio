import type { Espece } from '../data/catalog.types';
import { formaterLongueur, type Unites } from '../../shared/unites';
import type { Categorie } from './calendar';

/** Libellé quand la fiche n'a pas de taille minimale nationale (`tailleMinCm` null, PLAN §6). */
const LIBELLE_SANS_TAILLE = 'pas de taille minimale nationale';

/** Taille minimale de capture, en cm, lue sur la fiche espèce (PLAN §6, §7) ; `null` si aucune taille nationale. */
export function tailleMinimale(espece: Pick<Espece, 'tailleMinCm'>): number | null {
  return espece.tailleMinCm ?? null;
}

/** Taille minimale prête à afficher : « 50 cm » (« 19,7 po » en impérial) ou « pas de taille minimale nationale ». */
export function libelleTailleMinimale(espece: Pick<Espece, 'tailleMinCm'>, unites: Unites = 'metriques'): string {
  const taille = tailleMinimale(espece);
  return taille === null ? LIBELLE_SANS_TAILLE : formaterLongueur(taille, unites).replace(/\s/g, ' ');
}

/** Quota de capture par pêcheur et par jour (PLAN §6). */
export interface Quota {
  carnassiersParJour: number;
  brochetsParJour: number;
}

/** Quota national de la 2e catégorie : 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum. */
const QUOTA_2E_CATEGORIE: Quota = { carnassiersParJour: 3, brochetsParJour: 2 };

/** Quota national d'une catégorie piscicole ; `null` en 1re catégorie, où l'app n'en annonce aucun. */
export function quota(categorie: Categorie): Quota | null {
  return categorie === 2 ? { ...QUOTA_2E_CATEGORIE } : null;
}

/** Quota prêt à afficher, construit à partir des nombres. */
export function libelleQuota(q: Quota): string {
  return `${q.carnassiersParJour} carnassiers par jour et par pêcheur, dont ${q.brochetsParJour} brochets au maximum`;
}
