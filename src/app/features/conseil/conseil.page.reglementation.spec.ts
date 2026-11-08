/*
 * US 80 : le bandeau « Réglementation » apparaît sur la page Conseil, sous la carte « Conditions ».
 * Doubles : ceux de conseil.page.federation.spec.ts (PositionService, ConditionsService, AstroService, CatalogService).
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { PositionService } from '../../core/data/position.service';
import { ConseilPage } from './conseil.page';

const RELEVE: ReleveActuel = {
  conditions: {
    tempEau: 11.5,
    sourceTempEau: 'estimation',
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

describe('ConseilPage : bandeau « Réglementation » (US 80)', () => {
  it("given les conditions du département 49, when j'ouvre l'onglet Conseil, then un bandeau titré « Réglementation » apparaît sous la carte « Conditions » avec le lien de la fédération du 49", async () => {
    await TestBed.configureTestingModule({
      imports: [ConseilPage],
      providers: [
        provideIonicAngular(),
        {
          provide: PositionService,
          useValue: {
            positionGps: async () => ({
              disponible: true,
              source: 'gps',
              latitude: 47.47,
              longitude: -0.55,
              precisionM: 10,
              departement: '49',
            }),
          },
        },
        { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
        {
          provide: AstroService,
          useValue: {
            soleil: () => ({
              lever: new Date('2026-11-06T06:32:00Z'),
              coucher: new Date('2026-11-06T17:01:00Z'),
            }),
            lune: () => ({ phase: 'Pleine lune', fractionEclairee: 1 }),
          },
        },
        {
          provide: CatalogService,
          useValue: {
            federation: async () => ({
              departement: '49',
              nom: 'Fédération de pêche du Maine-et-Loire',
              url: 'https://fedepeche49.fr',
            }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ConseilPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const titres = [...page.querySelectorAll('h2, h3')].map((t) => t.textContent?.trim());
    const iConditions = titres.indexOf('Conditions');
    const iReglementation = titres.indexOf('Réglementation');
    expect(iReglementation).toBeGreaterThan(-1);
    expect(iReglementation).toBeGreaterThan(iConditions);
    const liens = [...page.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(liens).toContain('https://fedepeche49.fr');
  });
});
