/* US 14, compléments : cache plus récent que la sortie, base v1 existante, données mal formées, hors ligne sans appel météo. */
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { ConditionsCache, INDEXED_DB, ReleveConditions } from './conditions-cache';
import { ConditionsService } from './conditions.service';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
import { SortieService } from './sortie.service';
import { TemperatureEauService } from './temperature-eau.service';
import { Lieu, WeatherProvider } from './weather-provider';
import { TuilesService } from './tuiles.service';

const ANGERS: Lieu = { latitude: 47.47, longitude: -0.55 };
const HEURE_MS = 3_600_000;
const PREPAREE_A = new Date('2026-11-24T08:00:00Z');

const previsions = () => ({
  disponible: true as const,
  heures: Array.from({ length: 49 }, (_, i) => ({
    disponible: true as const,
    heure: new Date(PREPAREE_A.getTime() + i * HEURE_MS),
    pressionHpa: 1000 + i,
    pressionTendance48h: { disponible: true as const, ecartHpa: i - 20 },
    couvertureNuageusePct: i,
    ventKmh: 5 + i,
    temperatureAirC: 8,
  })),
});

const releve = (obtenuesA: string): ReleveConditions => ({
  conditions: {
    tempEau: 11.2, sourceTempEau: 'capteur', debitTendance: 'normal', pressionTendance48h: -4, nuages: 40, vent: 12,
    moment: 'crépuscule', saison: 'automne', categorie: null, departement: '49', niveau: 'debutant',
  },
  pressionHpa: 1016,
  obtenuesA,
});

function installer(fabrique: IDBFactory, enLigne: boolean, meteoPrevue = vi.fn(async () => { throw new Error('Failed to fetch'); })) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(enLigne);
  TestBed.configureTestingModule({
    providers: [
      { provide: TuilesService, useValue: { mettreEnCacheAutour: async () => undefined } },
      { provide: INDEXED_DB, useValue: fabrique },
      { provide: TemperatureEauService, useValue: { temperatureEauProche: async () => ({ statut: "température de l'eau inconnue" }) } },
      { provide: HubeauService, useValue: { tendanceDebitProche: async () => ({ statut: "Hub'Eau indisponible" }) } },
      { provide: WeatherProvider, useValue: { previsions48h: async () => previsions(), meteoPrevue } },
      { provide: MomentJourneeService, useValue: { moment: () => 'jour' } },
      { provide: GeoService, useValue: { departement: () => '49' } },
    ],
  });
  return { sortie: TestBed.inject(SortieService), conditions: TestBed.inject(ConditionsService), cache: TestBed.inject(ConditionsCache), meteoPrevue };
}

function maintenant(date: Date): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(date);
}

async function sortiePreparee(): Promise<IDBFactory> {
  const fabrique = new IDBFactory();
  maintenant(PREPAREE_A);
  expect(await installer(fabrique, true).sortie.preparer(ANGERS)).toEqual({ statut: 'prete', jusquA: new Date('2026-11-26T08:00:00Z') });
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
  return fabrique;
}

describe('SortieService et ConditionsService : compléments (US 14)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('critère 3 (contraire) : given une sortie préparée et un relevé plus récent que la sortie dans le cache, when le moment est au-delà des 48 h préparées en mode avion, then le relevé du cache est repris avec sa mention', async () => {
    const fabrique = await sortiePreparee();
    maintenant(new Date('2026-11-28T08:00:00Z'));
    const { conditions, cache } = installer(fabrique, false);
    await cache.ecrire(releve('2026-11-27T17:00:00.000Z'));

    const resultat = await conditions.releve({ lieu: ANGERS, moment: new Date('2026-11-29T08:00:00Z') });

    expect(resultat.mention).toBe('Conditions du 27/11 à 18 h');
    expect(resultat.moinsPrecis).toBe(false);
    expect(resultat.pressionHpa).toBe(1016);
  });

  it("given le mode avion, when on demande les conditions, then la météo du moment n'est pas appelée", async () => {
    maintenant(PREPAREE_A);
    const { conditions, meteoPrevue } = installer(new IDBFactory(), false);

    const resultat = await conditions.releve({ lieu: ANGERS });

    expect(meteoPrevue).not.toHaveBeenCalled();
    expect(resultat.moinsPrecis).toBe(true);
  });

  it('given une base v1 avec un relevé dans « conditions », when on lit puis on prépare une sortie, then le relevé est toujours lu par le cache', async () => {
    const fabrique = new IDBFactory();
    const attendu = releve('2026-10-29T17:00:00.000Z');
    await new Promise<void>((resolve, reject) => {
      const requete = fabrique.open('leurio', 1);
      requete.onupgradeneeded = () => requete.result.createObjectStore('conditions');
      requete.onsuccess = () => {
        const base = requete.result;
        const transaction = base.transaction('conditions', 'readwrite');
        transaction.objectStore('conditions').put(attendu, 'dernieres');
        transaction.oncomplete = () => {
          base.close();
          resolve();
        };
      };
      requete.onerror = () => reject(requete.error);
    });
    maintenant(PREPAREE_A);
    const { sortie, cache } = installer(fabrique, true);

    expect(await sortie.pour(ANGERS)).toBeNull();
    expect((await sortie.preparer(ANGERS)).statut).toBe('prete');

    expect(await cache.lire()).toEqual(attendu);
    expect(await sortie.pour(ANGERS)).not.toBeNull();
  });

  it("given une sortie gardée dont l'eau est mal formée, when on demande les conditions en mode avion, then la sortie est ignorée sans erreur", async () => {
    const fabrique = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const requete = fabrique.open('leurio', 2);
      requete.onupgradeneeded = () => {
        requete.result.createObjectStore('conditions');
        requete.result.createObjectStore('sortie');
      };
      requete.onsuccess = () => {
        const base = requete.result;
        const transaction = base.transaction('sortie', 'readwrite');
        transaction.objectStore('sortie').put(
          {
            lieu: ANGERS,
            prepareeA: PREPAREE_A.toISOString(),
            heures: [{ heure: PREPAREE_A.toISOString(), pressionHpa: 1000, pressionTendance48h: 0, nuages: 1, vent: 1 }],
            eau: { statut: 'connue', tempEauC: 'chaude', source: 'capteur' },
            debit: null,
          },
          'preparee',
        );
        transaction.oncomplete = () => {
          base.close();
          resolve();
        };
      };
      requete.onerror = () => reject(requete.error);
    });
    maintenant(PREPAREE_A);
    const { conditions } = installer(fabrique, false);

    const resultat = await conditions.releve({ lieu: ANGERS, moment: PREPAREE_A });

    expect(resultat.mention).toBeUndefined();
    expect(resultat.moinsPrecis).toBe(true);
  });
});
