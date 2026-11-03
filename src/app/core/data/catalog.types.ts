// Types du contenu embarqué (src/assets/data/*.json), alignés sur les schémas de schemas/.
type Plage = [number, number];

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
}

/** Le schéma des types de leurres est ouvert : d'autres champs de contenu sont permis. */
export interface TypeLeurre extends Fiche {
  id: string;
  nom: string;
  especes: string[];
  zoneNage: 'surface' | 'mi-eau' | 'fond';
  interditFermetureBrochet: boolean;
  techniques?: string[];
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
  erreurAEviter: string;
  difficulte: 1 | 2 | 3;
  videos: Video[];
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
