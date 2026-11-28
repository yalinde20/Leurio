/* US 14 : le résultat d'une préparation lancée pour un lieu ne s'affiche pas une fois le lieu changé. Doubles comme conseil.page.lieu-robustesse.spec.ts. */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition, Spot } from '../../core/data/position.service';
import { ResultatPreparation, SortieService } from '../../core/data/sortie.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { SpotEnregistre, SpotsService } from '../../core/data/spots.service';
import { ConseilPage } from './conseil.page';

const NANTES: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.22, longitude: -1.55, precisionM: 10, departement: '44' };
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-11T06:32:00Z'), coucher: new Date('2026-11-11T17:01:00Z') };
const SEVRE: SpotEnregistre = { id: 's2', nom: 'La Sèvre à Clisson', lat: 47.09, lng: -1.28, categorie: 2, departement: '44' };
const compact = (t: string | null | undefined) => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');

describe('ConseilPage : préparer ma sortie, changement de lieu (US 14)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it("given une préparation en cours, when l'utilisateur change de lieu avant qu'elle finisse, then le message de la préparation du lieu précédent n'est pas affiché", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
    let terminer!: (r: ResultatPreparation) => void;
    const preparer = vi.fn(() => new Promise<ResultatPreparation>((resolve) => (terminer = resolve)));
    await TestBed.configureTestingModule({
      imports: [ConseilPage],
      providers: [
        provideIonicAngular(),
        { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
        { provide: SpotsService, useValue: { mesSpots: async () => [SEVRE] } },
        { provide: SortieService, useValue: { preparer } },
        {
          provide: PositionService,
          useValue: {
            positionGps: async () => NANTES,
            positionSpot: async (spot: Spot): Promise<ResultatPosition> => ({
              disponible: true, source: 'spot', latitude: spot.lat, longitude: spot.lng, precisionM: null, departement: spot.departement,
            }),
          },
        },
        {
          provide: CatalogService,
          useValue: { federation: async () => undefined, typesDeLeurres: async () => [{ id: 'shad', nom: 'Shad' }] as TypeLeurre[], animations: async () => [], couleurs: async () => [], especes: async () => [] },
        },
        {
          provide: ConditionsService,
          useValue: {
            releve: async (): Promise<ReleveActuel> => ({
              conditions: { tempEau: 11, sourceTempEau: 'capteur', debitTendance: 'normal', pressionTendance48h: 0, nuages: 10, vent: 5, moment: 'jour', saison: 'automne', categorie: null, departement: '44', niveau: 'debutant' },
              pressionHpa: 1012,
              moinsPrecis: false,
            }),
          },
        },
        { provide: AstroService, useValue: { soleil: () => SOLEIL, lune: (): LuneDuMoment => ({ phase: 'Pleine lune', fractionEclairee: 0.3 }) } },
        { provide: MoteurService, useValue: { conseiller: async () => ({ conseils: [], explications: [] }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ConseilPage);
    const page = fixture.nativeElement as HTMLElement;
    const stabiliser = async () => {
      for (let i = 0; i < 3; i++) {
        await fixture.whenStable();
        fixture.detectChanges();
      }
    };
    await stabiliser();
    const boutons = () => [...page.querySelectorAll<HTMLButtonElement>('button')];

    boutons().find((b) => compact(b.textContent) === compact('Ma sortie'))!.click();
    await stabiliser();
    boutons().find((b) => compact(b.textContent).startsWith('Lieu'))!.click();
    await stabiliser();
    [...page.querySelectorAll<HTMLElement>('[role="radio"]')].find((l) => compact(l.textContent).startsWith(compact('La Sèvre')))!.click();
    await stabiliser();
    terminer({ statut: 'prete', jusquA: new Date('2026-11-13T12:00:00Z') });
    await stabiliser();

    expect(preparer).toHaveBeenCalledTimes(1);
    expect(page.querySelector('[role="status"]')?.textContent ?? '').not.toContain('Sortie prête');
    expect(page.querySelector('[role="alert"]')).toBeNull();
  });
});
