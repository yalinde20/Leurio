/*
 * US 294 : au retour sur le Conseil (depuis Boîte, Spots ou Compte), le spot choisi et le message de « Ma sortie » sont repris (décision A du propriétaire). Maquette : docs/maquettes/us-294-dock-et-avatar.html.
 * Les services sont doublés ; le réseau est `navigator.onLine`.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { IDBFactory } from 'fake-indexeddb';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { INDEXED_DB } from '../../core/data/conditions-cache';
import { GeoService } from '../../core/data/geo.service';
import { HubeauService } from '../../core/data/hubeau.service';
import { MomentJourneeService } from '../../core/data/moment-journee.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { TemperatureEauService } from '../../core/data/temperature-eau.service';
import { TuilesService } from '../../core/data/tuiles.service';
import { WeatherProvider } from '../../core/data/weather-provider';
import { SpotEnregistre, SpotsService } from '../../core/data/spots.service';
import { ConseilChoixStore } from './conseil-choix.store';
import { ConseilPage } from './conseil.page';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };

const PONT: SpotEnregistre = { id: 'p1', nom: 'Pont de Cé', lat: 47.43, lng: -0.52, categorie: 2, departement: '49' };
const MESSAGE = { type: 'prete', texte: "Sortie prête : conditions jusqu'au 11/11 à 13 h" } as const;

/** Ouvre le Conseil comme au retour d'un autre écran : le store garde déjà un spot choisi et un message ; `spotsLus` = ce que lit SpotsService. */
async function ouvrir(spotsLus: SpotEnregistre[] | Error) {
  const positionGps = vi.fn(async () => ANGERS);
  const positionSpot = vi.fn(async (spot: SpotEnregistre) => ({ ...ANGERS, source: 'spot' as const, latitude: spot.lat, longitude: spot.lng }));
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      provideRouter([]),
      { provide: INDEXED_DB, useValue: new IDBFactory() },
      { provide: TuilesService, useValue: { mettreEnCacheAutour: async () => undefined } },
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps, positionSpot } },
      { provide: SpotsService, useValue: { mesSpots: async () => (spotsLus instanceof Error ? Promise.reject(spotsLus) : spotsLus) } },
      { provide: CatalogService, useValue: { federation: async () => undefined, typesDeLeurres: async () => [], animations: async () => [], couleurs: async () => [] } },
      { provide: TemperatureEauService, useValue: { temperatureEauProche: async () => ({ statut: "température de l'eau inconnue" }) } },
      { provide: HubeauService, useValue: { tendanceDebitProche: async () => ({ statut: "Hub'Eau indisponible" }) } },
      {
        provide: WeatherProvider,
        useValue: {
          previsions48h: async () => {
            throw new Error('Failed to fetch');
          },
          meteoPrevue: async () => ({ disponible: false }),
          meteoActuelle: async () => ({ disponible: false }),
          moyenneAirDerniersJours: async () => ({ disponible: false }),
        },
      },
      { provide: MomentJourneeService, useValue: { moment: () => 'jour' } },
      { provide: GeoService, useValue: { departement: () => '49' } },
      { provide: AstroService, useValue: { soleil: () => ({ lever: new Date(0), coucher: new Date(0) }), lune: () => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
      { provide: MoteurService, useValue: { conseiller: async () => ({ conseils: [], explications: [] }) } },
    ],
  }).compileComponents();
  const store = TestBed.inject(ConseilChoixStore);
  store.spot.set(PONT);
  store.messageSortie.set({ ...MESSAGE });
  const fixture = TestBed.createComponent(ConseilPage);
  const stabiliser = async () => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  await stabiliser();
  return { page: fixture.nativeElement as HTMLElement, stabiliser, store, positionGps, positionSpot };
}

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/\s+/g, ' ').trim();
const lieu = (page: HTMLElement) => compact([...page.querySelectorAll('button')].find((b) => compact(b.textContent).startsWith('Lieu'))?.textContent);

describe('ConseilPage : retour sur le Conseil (US 294)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('given un spot choisi et un message de sortie, when le Conseil revient, then le lieu est ce spot, sans position GPS, et le message reste', async () => {
    const { page, store, positionGps, positionSpot } = await ouvrir([PONT]);

    expect(lieu(page)).toContain('Pont de Cé');
    expect(positionSpot).toHaveBeenCalledWith(PONT);
    expect(positionGps).not.toHaveBeenCalled();
    expect(store.spot()).toEqual(PONT);
    expect(compact(page.querySelector('[role="status"]')?.textContent)).toBe(MESSAGE.texte);
  });

  it('given un spot choisi supprimé entre-temps dans Spots, when le Conseil revient, then il revient sur « Ma position » et le message du spot disparaît', async () => {
    const { page, store, positionGps, positionSpot } = await ouvrir([]);

    expect(lieu(page)).toContain('Ma position');
    expect(positionGps).toHaveBeenCalledTimes(1);
    expect(positionSpot).not.toHaveBeenCalled();
    expect(store.spot()).toBeNull();
    expect(page.querySelector('[role="status"]')).toBeNull();
  });

  it('given un spot choisi et les spots illisibles, when le Conseil revient, then le spot gardé reste le lieu', async () => {
    const { page, positionGps } = await ouvrir(new Error('hors ligne'));

    expect(lieu(page)).toContain('Pont de Cé');
    expect(positionGps).not.toHaveBeenCalled();
  });

  it("given un spot renommé dans Spots, when le Conseil revient, then le lieu porte le nom à jour", async () => {
    const { page, store } = await ouvrir([{ ...PONT, nom: 'Pont de Cé amont' }]);

    expect(lieu(page)).toContain('Pont de Cé amont');
    expect(store.spot()!.nom).toBe('Pont de Cé amont');
  });
});
