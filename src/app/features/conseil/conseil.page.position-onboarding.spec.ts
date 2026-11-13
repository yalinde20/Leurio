import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { OnboardingStore } from '../../core/data/onboarding.store';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { ConseilPage } from './conseil.page';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-06T06:32:00Z'), coucher: new Date('2026-11-06T17:01:00Z') };
const RELEVE: ReleveActuel = {
  conditions: {
    tempEau: 11.5,
    sourceTempEau: 'capteur',
    debitTendance: 'normal',
    pressionTendance48h: -8,
    nuages: 80,
    vent: 12,
    moment: 'jour',
    saison: 'automne',
    categorie: null,
    departement: '49',
    niveau: 'debutant',
  },
  pressionHpa: 1012,
  moinsPrecis: false,
};

async function afficher(avant: (store: OnboardingStore) => void) {
  localStorage.clear();
  TestBed.resetTestingModule();
  const appelsReleve: { niveau?: string }[] = [];
  let appelsGps = 0;
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      {
        provide: PositionService,
        useValue: {
          positionGps: async () => {
            appelsGps++;
            return ANGERS;
          },
        },
      },
      { provide: CatalogService, useValue: { federation: async () => undefined } },
      {
        provide: ConditionsService,
        useValue: {
          releve: async (demande: { niveau?: string }) => {
            appelsReleve.push(demande);
            return RELEVE;
          },
        },
      },
      { provide: AstroService, useValue: { soleil: (): SoleilDuJour => SOLEIL, lune: (): LuneDuMoment => ({ phase: 'Pleine lune', fractionEclairee: 1 }) } },
    ],
  }).compileComponents();
  avant(TestBed.inject(OnboardingStore));
  const fixture = TestBed.createComponent(ConseilPage);
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  return { page: fixture.nativeElement as HTMLElement, appelsReleve, appelsGps: () => appelsGps };
}

describe('ConseilPage et position obtenue à l\'onboarding (US 89)', () => {
  afterEach(() => localStorage.clear());

  it("critère 5 : given la position obtenue à la page 3, when « Conseil » s'affiche, then il l'utilise sans redemander le GPS", async () => {
    const { appelsGps, appelsReleve } = await afficher((store) => {
      store.terminer({ niveau: 'debutant', especesFavorites: [] });
      store.garderPosition(ANGERS);
    });

    expect(appelsGps()).toBe(0);
    expect(appelsReleve).toHaveLength(1);
  });

  it("critère 6 : given la demande du téléphone refusée à la page 3, when « Conseil » s'affiche, then il propose un spot sans redemander le GPS", async () => {
    const { page, appelsGps, appelsReleve } = await afficher((store) => {
      store.terminer({ niveau: 'debutant', especesFavorites: [] });
      store.garderPosition({ disponible: false, motif: 'position refusée' });
    });

    expect(appelsGps()).toBe(0);
    expect(appelsReleve).toHaveLength(0);
    expect(page.textContent?.replace(/\s+/g, ' ')).toContain('Localisation indisponible : active la localisation ou choisis un spot enregistré.');
  });
});
