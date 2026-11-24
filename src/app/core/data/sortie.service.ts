import { inject, Injectable, Injector } from '@angular/core';
import { avecDelai, INDEXED_DB, MAGASIN_SORTIE, ouvrirBase } from './conditions-cache';
import { distanceKm, HubeauService, ResultatTendanceDebit } from './hubeau.service';
import { ResultatTempEau, TemperatureEauService } from './temperature-eau.service';
import { Lieu, WeatherProvider } from './weather-provider';

/** Un lieu à moins de ce rayon, en km, est le lieu de la sortie préparée. */
const RAYON_SORTIE_KM = 1;
const CLE = 'preparee';

/** Les valeurs d'une heure de la sortie préparée. */
export interface HeurePreparee {
  /** Heure pleine, instant UTC. */
  heure: Date;
  pressionHpa: number;
  /** Écart de pression sur 48 h en hPa ; `null` si la pression 48 h avant manquait. */
  pressionTendance48h: number | null;
  nuages: number;
  vent: number;
}

/** La sortie préparée : les conditions des 48 h à venir d'un lieu, avec l'eau et le débit lus au moment de la préparation. */
export interface SortiePreparee {
  lieu: Lieu;
  prepareeA: Date;
  /** Une heure pleine par heure, de la préparation à + 48 h, dans l'ordre. */
  heures: HeurePreparee[];
  eau: ResultatTempEau | null;
  debit: ResultatTendanceDebit | null;
}

export type ResultatPreparation =
  | { statut: 'prete'; jusquA: Date }
  | { statut: 'hors ligne' }
  | { statut: 'echec' };

/** La sortie telle que gardée dans IndexedDB : des textes et des nombres, jamais de `Date`. */
interface SortieEnregistree {
  lieu: Lieu;
  prepareeA: string;
  heures: { heure: string; pressionHpa: number; pressionTendance48h: number | null; nuages: number; vent: number }[];
  eau: ResultatTempEau | null;
  debit: ResultatTendanceDebit | null;
}

const estUnNombre = (valeur: unknown): valeur is number => typeof valeur === 'number' && Number.isFinite(valeur);
const estUneDate = (valeur: unknown): valeur is string => typeof valeur === 'string' && !Number.isNaN(new Date(valeur).getTime());

function estEnregistree(valeur: unknown): valeur is SortieEnregistree {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const { lieu, prepareeA, heures } = valeur as Partial<Record<keyof SortieEnregistree, unknown>>;
  const lieuValide = typeof lieu === 'object' && lieu !== null && estUnNombre((lieu as Lieu).latitude) && estUnNombre((lieu as Lieu).longitude);
  return (
    lieuValide &&
    estUneDate(prepareeA) &&
    Array.isArray(heures) &&
    heures.length > 0 &&
    heures.every(
      (h: Record<string, unknown>) =>
        estUneDate(h['heure']) &&
        estUnNombre(h['pressionHpa']) &&
        (h['pressionTendance48h'] === null || estUnNombre(h['pressionTendance48h'])) &&
        estUnNombre(h['nuages']) &&
        estUnNombre(h['vent']),
    )
  );
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
 * « Préparer ma sortie » (PLAN §3, §4) : garde dans IndexedDB les conditions des 48 h à venir d'un lieu, avec l'eau et le débit
 * du moment, pour donner un conseil sans réseau. Une seule sortie à la fois : en préparer une autre remplace la précédente,
 * un échec ne touche à rien. Ne rejette jamais.
 */
@Injectable({ providedIn: 'root' })
export class SortieService {
  private readonly indexedDb = inject(INDEXED_DB);
  // Les sources ne sont demandées qu'à la préparation : lire une sortie (ConditionsService) n'a besoin que d'IndexedDB.
  private readonly injector = inject(Injector);

  async preparer(lieu: Lieu): Promise<ResultatPreparation> {
    // Sans réseau, rien n'est téléchargé : la sortie déjà préparée reste en place.
    if (!navigator.onLine) return { statut: 'hors ligne' };
    const maintenant = new Date();
    const weather = this.injector.get(WeatherProvider);
    const temperatureEau = this.injector.get(TemperatureEauService);
    const hubeau = this.injector.get(HubeauService);
    const [previsions, eau, debit] = await Promise.all([
      ouNull(weather.previsions48h(lieu)),
      ouNull(temperatureEau.temperatureEauProche(lieu, maintenant)),
      ouNull(hubeau.tendanceDebitProche(lieu, maintenant)),
    ]);
    if (!previsions?.disponible || previsions.heures.length === 0) return { statut: 'echec' };
    const sortie: SortieEnregistree = {
      lieu: { latitude: lieu.latitude, longitude: lieu.longitude },
      prepareeA: maintenant.toISOString(),
      heures: previsions.heures.map((h) => ({
        heure: h.heure.toISOString(),
        pressionHpa: h.pressionHpa,
        pressionTendance48h: h.pressionTendance48h.disponible ? h.pressionTendance48h.ecartHpa : null,
        nuages: h.couvertureNuageusePct,
        vent: h.ventKmh,
      })),
      eau,
      debit,
    };
    if (!(await avecDelai(this.ecrire(sortie), false))) return { statut: 'echec' };
    return { statut: 'prete', jusquA: new Date(sortie.heures[sortie.heures.length - 1].heure) };
  }

  /** La sortie préparée si son lieu est à moins de 1 km de `lieu`, sinon `null`. Ne rejette jamais. */
  async pour(lieu: Lieu): Promise<SortiePreparee | null> {
    const enregistree = await avecDelai(this.lire(), null);
    if (!enregistree || distanceKm(lieu, enregistree.lieu) > RAYON_SORTIE_KM) return null;
    return {
      lieu: enregistree.lieu,
      prepareeA: new Date(enregistree.prepareeA),
      heures: enregistree.heures.map((h) => ({ ...h, heure: new Date(h.heure) })),
      eau: enregistree.eau,
      debit: enregistree.debit,
    };
  }

  private async lire(): Promise<SortieEnregistree | null> {
    try {
      const base = await ouvrirBase(this.indexedDb);
      if (!base) return null;
      return await new Promise<SortieEnregistree | null>((resolve) => {
        try {
          const requete = base.transaction(MAGASIN_SORTIE, 'readonly').objectStore(MAGASIN_SORTIE).get(CLE);
          requete.onsuccess = () => {
            base.close();
            resolve(estEnregistree(requete.result) ? requete.result : null);
          };
          requete.onerror = () => {
            base.close();
            resolve(null);
          };
        } catch {
          base.close();
          resolve(null);
        }
      });
    } catch {
      return null;
    }
  }

  /** Vrai seulement si la sortie est bien écrite. */
  private async ecrire(sortie: SortieEnregistree): Promise<boolean> {
    try {
      const base = await ouvrirBase(this.indexedDb);
      if (!base) return false;
      return await new Promise<boolean>((resolve) => {
        try {
          const transaction = base.transaction(MAGASIN_SORTIE, 'readwrite');
          transaction.oncomplete = () => {
            base.close();
            resolve(true);
          };
          transaction.onerror = transaction.onabort = () => {
            base.close();
            resolve(false);
          };
          transaction.objectStore(MAGASIN_SORTIE).put(sortie, CLE);
        } catch {
          base.close();
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  }
}
