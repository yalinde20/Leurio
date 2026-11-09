/*
 * US 81 : état « Conseil indisponible pour le moment. », ajouté pendant le développement et validé par le propriétaire
 * (écran 2 bis de docs/maquettes/us-81-top-3-du-moment.html) : le moteur ou le contenu ne répond pas.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { Conditions } from '../../core/engine/conditions';
import { ResultatConseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};

// 9 novembre 2026 (UTC+1) : heures légales 7 h 02 – 18 h 31 ; 13 h à Paris est dans les heures légales.
const SOLEIL: SoleilDuJour = {
  lever: new Date('2026-11-09T06:32:00Z'),
  coucher: new Date('2026-11-09T17:01:00Z'),
};
const DANS_LES_HEURES = new Date('2026-11-09T12:00:00Z');

const CONDITIONS: Conditions = {
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
};

const RELEVE: ReleveActuel = { conditions: CONDITIONS, pressionHpa: 1012, moinsPrecis: false };

interface Pannes {
  moteur?: () => Promise<ResultatConseil>;
  typesDeLeurres?: () => Promise<unknown[]>;
}

async function afficher({ moteur, typesDeLeurres }: Pannes) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(DANS_LES_HEURES);
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      {
        provide: CatalogService,
        useValue: {
          federation: async () => undefined,
          typesDeLeurres: typesDeLeurres ?? (async () => []),
          animations: async () => [],
          couleurs: async () => [],
        },
      },
      { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
      {
        provide: AstroService,
        useValue: {
          soleil: (): SoleilDuJour => SOLEIL,
          lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      {
        provide: MoteurService,
        useValue: {
          conseiller:
            moteur ?? (async (): Promise<ResultatConseil> => ({ conseils: [], explications: [] })),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  return fixture.nativeElement as HTMLElement;
}

afterEach(() => vi.useRealTimers());

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');

describe('ConseilPage : conseil indisponible (US 81, écart validé)', () => {
  const cas: [string, Pannes][] = [
    ['le moteur échoue', { moteur: () => Promise.reject(new Error('poids illisibles')) }],
    [
      'le contenu des leurres ne se charge pas',
      { typesDeLeurres: () => Promise.reject(new Error('lure-types.json')) },
    ],
  ];

  for (const [libelle, pannes] of cas) {
    it(`given ${libelle}, when l'écran Conseil s'affiche, then « Conseil indisponible pour le moment. » remplace les cartes et la carte « Conditions » reste remplie`, async () => {
      const page = await afficher(pannes);

      const texte = compact(page.textContent);
      expect(texte).toContain(compact('Conseil indisponible pour le moment.'));
      expect(texte).not.toContain(compact('Calcul du conseil…'));
      expect(texte).not.toContain(compact('Animation :'));
      expect(texte).toContain(compact("Température de l'eau : 11,5 °C"));
      expect(texte).toContain(compact('Préparer ma sortie'));
    });
  }
});
