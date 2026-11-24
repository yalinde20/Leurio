/*
 * US 13 : carte « Conditions » hors ligne. Mêmes doubles que conseil.page.degrade.spec.ts pour la page ; ici le vrai
 * ConditionsService tourne, avec une météo en panne (hors ligne) ou qui répond (en ligne) et un ConditionsCache en mémoire.
 * Les heures sont en heure de Paris : le 29/10/2026 est en heure d'hiver (UTC+1), donc 17:00Z = 18 h.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { IDBFactory } from 'fake-indexeddb';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsCache, INDEXED_DB, ReleveConditions } from '../../core/data/conditions-cache';
import { GeoService } from '../../core/data/geo.service';
import { HubeauService } from '../../core/data/hubeau.service';
import { MomentJourneeService } from '../../core/data/moment-journee.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { TemperatureEauService } from '../../core/data/temperature-eau.service';
import { WeatherProvider } from '../../core/data/weather-provider';
import { ConseilPage } from './conseil.page';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const SOLEIL: SoleilDuJour = { lever: new Date('2026-10-29T06:30:00Z'), coucher: new Date('2026-10-29T16:50:00Z') };

const CACHE_DU_29_OCTOBRE: ReleveConditions = {
  conditions: {
    tempEau: 11.2,
    sourceTempEau: 'capteur',
    debitTendance: 'normal',
    pressionTendance48h: -4,
    nuages: 40,
    vent: 12,
    moment: 'crépuscule',
    saison: 'automne',
    categorie: null,
    departement: '49',
    niveau: 'debutant',
  },
  pressionHpa: 1016,
  obtenuesA: '2026-10-29T17:00:00.000Z',
};

const METEO_A_JOUR = {
  disponible: true,
  pressionHpa: 1010,
  pressionTendance48h: { disponible: true, ecartHpa: -3 },
  couvertureNuageusePct: 50,
  ventKmh: 10,
  temperatureAirC: 12,
  heure: new Date(),
};

async function afficher(enLigne: boolean, meteoPrevue: () => Promise<unknown>, cache?: ReleveConditions) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(enLigne);
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: INDEXED_DB, useValue: new IDBFactory() },
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      { provide: CatalogService, useValue: { federation: async () => undefined } },
      { provide: TemperatureEauService, useValue: { temperatureEauProche: async () => ({ statut: "température de l'eau inconnue" }) } },
      { provide: HubeauService, useValue: { tendanceDebitProche: async () => ({ statut: 'aucune station' }) } },
      { provide: WeatherProvider, useValue: { meteoPrevue } },
      { provide: MomentJourneeService, useValue: { moment: () => 'jour' } },
      { provide: GeoService, useValue: { departement: () => '49' } },
      {
        provide: AstroService,
        useValue: {
          soleil: (): SoleilDuJour => SOLEIL,
          lune: (): LuneDuMoment => ({ phase: 'Pleine lune', fractionEclairee: 1 }),
        },
      },
    ],
  }).compileComponents();
  if (cache) await TestBed.inject(ConditionsCache).ecrire(cache);
  const fixture = TestBed.createComponent(ConseilPage);
  const page = fixture.nativeElement as HTMLElement;
  // On attend que la carte ait fini de charger (sinon un test « sans mention » passerait pendant le chargement).
  await vi.waitFor(async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(carte(page), 'carte « Conditions » absente').not.toBeNull();
    expect(page.textContent).not.toContain('Chargement des conditions');
  });
  return page;
}

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');

function carte(page: HTMLElement): HTMLElement | null {
  const titre = [...page.querySelectorAll('h1, h2, h3, h4, h5, h6, ion-card-title')].find((t) => t.textContent?.trim() === 'Conditions');
  return (titre?.closest('section, article, ion-card') as HTMLElement | null) ?? null;
}

function texteCarte(page: HTMLElement): string {
  const c = carte(page);
  expect(c, 'aucune carte titrée « Conditions »').not.toBeNull();
  return compact(c?.textContent);
}

describe('ConseilPage : date des conditions hors ligne (US 13)', () => {
  afterEach(() => vi.restoreAllMocks());

  it("critère 3 : given l'onglet Conseil affiché hors ligne avec des conditions en cache récupérées le 29/10 à 18 h, when l'utilisateur regarde la carte « Conditions », then elle affiche « Conditions du 29/10 à 18 h »", async () => {
    const page = await afficher(false, () => Promise.reject(new Error('Failed to fetch')), CACHE_DU_29_OCTOBRE);
    expect(texteCarte(page)).toContain(compact('Conditions du 29/10 à 18 h'));
  });

  it("critère 4 : given l'onglet Conseil affiché avec du réseau et des conditions à jour, when l'utilisateur regarde la carte « Conditions », then la mention « Conditions du … » n'est pas affichée", async () => {
    const page = await afficher(true, async () => METEO_A_JOUR, CACHE_DU_29_OCTOBRE);
    expect(texteCarte(page)).not.toContain(compact('Conditions du'));
    expect(compact(page.textContent)).not.toContain(compact('Conditions du'));
  });
});
