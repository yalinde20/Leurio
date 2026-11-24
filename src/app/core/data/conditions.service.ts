import { inject, Injectable } from '@angular/core';
import { Conditions, saisonDe } from '../engine/conditions';
import { SaisieTempEau, saisieRecente } from '../engine/temperature-eau';
import { ConditionsCache } from './conditions-cache';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
import { HeurePreparee, SortiePreparee, SortieService } from './sortie.service';
import { TemperatureEauService } from './temperature-eau.service';
import { Lieu, WeatherProvider } from './weather-provider';

/** Ce qu'il faut pour assembler les conditions d'un lieu et d'un moment. */
export interface DemandeConditions {
  lieu: Lieu;
  /** Moment visé ; « maintenant » s'il est omis. */
  moment?: Date;
  /** Spot enregistré : donne la catégorie et le département. Sans spot, le département vient de la position. */
  spot?: { categorie: 1 | 2; departement: string };
  /** Code de l'espèce visée, ou « toutes ». */
  especeCible?: string;
  /** « debutant » s'il est omis. */
  niveau?: 'debutant' | 'intermediaire';
  /**
   * Température de l'eau saisie au thermomètre. Prioritaire si elle a moins de 6 h au moment visé (PLAN §8.2) ;
   * sinon ignorée : station Hub'Eau, puis estimation depuis l'air.
   */
  saisieTempEau?: SaisieTempEau;
}

/** Conditions assemblées, avec la pression et, si elles viennent du cache, la mention de leur date. */
export interface ReleveActuel {
  conditions: Conditions;
  pressionHpa: number | null;
  /** « Conditions du 27/10 à 18 h » quand météo en panne et conditions reprises du cache. */
  mention?: string;
  /** Station Hub'Eau qui a mesuré la température de l'eau (source « capteur »). */
  stationEau?: { nom: string; distanceKm: number };
  /** Instant de la saisie au thermomètre (source « saisie »). */
  saisieA?: Date;
  /** Pourquoi le débit est « inconnu » : pas de station proche, ou Hub'Eau en panne. */
  debitAbsent?: 'aucune station' | "Hub'Eau indisponible";
  /**
   * Vrai exactement quand la météo est en vraie panne (rejet, ou « indisponible » sans refus) et qu'aucun relevé
   * n'est en cache : le conseil repose alors sur la saison et la température saisie, et est signalé « moins précis »
   * (PLAN §4, « Si une API est en panne »). Faux si la météo répond, si le cache prend le relais ou si la demande est refusée.
   */
  moinsPrecis: boolean;
}

/** « 27/10 à 18 h » (ou « à 18 h 30 »), à l'heure de Paris. */
export function dateEtHeureParis(date: Date): string {
  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const valeur = (type: string) => parties.find((p) => p.type === type)?.value ?? '';
  const minutes = valeur('minute');
  const heure = `${Number(valeur('hour'))} h${minutes === '00' ? '' : ` ${minutes}`}`;
  return `${valeur('day')}/${valeur('month')} à ${heure}`;
}

/** « Conditions du 27/10 à 18 h » (ou « à 18 h 30 »), à l'heure de Paris. */
export function mentionConditionsDu(date: Date): string {
  return `Conditions du ${dateEtHeureParis(date)}`;
}

/** Une source qui rejette est traitée comme indisponible. */
async function ouNull<T>(source: Promise<T>): Promise<T | null> {
  try {
    return await source;
  } catch {
    return null;
  }
}

const HEURE_MS = 3600000;

/**
 * Où tombe le moment dans la sortie préparée : l'heure préparée la plus proche (arrondi à l'heure, comme la météo prévue),
 * ou « au-delà » quand il dépasse sa dernière heure ; `null` pour un moment d'avant la sortie.
 */
function heureDeLaSortie(sortie: SortiePreparee, moment: Date): HeurePreparee | 'au-dela' | null {
  const heure = Math.round(moment.getTime() / HEURE_MS) * HEURE_MS;
  const trouvee = sortie.heures.find((h) => h.heure.getTime() === heure);
  if (trouvee) return trouvee;
  return heure > sortie.heures[sortie.heures.length - 1].heure.getTime() ? 'au-dela' : null;
}

/** Le moment est-il après l'heure en cours ? Les moments passés ou de l'heure courante sont des relevés. */
function estDansLeFutur(moment: Date): boolean {
  const debutHeureSuivante = (Math.floor(Date.now() / 3600000) + 1) * 3600000;
  return moment.getTime() >= debutHeureSuivante;
}

/**
 * Assemble en un seul relevé `Conditions` la météo, l'eau, le moment de la journée, le département,
 * la saison, la catégorie, l'espèce visée et le niveau (PLAN §4, §8.1).
 */
@Injectable({ providedIn: 'root' })
export class ConditionsService {
  private readonly temperatureEau = inject(TemperatureEauService);
  private readonly hubeau = inject(HubeauService);
  private readonly weather = inject(WeatherProvider);
  private readonly momentJournee = inject(MomentJourneeService);
  private readonly geo = inject(GeoService);

  private readonly cache = inject(ConditionsCache);
  private readonly sortie = inject(SortieService);

  /** Ne rejette jamais : une source indisponible donne `null` (ou « inconnu » pour le débit). */
  async conditions(demande: DemandeConditions): Promise<Conditions> {
    return (await this.releve(demande)).conditions;
  }

