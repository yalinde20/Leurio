// Document utilisateur users/{uid} (PLAN §7, §4 pour le champ `plan`).
// Les niveaux suivent le public visé : débutants et intermédiaires (PLAN §1).
export type Niveau = 'debutant' | 'intermediaire';

/** Offre de l'utilisateur ; `pro` est réservé à la monétisation future (PLAN §4), sans effet aujourd'hui. */
export type Plan = 'free' | 'pro';

export interface UserDoc {
  niveau: Niveau;
  /** Codes des espèces préférées (contenu JSON, PLAN §7). */
  especesFavorites: string[];
  consentements: { analytics: boolean; video: boolean };
  /** Date de création, en millisecondes depuis 1970. */
  createdAt: number;
  plan: Plan;
}
