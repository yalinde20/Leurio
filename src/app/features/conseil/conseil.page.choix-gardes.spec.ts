/*
 * US 7 : le moment (et l'espèce) choisis sur l'écran « Conseil » sont gardés en mémoire quand l'écran est recréé (retour sur l'onglet,
 * « Voir le conseil » depuis un spot). Un moment gardé a son libellé recalculé ; un moment passé retombe sur « Maintenant ».
 * Le magasin est préparé comme le ferait un premier passage sur l'écran, puis l'écran est recréé.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { LieuDemandeService } from '../../core/data/lieu-demande.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, Spot } from '../../core/data/position.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { SpotEnregistre } from '../../core/data/spots.service';
import { Conditions } from '../../core/engine/conditions';
import { ConseilChoixStore } from './conseil-choix.store';
import { ConseilPage } from './conseil.page';
import { Ecran, ecranDe, ouvrirConditions } from './conseil.page.aides';

const DEMAIN_7H = new Date('2026-11-10T06:00:00Z'); // 7 h à Paris, le 10
const SPOT = { id: 's2', nom: 'Pont de Cé', lat: 47.43, lng: -0.52, categorie: 2, milieu: 'riviere', departement: '49', prive: true } as unknown as SpotEnregistre;

const RELEVE: ReleveActuel = {
  conditions: { tempEau: 11, sourceTempEau: 'capteur', debitTendance: 'normal', pressionTendance48h: 0, nuages: 50, vent: 10, moment: 'jour', saison: 'automne', categorie: null, departement: '49', niveau: 'debutant' } as Conditions,
  pressionHpa: 1012,
  moinsPrecis: false,
};

async function afficher(maintenant: string, demande: SpotEnregistre | null = null) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(maintenant));
  const jour = 24 * 3600 * 1000;
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      {
        provide: PositionService,
        useValue: {
          positionGps: async () => ({ disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' }),
          positionSpot: async (s: Spot) => ({ disponible: true, source: 'spot', latitude: s.lat, longitude: s.lng, precisionM: null, departement: s.departement }),
        },
      },
      { provide: CatalogService, useValue: { federation: async () => undefined, typesDeLeurres: async () => [], animations: async () => [], couleurs: async () => [], especes: async () => [] } },
      { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
      {
        provide: AstroService,
        useValue: {
          soleil: (_l: unknown, m: Date) => {
            const minuit = Math.floor(m.getTime() / jour) * jour;
            return { lever: new Date(minuit + 3 * 3600 * 1000), coucher: new Date(minuit + 20 * 3600 * 1000) };
          },
          lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      { provide: MoteurService, useValue: { conseiller: async () => ({ conseils: [], explications: [] }) } },
    ],
  }).compileComponents();
  const store = TestBed.inject(ConseilChoixStore);
  store.moment.set({ date: DEMAIN_7H, libelle: 'Demain 7 h', mention: 'demain 7 h' });
  if (demande) TestBed.inject(LieuDemandeService).demander(demande);
  const fixture = TestBed.createComponent(ConseilPage);
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  ecran = ecranDe(fixture);
  return fixture.nativeElement as HTMLElement;
}
/** L'écran du dernier `afficher` : la mention du moment est dans la feuille « Conditions ». */
let ecran: Ecran;

afterEach(() => vi.useRealTimers());

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s  ]/g, '');
const boutonMoment = (page: HTMLElement): string =>
  compact([...page.querySelectorAll('button')].find((b) => compact(b.textContent).startsWith('Moment'))?.textContent);

describe('ConseilPage : moment gardé quand l\'écran est recréé (US 7)', () => {
  it('given « Demain 7 h » choisi la veille, when l\'écran est recréé le soir même, then le moment est toujours « Demain 7 h »', async () => {
    const page = await afficher('2026-11-09T13:00:00Z');
    expect(boutonMoment(page)).toContain(compact('Demain 7 h'));
  });

  it('given « Demain 7 h » choisi à 23 h 30, when l\'écran est recréé à 0 h 10 (le jour suivant), then le libellé est celui d\'aujourd\'hui', async () => {
    const page = await afficher('2026-11-09T23:10:00Z'); // 0 h 10 à Paris le 10
    expect(boutonMoment(page)).toContain(compact("Aujourd'hui 7 h"));
    expect(boutonMoment(page)).not.toContain(compact('Demain'));
    expect(compact((await ouvrirConditions(ecran)).textContent)).toContain(compact("Prévisions pour aujourd'hui 7 h"));
  });

  it('given un moment gardé qui est passé, when l\'écran est recréé, then le moment est « Maintenant »', async () => {
    const page = await afficher('2026-11-10T08:00:00Z');
    expect(boutonMoment(page)).toContain(compact('Maintenant'));
    expect(compact((await ouvrirConditions(ecran)).textContent)).not.toContain(compact('Prévisions pour'));
  });

  it('given « Demain 7 h » choisi, when « Voir le conseil » d\'un spot demande son lieu, then le lieu est le spot et le moment est gardé', async () => {
    const page = await afficher('2026-11-09T13:00:00Z', SPOT);
    expect(compact(page.textContent)).toContain(compact('Pont de Cé'));
    expect(boutonMoment(page)).toContain(compact('Demain 7 h'));
  });
});
