/*
 * US 89 : ce que l'écran « Conseil » reprend de l'onboarding.
 *   - le niveau choisi (OnboardingStore.lire().niveau) est passé à `ConditionsService.releve({ …, niveau })` ; « debutant » si rien n'est gardé ;
 *   - « Plus tard » (OnboardingStore.localisationDifferee === true) : pour ce lancement, la page ne demande pas le GPS, affiche l'état
 *     « position introuvable » et le message « Localisation indisponible : active la localisation ou choisis un spot enregistré. ».
 */
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

describe('ConseilPage et onboarding (US 89)', () => {
  afterEach(() => localStorage.clear());

  it("critère 9 : given j'ai choisi « Débutant », when l'écran « Conseil » s'affiche, then les conditions sont demandées avec le niveau « debutant »", async () => {
    const { appelsReleve } = await afficher((store) => store.terminer({ niveau: 'debutant', especesFavorites: [] }));

    expect(appelsReleve).toHaveLength(1);
    expect(appelsReleve[0].niveau).toBe('debutant');
  });

  it("critère 9 : given aucun niveau gardé, when l'écran « Conseil » s'affiche, then les conditions sont demandées avec le niveau « debutant » par défaut", async () => {
    const { appelsReleve } = await afficher(() => undefined);

    expect(appelsReleve).toHaveLength(1);
    expect(appelsReleve[0].niveau).toBe('debutant');
  });

  it("critère 9 : given j'ai choisi « Intermédiaire », when l'écran « Conseil » s'affiche, then les conditions sont demandées avec le niveau « intermediaire »", async () => {
    const { appelsReleve } = await afficher((store) => store.terminer({ niveau: 'intermediaire', especesFavorites: ['SAN'] }));

    expect(appelsReleve[0].niveau).toBe('intermediaire');
  });

  it("critère 6 : given j'ai touché « Plus tard », when l'écran « Conseil » s'affiche, then il ne demande pas le GPS et propose de choisir un spot enregistré", async () => {
    const { page, appelsGps, appelsReleve } = await afficher((store) => {
      store.terminer({ niveau: 'debutant', especesFavorites: [] });
      store.localisationDifferee = true;
    });

    expect(appelsGps()).toBe(0);
    expect(appelsReleve).toHaveLength(0);
    expect(page.textContent).toContain('Position introuvable');
    expect(page.textContent?.replace(/\s+/g, ' ')).toContain('Localisation indisponible : active la localisation ou choisis un spot enregistré.');
  });

  it("critère 5 : given la localisation non différée, when l'écran « Conseil » s'affiche, then il demande le GPS une fois et affiche le conseil de ma position", async () => {
    const { appelsGps, appelsReleve } = await afficher((store) => store.terminer({ niveau: 'debutant', especesFavorites: [] }));

    expect(appelsGps()).toBe(1);
    expect(appelsReleve).toHaveLength(1);
  });
});
