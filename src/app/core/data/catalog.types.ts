// Types du contenu embarqué (src/assets/data/*.json), alignés sur les schémas de schemas/.
type Plage = [number, number];

/** Saison météorologique (PLAN §8.1) : hiver de décembre à février, printemps de mars à mai, été de juin à août, automne de septembre à novembre. */
export type Saison = 'hiver' | 'printemps' | 'été' | 'automne';

interface Fiche {
  sources: string[];
  /** Date de vérification, au format AAAA-MM-JJ. */
  dateVerif: string;
}

export interface Espece extends Fiche {
  code: string;
  nom: string;
  tempEauC: { active: Plage; ralentie: Plage; quasiNulle: Plage };
  postes: string[];
  proies: string[];
  tailleMinCm: number | null;
  fermetureAvecBrochet: boolean;
  fermetureSpecifique?: string | null;
  /** Fermeture possible au printemps selon le département : avertir « vérifie ton département » du 1er mars au 31 mai (PLAN §6). */
  verifDepartementPrintemps: boolean;
  /** Sa fermeture est la règle nationale de 2e catégorie, déjà affichée par la ligne de fermeture du bandeau (pas d'avertissement « probablement fermé »). */
  fermetureNationale2e?: boolean;
}

/** Le schéma des types de leurres est ouvert : d'autres champs de contenu sont permis. */
export interface TypeLeurre extends Fiche {
  id: string;
  nom: string;
  /** Identifiant d'une famille de lure-families.json, qui sert de filtre dans la boîte (US 100). */
  famille?: string;
  especes: string[];
  zoneNage: 'surface' | 'mi-eau' | 'fond';
  interditFermetureBrochet: boolean;
  techniques?: string[];
  /** Saisons où ce type de leurre est favorable (PLAN §8.3). */
  saisons?: Saison[];
  /** Type adapté à la faible lumière : aube, crépuscule ou ciel couvert (PLAN §8.3). */
  faibleLumiere?: boolean;
  /** Gamme de taille en cm [min, max] des leurres souples et durs ; exclusive avec `poidsG` (PLAN §2.1). */
  tailleCm?: [number, number];
  /** Gamme de poids en g [min, max] des leurres métalliques ou lestés ; exclusive avec `tailleCm` (PLAN §2.1). */
  poidsG?: [number, number];
  /** Gamme de poids de la tête plombée en g [min, max], pour les leurres souples montés sur tête (PLAN §8.3). */
  poidsTeteG?: [number, number];
  [champ: string]: unknown;
}

interface VideoCommune {
  auteur?: string;
  lienAuteur?: string;
  dateVerif?: string;
}

export interface VideoHebergee extends VideoCommune {
  provider: 'youtube' | 'vimeo' | 'dailymotion';
  id: string;
  start?: number;
}

export interface VideoPropre extends VideoCommune {
  provider: 'self';
  fichier: string;
  boucle?: boolean;
  horsLigne?: boolean;
  licence?: string;
}

export type Video = VideoHebergee | VideoPropre;

export interface Animation extends Fiche {
  id: string;
  nom: string;
  geste: string;
  vitesse: string;
  /** Rythme de l'animation, lu par le moteur (PLAN §8.3). */
  rythme: 'lent' | 'moyen' | 'rapide';
  erreurAEviter: string;
  difficulte: 1 | 2 | 3;
  videos: Video[];
  /** Saisons où l'animation est favorable (PLAN §8.3). */
  saisons?: Saison[];
}

/** Famille de leurres (Souples, Durs…) : une puce du filtre de la boîte, dans l'ordre du contenu (US 100). */
export interface FamilleLeurre extends Fiche {
  id: string;
  nom: string;
}

/** Couleur de leurre (PLAN §8.3) : vive pour l'eau trouble, naturelle pour l'eau claire. La première du contenu est la couleur par défaut. */
export interface Couleur extends Fiche {
  id: string;
  nom: string;
  classe: 'vive' | 'naturelle';
}

export interface ElementKit extends Fiche {
  typeId: string;
  raison: string;
}

export interface Federation extends Fiche {
  departement: string;
  nom: string;
  url: string;
}
