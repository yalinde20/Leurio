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
import { ResultatPreparation, SortieService } from '../../core/data/sortie.service';
import { ConseilChoixStore } from './conseil-choix.store';
import { ConseilPage } from './conseil.page';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };

const PONT: SpotEnregistre = { id: 'p1', nom: 'Pont de Cé', lat: 47.43, lng: -0.52, categorie: 2, departement: '49' };
const MESSAGE = { texte: "Sortie prête : conditions jusqu'au 11/11 à 13 h", jusquA: new Date(Date.now() + 3_600_000) };

/** Ouvre le Conseil comme au retour d'un autre écran : le store garde déjà un spot choisi et un message ; `spotsLus` = ce que lit SpotsService. */
type LectureSpots = SpotEnregistre[] | Error | (() => Promise<SpotEnregistre[]>);
interface Avant {
  spot?: SpotEnregistre | null;
  sortie?: typeof MESSAGE | null;
  /** Double de SortieService.preparer ; sans lui, le vrai service tourne (hors ligne : « Pas de réseau »). */
  preparer?: () => Promise<ResultatPreparation>;
}

async function ouvrir(spotsLus: LectureSpots, avant: Avant = {}) {
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
      { provide: SpotsService, useValue: { mesSpots: () => (typeof spotsLus === 'function' ? spotsLus() : spotsLus instanceof Error ? Promise.reject(spotsLus) : Promise.resolve(spotsLus)) } },
      ...(avant.preparer ? [{ provide: SortieService, useValue: { preparer: avant.preparer, pour: async () => null } }] : []),
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
      // Le moment est toujours dans les heures légales (6 h avant, 6 h après l'instant de l'appel) : l'écran n'est jamais « hors des heures »,
      // quelle que soit l'heure d'exécution ou le moment où le minuteur de l'écran recalcule l'état.
      { provide: AstroService, useValue: { soleil: () => ({ lever: new Date(Date.now() - 6 * 3_600_000), coucher: new Date(Date.now() + 6 * 3_600_000) }), lune: () => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
      { provide: MoteurService, useValue: { conseiller: async () => ({ conseils: [], explications: [] }) } },
    ],
  }).compileComponents();
  const store = TestBed.inject(ConseilChoixStore);
  store.spot.set(avant.spot === undefined ? PONT : avant.spot);
  store.sortiePrete.set(avant.sortie === undefined ? { ...MESSAGE } : avant.sortie);
  const fixture = TestBed.createComponent(ConseilPage);
  // Le composant démarre au premier cycle : le test peut encore agir avant la fin de la lecture des spots.
  const stabiliser = async () => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  await stabiliser();
  return { page: fixture.nativeElement as HTMLElement, stabiliser, store, positionGps, positionSpot, fixture };
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
    expect(compact(page.querySelector('.message-sortie[role="status"]')?.textContent)).toBe(MESSAGE.texte);
  });

  it('given un spot choisi supprimé entre-temps dans Spots, when le Conseil revient, then il revient sur « Ma position » et le message du spot disparaît', async () => {
    const { page, store, positionGps, positionSpot } = await ouvrir([]);

    expect(lieu(page)).toContain('Ma position');
    expect(positionSpot).toHaveBeenCalledTimes(1); // le spot gardé a été appliqué tout de suite, avant la vérification
    expect(positionGps).toHaveBeenCalledTimes(1);
    expect(store.spot()).toBeNull();
    expect(page.querySelector('.message-sortie[role="status"]')).toBeNull();
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

  const AUTRE: SpotEnregistre = { id: 'a1', nom: 'La Sèvre', lat: 47.09, lng: -1.28, categorie: 2, departement: '44' };
  /** Une lecture des spots qui ne se résout qu'à la demande, la première fois seulement (la feuille « Lieu » relit ensuite tout de suite). */
  function lectureALaDemande(ensuite: SpotEnregistre[]) {
    let resoudre!: (spots: SpotEnregistre[]) => void;
    let appels = 0;
    const lecture = () => (appels++ === 0 ? new Promise<SpotEnregistre[]>((r) => (resoudre = r)) : Promise.resolve(ensuite));
    return { lecture, resoudre: (spots: SpotEnregistre[]) => resoudre(spots) };
  }

  it('given le spot gardé et une lecture des spots qui n\'aboutit pas, when le Conseil revient, then le spot est appliqué tout de suite, sans attendre mesSpots', async () => {
    const { lecture } = lectureALaDemande([]);
    const { page, positionSpot, positionGps } = await ouvrir(lecture);

    expect(positionSpot).toHaveBeenCalledWith(PONT);
    expect(positionGps).not.toHaveBeenCalled();
    expect(lieu(page)).toContain('Pont de Cé');
  });

  it("given la lecture des spots en retard, when l'utilisateur choisit un autre spot avant qu'elle finisse, then son choix gagne sur la lecture périmée", async () => {
    const { lecture, resoudre } = lectureALaDemande([AUTRE]);
    const { page, store, stabiliser, positionGps } = await ouvrir(lecture);

    [...page.querySelectorAll('button')].find((b) => compact(b.textContent).startsWith('Lieu'))!.click();
    await stabiliser();
    [...page.querySelectorAll<HTMLElement>('[role="radio"]')].find((r) => compact(r.textContent).includes('La Sèvre'))!.click();
    await stabiliser();
    expect(store.spot()).toEqual(AUTRE);

    resoudre([]); // la lecture périmée dit « supprimé » : elle ne doit rien défaire
    await stabiliser();

    expect(store.spot()).toEqual(AUTRE);
    expect(lieu(page)).toContain('La Sèvre');
    expect(positionGps).not.toHaveBeenCalled();
  });

  it("given une lecture des spots en retard, when l'écran est détruit avant qu'elle finisse, then elle n'écrit rien dans le store et ne demande pas la position", async () => {
    const { lecture, resoudre } = lectureALaDemande([]);
    const { fixture, store, positionGps } = await ouvrir(lecture);

    fixture.destroy();
    resoudre([]); // « spot supprimé » : une instance vivante reviendrait sur la position
    await new Promise((r) => setTimeout(r));

    expect(store.spot()).toEqual(PONT);
    expect(positionGps).not.toHaveBeenCalled();
  });

  it('given une sortie dont les conditions sont arrivées à leur fin, when le Conseil revient, then son message est oublié', async () => {
    const { page, store } = await ouvrir([PONT], { sortie: { texte: 'Sortie prête : passée', jusquA: new Date(Date.now() - 1000) } });

    expect(page.querySelector('.message-sortie[role="status"]')).toBeNull();
    expect(store.sortiePrete()).toBeNull();
  });

  it('given pas de spot gardé (Ma position) et une sortie préparée, when le Conseil revient, then le lieu est la position et le message de succès reste', async () => {
    const { page, store, positionGps, positionSpot } = await ouvrir([], { spot: null });

    expect(lieu(page)).toContain('Ma position');
    expect(positionGps).toHaveBeenCalledTimes(1);
    expect(positionSpot).not.toHaveBeenCalled();
    expect(compact(page.querySelector('.message-sortie[role="status"]')?.textContent)).toBe(MESSAGE.texte);
    expect(store.sortiePrete()?.texte).toBe(MESSAGE.texte);
  });

  it('given « Ma sortie » qui réussit, when le message s\'affiche, then la sortie est gardée dans le store avec sa date de fin', async () => {
    const jusquA = new Date(Date.now() + 86_400_000);
    const { page, store, stabiliser } = await ouvrir([PONT], { sortie: null, preparer: async () => ({ statut: 'prete', jusquA }) });
    page.querySelector<HTMLButtonElement>('nav button')!.click();
    await vi.waitFor(async () => {
      await stabiliser();
      expect(page.querySelector('.message-sortie[role="status"]')).not.toBeNull();
    });

    expect(store.sortiePrete()?.jusquA).toEqual(jusquA);
  });

  it('given « Ma sortie » qui échoue ou sans réseau, when le message d\'erreur s\'affiche, then il n\'est pas gardé pour le retour', async () => {
    for (const resultat of [{ statut: 'hors ligne' }, { statut: 'echec' }] as ResultatPreparation[]) {
      TestBed.resetTestingModule();
      const { page, store, stabiliser } = await ouvrir([PONT], { sortie: null, preparer: async () => resultat });
      page.querySelector<HTMLButtonElement>('nav button')!.click();
      await vi.waitFor(async () => {
        await stabiliser();
        expect(page.querySelector('.message-sortie[role="alert"]')).not.toBeNull();
      });

      expect(store.sortiePrete(), resultat.statut).toBeNull();
    }
  });
});
