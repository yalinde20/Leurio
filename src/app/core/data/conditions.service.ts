import { inject, Injectable } from '@angular/core';
import { Conditions, saisonDe } from '../engine/conditions';
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

  /** Ne rejette jamais : une source indisponible donne `null` (ou « inconnu » pour le débit). */
  async conditions(demande: DemandeConditions): Promise<Conditions> {
    const { lieu, spot, especeCible } = demande;
    const moment = demande.moment ?? new Date();
    const [eau, debit, meteo] = await Promise.all([
      ouNull(this.temperatureEau.temperatureEauProche(lieu, moment)),
      ouNull(this.hubeau.tendanceDebitProche(lieu, moment)),
      ouNull(this.weather.meteoPrevue(lieu, moment)),
    ]);
    const meteoConnue = meteo !== null && meteo.disponible && 'pressionTendance48h' in meteo ? meteo : null;
    const conditions: Conditions = {
      tempEau: eau?.statut === 'connue' ? eau.tempEauC : null,
      sourceTempEau: eau?.statut === 'connue' ? eau.source : null,
      debitTendance: debit?.statut === 'tendance' ? debit.tendance : 'inconnu',
      pressionTendance48h: meteoConnue?.pressionTendance48h.disponible ? meteoConnue.pressionTendance48h.ecartHpa : null,
      nuages: meteoConnue?.couvertureNuageusePct ?? null,
      vent: meteoConnue?.ventKmh ?? null,
      moment: this.momentJournee.moment(lieu, moment),
      saison: saisonDe(moment),
      categorie: spot?.categorie ?? null,
      departement: spot?.departement ?? this.geo.departement(lieu),
      niveau: demande.niveau ?? 'debutant',
    };
    if (especeCible !== undefined && especeCible !== 'toutes') conditions.especeCible = especeCible;
    return conditions;
  }
}
