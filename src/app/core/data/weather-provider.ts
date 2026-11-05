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

/** Tendance de la pression sur 48 h (PLAN §8.1) : écart signé en hPa, ou indisponible si la pression 48 h avant manque. */
export type TendancePression = { disponible: true; ecartHpa: number } | { disponible: false };

/** Météo prévue pour une heure pleine ; `heure` est l'instant UTC de l'heure retenue. */
export interface MeteoPrevue extends MeteoActuelle {
  heure: Date;
  pressionTendance48h: TendancePression;
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

/**
 * Tendance de la pression sur 48 h : pression au moment choisi moins pression 48 h avant, arrondie à 0,1 hPa.
 * Une pression 48 h avant absente ou invalide rend la tendance indisponible, jamais une valeur inventée.
 */
export function tendancePression48h(pressionMoment: number, pression48hAvant: unknown): TendancePression {
  if (typeof pression48hAvant !== 'number' || !Number.isFinite(pression48hAvant)) {
    return { disponible: false };
  }
  const ecart = Math.round((pressionMoment - pression48hAvant) * 10) / 10;
  // Math.round peut rendre -0 : on le ramène à 0.
  return { disponible: true, ecartHpa: ecart === 0 ? 0 : ecart };
}

/** Moyenne de la température de l'air des derniers jours (PLAN §8.2) : indisponible s'il y a moins de 5 jours valides. */
export type MoyenneAir = { disponible: true; moyenneC: number; joursUtilises: number } | { disponible: false };

const JOURS_FENETRE = 7;
const JOURS_MIN = 5;

const formatJourParis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Les 7 jours civils qui précèdent le jour du moment à Paris, au format AAAA-MM-JJ, du plus ancien au plus récent.
 * Calcul sur des dates civiles (UTC) : un changement d'heure ne décale aucun jour. Moment invalide : `null`.
 */
export function joursPrecedents(moment: Date): string[] | null {
  if (!Number.isFinite(moment.getTime())) {
    return null;
  }
  const parties = Object.fromEntries(formatJourParis.formatToParts(moment).map((p) => [p.type, p.value]));
  const jourMoment = Date.UTC(Number(parties['year']), Number(parties['month']) - 1, Number(parties['day']));
  return Array.from({ length: JOURS_FENETRE }, (_, i) =>
    new Date(jourMoment + (i - JOURS_FENETRE) * 86_400_000).toISOString().slice(0, 10),
  );
}

/**
 * Moyenne des températures journalières des jours demandés, arrondie à 0,1 °C. Seuls comptent les jours de la fenêtre
 * (comptés une fois) dont la valeur est un nombre fini ; moins de 5 jours valides : indisponible, jamais une valeur inventée.
 */
export function moyenneAirJours(fenetre: string[], jours: unknown, valeurs: unknown): MoyenneAir {
  if (!Array.isArray(jours) || !Array.isArray(valeurs)) {
    return { disponible: false };
  }
  const retenus = new Map<string, number>();
  jours.forEach((jour: unknown, i) => {
    const valeur: unknown = valeurs[i];
    if (typeof jour === 'string' && fenetre.includes(jour) && typeof valeur === 'number' && Number.isFinite(valeur)) {
      retenus.set(jour, valeur);
    }
  });
  if (retenus.size < JOURS_MIN) {
    return { disponible: false };
  }
  const somme = [...retenus.values()].reduce((total, v) => total + v, 0);
  const moyenne = Math.round((somme / retenus.size) * 10) / 10;
  // Math.round peut rendre -0 : on le ramène à 0.
  return { disponible: true, moyenneC: moyenne === 0 ? 0 : moyenne, joursUtilises: retenus.size };
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

  /**
   * Moyenne de la température de l'air des 7 jours qui précèdent le jour du moment choisi (au moins 5 jours valides).
   * Ne rejette jamais : toute panne, moment invalide ou réponse incomplète donne `{ disponible: false }`.
   */
  abstract moyenneAirDerniersJours(lieu: Lieu, moment: Date): Promise<MoyenneAir>;
}
