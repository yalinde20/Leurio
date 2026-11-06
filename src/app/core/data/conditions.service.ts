import { inject, Injectable } from '@angular/core';
import { Conditions, saisonDe } from '../engine/conditions';
import { SaisieTempEau, saisieRecente } from '../engine/temperature-eau';
import { ConditionsCache } from './conditions-cache';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
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
}

/** « Conditions du 27/10 à 18 h » (ou « à 18 h 30 »), à l'heure de Paris. */
export function mentionConditionsDu(date: Date): string {
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
  return `Conditions du ${valeur('day')}/${valeur('month')} à ${heure}`;
}

/** Une source qui rejette est traitée comme indisponible. */
async function ouNull<T>(source: Promise<T>): Promise<T | null> {
  try {
    return await source;
  } catch {
    return null;
  }
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

  /** Ne rejette jamais : une source indisponible donne `null` (ou « inconnu » pour le débit). */
  async conditions(demande: DemandeConditions): Promise<Conditions> {
    return (await this.releve(demande)).conditions;
  }

  /**
   * Conditions et pression. Si la météo répond, le relevé est gardé en cache local ; sinon, le dernier relevé
   * en cache fournit pression, tendance, nuages et vent, avec une mention datée (PLAN §4, « Si une API est en panne »).
   * Le reste (eau, débit, moment, saison, département) est toujours calculé en direct. Ne rejette jamais.
   */
  async releve(demande: DemandeConditions): Promise<ReleveActuel> {
    const { lieu, spot, especeCible } = demande;
    // Un moment invalide est traité comme un moment omis : « maintenant » (la méthode ne rejette jamais).
    const moment = demande.moment && !Number.isNaN(demande.moment.getTime()) ? demande.moment : new Date();
    const saisie = saisieRecente(demande.saisieTempEau, moment) ? demande.saisieTempEau : undefined;
    const [eau, debit, meteo] = await Promise.all([
      saisie ? null : ouNull(this.temperatureEau.temperatureEauProche(lieu, moment)),
      ouNull(this.hubeau.tendanceDebitProche(lieu, moment)),
      ouNull(this.weather.meteoPrevue(lieu, moment)),
    ]);
    const meteoConnue = meteo !== null && meteo.disponible && 'pressionTendance48h' in meteo ? meteo : null;
    // Seule une vraie panne (indisponible sans refus, ou rejet) reprend le cache ; une demande refusée n'est pas une panne.
    const enPanne = meteo === null || (!meteo.disponible && !('refusee' in meteo));
    const enCache = enPanne ? await this.cache.lire() : null;
    const conditions: Conditions = {
      tempEau: saisie ? saisie.valeurC : eau?.statut === 'connue' ? eau.tempEauC : null,
      sourceTempEau: saisie ? 'saisie' : eau?.statut === 'connue' ? eau.source : null,
      debitTendance: debit?.statut === 'tendance' ? debit.tendance : 'inconnu',
      pressionTendance48h: meteoConnue
        ? meteoConnue.pressionTendance48h.disponible
          ? meteoConnue.pressionTendance48h.ecartHpa
          : null
        : (enCache?.conditions.pressionTendance48h ?? null),
      nuages: meteoConnue ? (meteoConnue.couvertureNuageusePct ?? null) : (enCache?.conditions.nuages ?? null),
      vent: meteoConnue ? (meteoConnue.ventKmh ?? null) : (enCache?.conditions.vent ?? null),
      moment: this.momentJournee.moment(lieu, moment),
      saison: saisonDe(moment),
      categorie: spot?.categorie ?? null,
      departement: spot?.departement ?? this.geo.departement(lieu),
      niveau: demande.niveau ?? 'debutant',
    };
    if (especeCible !== undefined && especeCible !== 'toutes') conditions.especeCible = especeCible;
    if (meteoConnue) {
      const pressionHpa = meteoConnue.pressionHpa ?? null;
      await this.cache.ecrire({ conditions, pressionHpa, obtenuesA: meteoConnue.heure.toISOString() });
      return { conditions, pressionHpa };
    }
    if (enCache) {
      return { conditions, pressionHpa: enCache.pressionHpa ?? null, mention: mentionConditionsDu(new Date(enCache.obtenuesA)) };
    }
    return { conditions, pressionHpa: null };
  }
}
