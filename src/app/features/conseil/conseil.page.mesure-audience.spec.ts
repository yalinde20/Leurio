import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { SOURCE_COMPTE } from '../../core/data/compte.service';
import { MesureAudienceService } from '../../core/data/mesure-audience.service';
import { SOURCE_PROFIL } from '../../core/data/profil.service';
import { ANALYTICS, PortAnalytics } from '../../core/firebase/mesure-audience';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const MAINTENANT = new Date('2026-11-09T12:34:56.789Z');
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-09T06:32:00Z'), coucher: new Date('2026-11-09T17:01:00Z') };

const CONDITIONS: Conditions = {
  tempEau: 11.6,
  sourceTempEau: 'capteur',
  debitTendance: 'normal',
  pressionTendance48h: -8,
  nuages: 80,
  vent: 14.4,
  moment: 'jour',
  saison: 'automne',
  categorie: null,
  departement: '49',
  niveau: 'debutant',
};
const RELEVE: ReleveActuel = { conditions: CONDITIONS, pressionHpa: 1012, moinsPrecis: false };

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'jig', nom: 'Jig à jupe' },
  { id: 'ver', nom: 'Ver souple finesse' },
] as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tirée-relâchée' },
  { id: 'gratte', nom: 'Gratté' },
  { id: 'dropshot', nom: 'Drop shot' },
] as Animation[];
const COULEURS = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];

const conseil = (surcharge: Partial<Conseil>): Conseil => ({
  typeId: 'shad',
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 10,
  pourquoi: ['Une phrase.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
  ...surcharge,
});
const TOP3: ResultatConseil = {
  conseils: [
    conseil({ typeId: 'shad', techniqueId: 'tiree', score: 9 }),
    conseil({ typeId: 'jig', techniqueId: 'gratte', score: 7 }),
    conseil({ typeId: 'ver', techniqueId: 'dropshot', score: 5 }),
  ],
  explications: [],
};


describe('US 19 : événement du conseil', () => {
  afterEach(() => vi.useRealTimers());

  it('US 19 critère 4 : given Analytics accepté, when le conseil s\'affiche, then conseil_affiche est envoyé sans latitude ni longitude', async () => {
    // Midi : dans les heures légales du soleil simulé, quelle que soit l'heure de la machine.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(MAINTENANT);
    const evenements: { nom: string; parametres: Record<string, unknown> }[] = [];
    const appels: string[] = [];
    const port: PortAnalytics = {
      initialiser: async () => void appels.push('initialiser'),
      envoyer: async (nom, parametres) => void evenements.push({ nom, parametres }),
      desactiver: async () => undefined,
    };
    await TestBed.configureTestingModule({
      imports: [ConseilPage],
      providers: [
        provideIonicAngular(),
        { provide: ANALYTICS, useValue: port },
        { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => 'u1', connecterAnonymement: async () => 'u1', profilExiste: async () => true, ecrireProfil: async () => undefined } },
        { provide: SOURCE_PROFIL, useValue: { mettreAJour: async () => undefined, lireConsentements: async () => ({ analytics: true, video: false }) } },
        { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
        { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
        {
          provide: CatalogService,
          useValue: { federation: async () => undefined, typesDeLeurres: async () => TYPES, animations: async () => ANIMATIONS, couleurs: async () => COULEURS },
        },
        { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
        { provide: AstroService, useValue: { soleil: (): SoleilDuJour => SOLEIL, lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
        { provide: MoteurService, useValue: { conseiller: async () => TOP3 } },
      ],
    }).compileComponents();
    TestBed.inject(MesureAudienceService).demarrer();
    await vi.waitFor(() => expect(appels).toEqual(['initialiser']));

    const fixture = TestBed.createComponent(ConseilPage);
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }

    await vi.waitFor(() => expect(evenements.filter((e) => e.nom === 'conseil_affiche')).toHaveLength(1));
    expect(evenements.find((e) => e.nom === 'conseil_affiche')?.parametres).toEqual({ espece: 'toutes', nombre: 3 });
    expect(JSON.stringify(evenements)).not.toMatch(/47\.47|0\.55|lat|lng/i);
  });
});
