import type { TypeLeurre } from '../data/catalog.types';
import type { Conseil } from './scorer';
import { gammeDe } from './rules/taille';

/** Ce que le matcher lit d'un leurre de la boîte (compatible avec `Leurre` du service, sans en dépendre). */
export interface LeurreDeBoite {
  id: string;
  typeId: string;
  tailleCm: number;
  poidsG: number;
  couleur: string;
  marque?: string;
}

/** Plage de taille du type conseillé, tirée du contenu (tailleCm, sinon poidsG). */
export interface PlageTaille {
  min: number;
  max: number;
  unite: 'cm' | 'g';
}

/**
 * Le leurre de la boîte pour un conseil : le même type, une substitution (même zone de nage) ou rien (PLAN §8.5).
 * `L` est le type des leurres reçus : le leurre rendu est celui de la boîte, avec tous ses champs (photo comprise).
 */
export type Correspondance<L extends LeurreDeBoite = LeurreDeBoite> =
  | { statut: 'dans-ta-boite'; typeId: string; leurre: L }
  | { statut: 'substitution'; typeId: string; leurre: L }
  | { statut: 'il-te-manque'; typeId: string; plage: PlageTaille | null; couleur: string };

type ConseilLu = Pick<Conseil, 'typeId' | 'couleur' | 'taille'>;

/** Le plus proche du conseil : d'abord la taille (cm), puis le poids (g) ; à égalité, le premier de la boîte. */
function leMoinsEloigne<L extends LeurreDeBoite>(candidats: L[], taille: ConseilLu['taille']): L | null {
  if (candidats.length === 0) return null;
  if (taille === null) return candidats[0];
  const ecart = (l: LeurreDeBoite): number => Math.abs((taille.unite === 'cm' ? l.tailleCm : l.poidsG) - taille.valeur);
  return candidats.reduce((meilleur, l) => (ecart(l) < ecart(meilleur) ? l : meilleur));
}

/** Une correspondance par conseil, dans le même ordre. Fonction pure, n'altère pas ses entrées. */
export function trouverDansLaBoite<L extends LeurreDeBoite>(
  conseils: ConseilLu[],
  boite: L[],
  typesLeurres: TypeLeurre[],
): Correspondance<L>[] {
  const types = new Map(typesLeurres.map((t) => [t.id, t]));
  const typeDe = (id: string): TypeLeurre | undefined => types.get(id);

  return conseils.map((conseil): Correspondance<L> => {
    const { typeId } = conseil;
    const memeType = leMoinsEloigne(
      boite.filter((l) => l.typeId === typeId),
      conseil.taille,
    );
    if (memeType) return { statut: 'dans-ta-boite', typeId, leurre: memeType };

    const conseille = typeDe(typeId);
    const voisin = conseille
      ? leMoinsEloigne(
          boite.filter((l) => typeDe(l.typeId)?.zoneNage === conseille.zoneNage),
          conseil.taille,
        )
      : null;
    if (voisin) return { statut: 'substitution', typeId, leurre: voisin };

    return { statut: 'il-te-manque', typeId, plage: conseille ? gammeDe(conseille) : null, couleur: conseil.couleur };
  });
}
