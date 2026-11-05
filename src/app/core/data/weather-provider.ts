/** Un lieu, en coordonnées géographiques (degrés). */
export interface Lieu {
  latitude: number;
  longitude: number;
}

/** Météo du moment : les quatre valeurs sont toujours présentes ensemble. */
export interface MeteoActuelle {
  disponible: true;
  pressionHpa: number;
  couvertureNuageusePct: number;
  ventKmh: number;
  temperatureAirC: number;
}

/** Météo indisponible, en entier : jamais de valeur inventée ni partielle (PLAN §4). */
export interface MeteoIndisponible {
  disponible: false;
}

export type ResultatMeteo = MeteoActuelle | MeteoIndisponible;

export type MotifRefus = 'moment hors des 48 h à venir' | 'moment déjà passé';

/** Demande refusée avant tout appel réseau : le moment choisi n'est pas dans la fenêtre prévisible. */
export interface DemandeRefusee {
  disponible: false;
  refusee: true;
  motif: MotifRefus;
}

/** Météo prévue pour une heure pleine ; `heure` est l'instant UTC de l'heure retenue. */
export interface MeteoPrevue extends MeteoActuelle {
  heure: Date;
}

export type ResultatMeteoPrevue = MeteoPrevue | MeteoIndisponible | DemandeRefusee;

const HEURE_MS = 3_600_000;
const FENETRE_MS = 48 * HEURE_MS;

/**
 * Fenêtre de prévision, indépendante du fournisseur : le moment doit être entre le début de l'heure en cours
 * et maintenant + 48 h (inclus). Il est arrondi à l'heure la plus proche (la demi-heure monte).
 */
export function heureDemandee(moment: Date, maintenant: Date): { heure: Date } | DemandeRefusee | MeteoIndisponible {
  const t = moment.getTime();
  // Date invalide (sélecteur vide, saisie mal lue) : météo indisponible, jamais d'exception (PLAN §4).
  if (!Number.isFinite(t)) {
    return { disponible: false };
  }
  if (t > maintenant.getTime() + FENETRE_MS) {
    return { disponible: false, refusee: true, motif: 'moment hors des 48 h à venir' };
  }
  if (t < Math.floor(maintenant.getTime() / HEURE_MS) * HEURE_MS) {
    return { disponible: false, refusee: true, motif: 'moment déjà passé' };
  }
  return { heure: new Date(Math.round(t / HEURE_MS) * HEURE_MS) };
}

/** Source de la météo, du moment ou prévue dans les 48 h (PLAN §4) : jeton d'injection, l'app ne connaît pas le service derrière. */
export abstract class WeatherProvider {
  /** Ne rejette jamais : toute panne ou réponse incomplète donne `{ disponible: false }`. */
  abstract meteoActuelle(lieu: Lieu): Promise<ResultatMeteo>;

  /**
   * Météo prévue à un moment choisi, dans les 48 h à venir (arrondi à l'heure la plus proche).
   * Ne rejette jamais ; un moment hors fenêtre est refusé sans aucun appel réseau.
   */
  abstract meteoPrevue(lieu: Lieu, moment: Date): Promise<ResultatMeteoPrevue>;
}
