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

/** Source de la météo du moment (PLAN §4) : jeton d'injection, l'app ne connaît pas le service derrière. */
export abstract class WeatherProvider {
  /** Ne rejette jamais : toute panne ou réponse incomplète donne `{ disponible: false }`. */
  abstract meteoActuelle(lieu: Lieu): Promise<ResultatMeteo>;
}
