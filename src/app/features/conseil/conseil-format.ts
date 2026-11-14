import { TEMP_SAISIE_MAX_C, TEMP_SAISIE_MIN_C } from '../../core/engine/temperature-eau';
import { Animation, Couleur, Espece, TypeLeurre } from '../../core/data/catalog.types';
import { Correspondance, LeurreDeBoite } from '../../core/engine/matcher';
import { Conseil } from '../../core/engine/scorer';
import { TailleLeurre } from '../../core/engine/rules/regle';
import { formaterLongueur, formaterPlage, formaterPoids, Unites } from '../../shared/unites';
import { DetailConseil } from './conseil-detail.store';

/** Première phrase d'un pourquoi du moteur ; le texte entier s'il n'y a qu'une phrase. */
export function premierePhrase(texte: string): string {
  const fin = texte.search(/[.!?…](\s|$)/);
  return fin === -1 ? texte : texte.slice(0, fin + 1);
}

/** « Taille » pour une longueur en cm, « Poids » pour un poids en g. */
export function libelleTaille(taille: TailleLeurre): string {
  return taille.unite === 'cm' ? 'Taille' : 'Poids';
}

/** Le texte d'une taille ou d'un poids avec une espace insécable avant l'unité (8 cm, 10 g ; 3,1 po, 0,35 oz en impérial). */
export function formaterTaille(taille: TailleLeurre, unites: Unites = 'metriques'): string {
  return taille.unite === 'cm' ? formaterLongueur(taille.valeur, unites) : formaterPoids(taille.valeur, unites);
}

/** Lit une température saisie (virgule ou point) ; `null` si vide, non numérique ou hors de 0 à 35 °C. */
export function lireTempSaisie(texte: string): number | null {
  const propre = texte.trim();
  if (!/^[+-]?\d+([.,]\d+)?$/.test(propre)) return null;
  const valeur = Number(propre.replace(',', '.')) + 0; // + 0 : jamais de −0
  return valeur >= TEMP_SAISIE_MIN_C && valeur <= TEMP_SAISIE_MAX_C ? valeur : null;
}

/** La phrase du détail quand le moteur n'a déclenché aucune règle. */
export const AUCUNE_REGLE =
  "Aucune règle particulière ne s'applique dans ces conditions : c'est le meilleur choix par défaut pour ton espèce.";

/** « 5 à 10 g » (« 0,18 à 0,35 oz » en impérial) : la gamme de poids de la tête plombée. */
export function formaterPoidsTete([min, max]: [number, number], unites: Unites = 'metriques'): string {
  return formaterPlage(min, max, 'poids', unites);
}

/** Le détail d'un conseil du moteur, traduit en noms avec les fiches du contenu. */
export function detailDuConseil(
  rang: number,
  conseil: Conseil,
  contenu: { types: TypeLeurre[]; animations: Animation[]; couleurs: Couleur[]; especes: Espece[] },
  unites: Unites = 'metriques',
): DetailConseil {
  const type = contenu.types.find((t) => t.id === conseil.typeId);
  const espece = contenu.especes.find((e) => e.code === conseil.especeCode);
  return {
    rang,
    type: type?.nom ?? conseil.typeId,
    animationId: conseil.techniqueId,
    animation: contenu.animations.find((a) => a.id === conseil.techniqueId)?.nom ?? conseil.techniqueId,
    espece: espece?.nom ?? null,
    couleur: contenu.couleurs.find((c) => c.id === conseil.couleur)?.nom ?? conseil.couleur,
    taille: conseil.taille ? { libelle: libelleTaille(conseil.taille), valeur: formaterTaille(conseil.taille, unites) } : null,
    poidsTete: type?.poidsTeteG ? formaterPoidsTete(type.poidsTeteG, unites) : null,
    postes: espece && espece.postes.length > 0 ? espece.postes.join(', ') : null,
    pourquoi: conseil.pourquoi.length > 0 ? conseil.pourquoi : [AUCUNE_REGLE],
  };
}

/** La ligne « leurre de ma boîte » d'un conseil (US 105) : un libellé en gras, puis le texte. */
export interface LigneBoite {
  /** Vrai pour « Il te manque » (cadre pointillé, icône plus), faux pour un leurre de la boîte. */
  manque: boolean;
  libelle: string;
  texte: string;
}

const LIBELLE_DANS_LA_BOITE = 'Dans ta boîte :';
const LIBELLE_A_LA_PLACE = 'À la place, dans ta boîte :';
const LIBELLE_IL_TE_MANQUE = 'Il te manque :';

const espacesSimples = (texte: string): string => texte.replace(/\s/g, ' ');
const minusculeInitiale = (texte: string): string => texte.charAt(0).toLowerCase() + texte.slice(1);

/** « {nom du type} {taille} {couleur} » (espaces simples : la ligne passe à la ligne comme une phrase) : le type, la taille dans l'unité de son type (cm par défaut) et la couleur saisie. */
function formaterLeurreDeBoite(leurre: LeurreDeBoite, types: TypeLeurre[], unites: Unites): string {
  const type = types.find((t) => t.id === leurre.typeId);
  const taille = type?.poidsG && !type.tailleCm ? { valeur: leurre.poidsG, unite: 'g' as const } : { valeur: leurre.tailleCm, unite: 'cm' as const };
  return `${type?.nom ?? leurre.typeId} ${espacesSimples(formaterTaille(taille, unites))} ${leurre.couleur}`;
}

/** « {article} {nom du type} {min}–{max} {unité} couleur {couleur} » ; sans plage dans le contenu, sans la plage. */
function formaterLeurreManquant(
  correspondance: Extract<Correspondance, { statut: 'il-te-manque' }>,
  types: TypeLeurre[],
  couleurs: Couleur[],
  unites: Unites,
): string {
  const type = types.find((t) => t.id === correspondance.typeId);
  const { plage } = correspondance;
  const couleur = couleurs.find((c) => c.id === correspondance.couleur)?.nom ?? correspondance.couleur;
  const intervalle = plage ? ` ${espacesSimples(formaterPlage(plage.min, plage.max, plage.unite === 'cm' ? 'longueur' : 'poids', unites, '–'))}` : '';
  return `${type?.article ?? 'un'} ${minusculeInitiale(type?.nom ?? correspondance.typeId)}${intervalle} couleur ${couleur.toLowerCase()}`;
}

/** La ligne de la boîte pour la correspondance que le matcher a trouvée à un conseil. */
export function ligneDeLaBoite(correspondance: Correspondance, contenu: { types: TypeLeurre[]; couleurs: Couleur[] },
  unites: Unites = 'metriques',
): LigneBoite {
  if (correspondance.statut === 'il-te-manque') {
    return { manque: true, libelle: LIBELLE_IL_TE_MANQUE, texte: formaterLeurreManquant(correspondance, contenu.types, contenu.couleurs, unites) };
  }
  return {
    manque: false,
    libelle: correspondance.statut === 'substitution' ? LIBELLE_A_LA_PLACE : LIBELLE_DANS_LA_BOITE,
    texte: formaterLeurreDeBoite(correspondance.leurre, contenu.types, unites),
  };
}
