/*
 * US 64, PLAN §6 : sous « Heures légales », la mention « À vérifier dans l'arrêté de ton département » et le lien
 * vers la fédération du département des conditions (maquette, note 8). Doubles : PositionService, ConditionsService,
 * AstroService et CatalogService.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { PositionService } from '../../core/data/position.service';
import { ConseilPage } from './conseil.page';
import { ecranDe, ouvrirReglementation, stabiliser } from './conseil.page.aides';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';

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

async function afficher(federation: (departement: string) => Promise<unknown>) {
  const demandes: string[] = [];
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
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
          federation: (d: string) => {
            demandes.push(d);
            return federation(d);
          },
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  await stabiliser(fixture);
  // US 295 : la mention et le lien sont dans la feuille « Réglementation », sous les heures légales ; la ligne d'état l'ouvre.
  const feuille = await ouvrirReglementation(ecranDe(fixture));
  return { page: fixture.nativeElement as HTMLElement, demandes, feuille };
}

const MENTION = "À vérifier dans l'arrêté de ton département";

describe('ConseilPage : mention réglementaire des heures légales (US 64, PLAN §6)', () => {
  it("given les conditions du département 49 et sa fédération, when la carte s'affiche, then la mention et le lien vers la fédération (nouvel onglet) sont sous les heures légales", async () => {
    const { feuille, demandes } = await afficher(async () => ({
      departement: '49',
      nom: 'Fédération de pêche de Maine-et-Loire',
      url: 'https://www.federation-peche49.fr',
    }));

    expect(demandes).toEqual(['49']);
    expect(feuille.textContent).toContain(MENTION);
    expect(feuille.textContent!.indexOf('Heures légales')).toBeLessThan(feuille.textContent!.indexOf(MENTION));
    const lien = feuille.querySelector('a');
    expect(lien?.textContent?.trim()).toBe('Fédération de pêche de Maine-et-Loire ↗');
    expect(lien?.getAttribute('href')).toBe('https://www.federation-peche49.fr');
    expect(lien?.getAttribute('target')).toBe('_blank');
    expect(lien?.getAttribute('rel')).toContain('noopener');
  });

  it("given aucune fédération pour le département, when la carte s'affiche, then seule la mention est écrite, sans lien", async () => {
    const { feuille } = await afficher(async () => undefined);

    expect(feuille.textContent).toContain(MENTION);
    expect(feuille.querySelector('a')).toBeNull();
  });
});