  /**
   * Conditions et pression. Si la météo répond, le relevé est gardé en cache local ; sinon, le dernier relevé
   * en cache fournit pression, tendance, nuages et vent, avec une mention datée (PLAN §4, « Si une API est en panne »).
   * Le reste (eau, débit, moment, saison, département) est toujours calculé en direct. Ne rejette jamais.
   * Une sortie préparée (US 14) pour ce lieu passe avant le cache : dans ses 48 h, ses heures (et son eau et son débit
   * quand ceux du moment manquent) servent, avec la mention de sa date ; au-delà, le conseil est « moins précis »
   * et le dernier relevé n'est pas repris.
   */
  async releve(demande: DemandeConditions): Promise<ReleveActuel> {
    const { lieu, spot, especeCible } = demande;
    // Un moment invalide est traité comme un moment omis : « maintenant » (la méthode ne rejette jamais).
    const moment = demande.moment && !Number.isNaN(demande.moment.getTime()) ? demande.moment : new Date();
    const saisie = saisieRecente(demande.saisieTempEau, moment) ? demande.saisieTempEau : undefined;
    const [eau, debit, meteo] = await Promise.all([
      saisie ? null : ouNull(this.temperatureEau.temperatureEauProche(lieu, moment)),
      ouNull(this.hubeau.tendanceDebitProche(lieu, moment)),
      // Sans réseau (mode avion), la météo n'est même pas demandée : elle est en panne d'office.
      navigator.onLine === false ? null : ouNull(this.weather.meteoPrevue(lieu, moment)),
    ]);
    const meteoConnue = meteo !== null && meteo.disponible && 'pressionTendance48h' in meteo ? meteo : null;
    // Seule une vraie panne (indisponible sans refus, ou rejet) reprend le cache ; une demande refusée n'est pas une panne.
    const enPanne = meteo === null || (!meteo.disponible && !('refusee' in meteo));
    const sortie = enPanne ? await this.sortie.pour(lieu) : null;
    const dansLaSortie = sortie ? heureDeLaSortie(sortie, moment) : null;
    const preparee = dansLaSortie && dansLaSortie !== 'au-dela' ? dansLaSortie : null;
    const enCache = enPanne && !dansLaSortie ? await this.cache.lire() : null;
    // L'eau et le débit préparés ne servent que si ceux du moment manquent.
    const eauRetenue = eau?.statut === 'connue' || !preparee ? eau : (sortie?.eau ?? eau);
    const debitRetenu = debit?.statut === 'tendance' || !preparee ? debit : (sortie?.debit ?? debit);
    const conditions: Conditions = {
      tempEau: saisie ? saisie.valeurC : eauRetenue?.statut === 'connue' ? eauRetenue.tempEauC : null,
      sourceTempEau: saisie ? 'saisie' : eauRetenue?.statut === 'connue' ? eauRetenue.source : null,
      debitTendance: debitRetenu?.statut === 'tendance' ? debitRetenu.tendance : 'inconnu',
      pressionTendance48h: meteoConnue
        ? meteoConnue.pressionTendance48h.disponible
          ? meteoConnue.pressionTendance48h.ecartHpa
          : null
        : preparee
          ? preparee.pressionTendance48h
          : (enCache?.conditions.pressionTendance48h ?? null),
      nuages: meteoConnue ? (meteoConnue.couvertureNuageusePct ?? null) : (preparee?.nuages ?? enCache?.conditions.nuages ?? null),
      vent: meteoConnue ? (meteoConnue.ventKmh ?? null) : (preparee?.vent ?? enCache?.conditions.vent ?? null),
      moment: this.momentJournee.moment(lieu, moment),
      saison: saisonDe(moment),
      categorie: spot?.categorie ?? null,
      departement: spot?.departement ?? this.geo.departement(lieu),
      niveau: demande.niveau ?? 'debutant',
    };
    if (especeCible !== undefined && especeCible !== 'toutes') conditions.especeCible = especeCible;
    const origine: Pick<ReleveActuel, 'stationEau' | 'saisieA' | 'debitAbsent'> = {};
    if (saisie) origine.saisieA = saisie.mesureeA;
    else if (eauRetenue?.statut === 'connue' && eauRetenue.source === 'capteur') {
      origine.stationEau = { nom: eauRetenue.station.nom, distanceKm: eauRetenue.distanceKm };
    }
    if (debitRetenu?.statut !== 'tendance') origine.debitAbsent = debitRetenu?.statut === 'aucune station' ? 'aucune station' : "Hub'Eau indisponible";
    if (meteoConnue) {
      const pressionHpa = meteoConnue.pressionHpa ?? null;
      // Une prévision d'un moment futur ne doit jamais devenir le « dernier relevé » servi à « maintenant ».
      if (!estDansLeFutur(moment)) {
        await this.cache.ecrire({ conditions, pressionHpa, obtenuesA: meteoConnue.heure.toISOString() });
      }
      return { conditions, pressionHpa, moinsPrecis: false, ...origine };
    }
    if (sortie && preparee) {
      return { conditions, pressionHpa: preparee.pressionHpa, mention: mentionConditionsDu(sortie.prepareeA), moinsPrecis: false, ...origine };
    }
    if (enCache) {
      return {
        conditions,
        pressionHpa: enCache.pressionHpa ?? null,
        mention: mentionConditionsDu(new Date(enCache.obtenuesA)),
        moinsPrecis: false,
        ...origine,
      };
    }
    return { conditions, pressionHpa: null, moinsPrecis: enPanne, ...origine };
  }
}
