/*
 * US 17 : quand les tuiles autour d'un lieu sont mises en cache (PLAN §4). Contrat de TuilesService : voir tuiles.service.spec.ts.
 *  - SpotsService.ajouter(saisie) appelle TuilesService.mettreEnCacheAutour({ latitude: lat, longitude: lng }) du spot enregistré.
 *  - SortieService.preparer(lieu) appelle TuilesService.mettreEnCacheAutour(lieu) en ligne ; hors ligne, rien n'est tenté.
 *  - Ni l'un ni l'autre n'attend les tuiles, et un échec des tuiles ne change pas leur résultat.
 * Doubles : TuilesService, sources des spots, WeatherProvider, Hub'Eau, eau ; IndexedDB = fake-indexeddb.
 */
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { INDEXED_DB } from './conditions-cache';
import { HubeauService } from './hubeau.service';
import { SortieService } from './sortie.service';
import { SOURCE_SPOTS, SpotsService } from './spots.service';
import { TemperatureEauService } from './temperature-eau.service';
import { TuilesService } from './tuiles.service';
import { WeatherProvider } from './weather-provider';

const HEURE_MS = 3_600_000;
const saisie = { nom: 'Pont de Cé', lat: 47.43, lng: -0.52, categorie: 2 as const, milieu: 'riviere' as const, departement: '49' };
const ANGERS = { latitude: 47.47, longitude: -0.55 };

afterEach(() => vi.restoreAllMocks());

describe('Tuiles de carte : déclenchement (US 17)', () => {
  function spots(mettreEnCacheAutour: () => Promise<void>) {
    TestBed.configureTestingModule({
      providers: [
        { provide: TuilesService, useValue: { mettreEnCacheAutour } },
        { provide: SOURCE_SPOTS, useValue: { uid: async () => 'u1', documents: async () => [], ajouter: vi.fn(async () => undefined) } },
      ],
    });
    return TestBed.inject(SpotsService);
  }

  it('given du réseau, when un spot est enregistré, then les tuiles autour de ses coordonnées sont mises en cache', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const mettreEnCacheAutour = vi.fn(async () => undefined);

    await spots(mettreEnCacheAutour).ajouter(saisie);

    expect(mettreEnCacheAutour).toHaveBeenCalledTimes(1);
    expect(mettreEnCacheAutour).toHaveBeenCalledWith({ latitude: 47.43, longitude: -0.52 });
  });

  it('given des tuiles qui ne finissent pas ou échouent, when un spot est enregistré, then l\'ajout se termine quand même', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await expect(spots(() => new Promise<void>(() => undefined)).ajouter(saisie)).resolves.toBeUndefined();
    TestBed.resetTestingModule();
    await expect(spots(() => Promise.reject(new Error('boom'))).ajouter(saisie)).resolves.toBeUndefined();
  });

  function sortie(mettreEnCacheAutour: () => Promise<void>, enLigne: boolean) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(enLigne);
    const maintenant = new Date('2026-11-24T08:00:00Z');
    const heures = Array.from({ length: 49 }, (_, i) => ({
      disponible: true as const,
      heure: new Date(maintenant.getTime() + i * HEURE_MS),
      pressionHpa: 1000,
      pressionTendance48h: { disponible: true as const, ecartHpa: 0 },
      couvertureNuageusePct: 10,
      ventKmh: 5,
      temperatureAirC: 8,
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: INDEXED_DB, useValue: new IDBFactory() },
        { provide: TuilesService, useValue: { mettreEnCacheAutour } },
        { provide: TemperatureEauService, useValue: { temperatureEauProche: async () => ({ statut: "température de l'eau inconnue" }) } },
        { provide: HubeauService, useValue: { tendanceDebitProche: async () => ({ statut: "Hub'Eau indisponible" }) } },
        { provide: WeatherProvider, useValue: { previsions48h: async () => ({ disponible: true as const, heures }), meteoPrevue: async () => ({ disponible: false }) } },
      ],
    });
    return TestBed.inject(SortieService);
  }

  it('given du réseau, when la sortie d\'un lieu est préparée, then les tuiles autour de ce lieu sont mises en cache', async () => {
    const mettreEnCacheAutour = vi.fn(async () => undefined);

    const resultat = await sortie(mettreEnCacheAutour, true).preparer(ANGERS);

    expect(resultat.statut).toBe('prete');
    expect(mettreEnCacheAutour).toHaveBeenCalledTimes(1);
    expect(mettreEnCacheAutour).toHaveBeenCalledWith(ANGERS);
  });

  it('given des tuiles qui ne finissent pas, when la sortie est préparée, then elle est prête sans les attendre', async () => {
    const resultat = await sortie(() => new Promise<void>(() => undefined), true).preparer(ANGERS);

    expect(resultat.statut).toBe('prete');
  });

  it('given des tuiles qui échouent, when la sortie est préparée, then elle est prête', async () => {
    const resultat = await sortie(() => Promise.reject(new Error('boom')), true).preparer(ANGERS);

    expect(resultat.statut).toBe('prete');
  });

  it('given l\'appareil en mode avion, when on prépare la sortie, then aucune tuile n\'est demandée', async () => {
    const mettreEnCacheAutour = vi.fn(async () => undefined);

    const resultat = await sortie(mettreEnCacheAutour, false).preparer(ANGERS);

    expect(resultat.statut).toBe('hors ligne');
    expect(mettreEnCacheAutour).not.toHaveBeenCalled();
  });
});
