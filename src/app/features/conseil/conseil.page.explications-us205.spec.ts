/*
 * US 205 : explication des leurres écartés (brochet fermé) sur l'écran Conseil, près du top 3 (PLAN §6).
 * Maquette de référence (variante A) : docs/maquettes/us-205-leurres-ecartes-brochet.html.
 *
 * Contrat du DOM (neutre sur les balises autres que ceux-ci) :
 *  - l'explication est un élément `[role="note"]` unique, placé après le titre `h2` « Ton top 3 » et avant la première
 *    carte de conseil (`article` qui contient « Animation : ») ; son texte est celui de `resultat.explications`
 *    suivi d'un point final ;
 *  - l'explication n'est plus dans le pourquoi des cartes, et n'est jamais dans le bandeau « Réglementation »
 *    (`section`/`article` qui porte le titre `h2`/`h3` « Réglementation ») ;
 *  - le bandeau reste inchangé : il affiche toujours l'alerte « Brochet fermé en 2e catégorie ».
 * Le moment « maintenant » est la date système simulée.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { CatalogService, Espece, Federation } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import especesReelles from '../../../assets/data/species.json';
import { ConseilPage } from './conseil.page';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};
const FEDERATION_49: Federation = {
  departement: '49',
  nom: 'Fédération de pêche du Maine-et-Loire',
  url: 'https://fedepeche49.example',
} as Federation;

const HORS_FERMETURE = new Date('2026-11-09T13:00:00Z');
const FERMETURE_BROCHET = new Date('2027-03-10T13:00:00Z');
const PRINTEMPS_BROCHET_OUVERT = new Date('2027-05-10T13:00:00Z');

const QUOTA = 'Quota : 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum';
const MENTION = "À vérifier dans l'arrêté de ton département";

const ESPECES = especesReelles as unknown as Espece[];

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

const conseil = (surcharge: Partial<Conseil>): Conseil => ({
  typeId: 'shad',
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 10,
  pourquoi: ['Eau froide : une animation lente convient.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
  ...surcharge,
});
const TROIS_CONSEILS: Conseil[] = [
  conseil({ typeId: 'shad', score: 9 }),
  conseil({ typeId: 'ver', score: 7 }),
  conseil({ typeId: 'jig', score: 5 }),
];

interface Reglages {
  maintenant?: Date;
  especes?: Espece[];
  federation?: Federation | undefined;
  explications?: string[];
}

async function afficher(reglages: Reglages = {}) {
  const { maintenant = HORS_FERMETURE, especes = ESPECES, explications = [] } = reglages;
  // `federation: undefined` doit vraiment donner « aucune fédération connue » : pas de valeur par défaut dans ce cas.
  const federation = 'federation' in reglages ? reglages.federation : FEDERATION_49;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(maintenant);
  const demandesFederation: string[] = [];
  const resultat: ResultatConseil = { conseils: TROIS_CONSEILS, explications };
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      {
        provide: CatalogService,
        useValue: {
          federation: async (departement: string) => {
            demandesFederation.push(departement);
            return federation;
          },
          typesDeLeurres: async () => [
            { id: 'shad', nom: 'Shad' },
            { id: 'ver', nom: 'Ver souple finesse' },
            { id: 'jig', nom: 'Jig à jupe' },
          ],
          animations: async () => [{ id: 'tiree', nom: 'Tirée-relâchée' }],
          couleurs: async () => [{ id: 'gardon', nom: 'Gardon' }],
          especes: async () => especes,
        },
      },
      {
        provide: ConditionsService,
        useValue: {
          releve: async (): Promise<ReleveActuel> => ({ conditions: { ...CONDITIONS }, pressionHpa: 1012, moinsPrecis: false }),
        },
      },
      {
        provide: AstroService,
        useValue: {
          soleil: (_lieu: unknown, moment: Date): SoleilDuJour => {
            const jour = moment.toISOString().slice(0, 10);
            return { lever: new Date(`${jour}T06:30:00Z`), coucher: new Date(`${jour}T16:30:00Z`) };
          },
          lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      { provide: MoteurService, useValue: { conseiller: async (): Promise<ResultatConseil> => resultat } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  const stabiliser = async () => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  await stabiliser();
  return { page: fixture.nativeElement as HTMLElement, stabiliser, demandesFederation };
}

afterEach(() => vi.useRealTimers());

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');
const contient = (texte: string | null | undefined, voulu: string): boolean => compact(texte).includes(compact(voulu));

function bandeau(page: HTMLElement): HTMLElement {
  const titre = [...page.querySelectorAll('h2, h3')].find((t) => t.textContent?.trim() === 'Réglementation');
  const racine = titre?.closest('section, article, ion-card');
  if (!racine) throw new Error('aucun bandeau « Réglementation »');
  return racine as HTMLElement;
}
const cartesConseil = (page: HTMLElement): HTMLElement[] =>
  [...page.querySelectorAll<HTMLElement>('section, article, ion-card')].filter(
    (e) => contient(e.textContent, 'Animation :') && !e.querySelector('section, article, ion-card'),
  );
const EXPLICATION = "Brochet fermé : certains leurres sont interdits jusqu'au 24/04";
const SUFFIXE = '(si tu es en 2e catégorie)';
const EXPLICATION_INCONNUE = `${EXPLICATION} ${SUFFIXE}`;

const occurrences = (texte: string | null | undefined, voulu: string): number =>
  compact(texte).split(compact(voulu)).length - 1;
const notes = (page: HTMLElement): HTMLElement[] =>
  [...page.querySelectorAll<HTMLElement>('[role="note"]')].filter((n) => contient(n.textContent, 'Brochet fermé'));
const titreTop3 = (page: HTMLElement): HTMLElement => {
  const t = [...page.querySelectorAll<HTMLElement>('h2')].find((h) => h.textContent?.trim() === 'Ton top 3');
  if (!t) throw new Error('titre « Ton top 3 » introuvable');
  return t;
};
const avant = (a: Node, b: Node): boolean => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('ConseilPage : explication des leurres écartés près du top 3 (US 205)', () => {
  it('critère 1 : given brochet fermé et des leurres écartés (catégorie connue), when j\'ouvre l\'écran Conseil, then l\'explication « Brochet fermé : certains leurres sont interdits jusqu\'au JJ/MM » est affichée une seule fois, après « Ton top 3 » et avant la première carte, terminée par un point', async () => {
    const { page } = await afficher({ maintenant: FERMETURE_BROCHET, explications: [EXPLICATION] });

    const trouvees = notes(page);
    expect(trouvees, 'une seule explication [role="note"]').toHaveLength(1);
    const note = trouvees[0];
    expect(compact(note.textContent)).toBe(compact(`${EXPLICATION}.`));
    expect(contient(note.textContent, SUFFIXE)).toBe(false);
    expect(avant(titreTop3(page), note), 'après le titre « Ton top 3 »').toBe(true);
    const cartes = cartesConseil(page);
    expect(cartes).toHaveLength(3);
    expect(avant(note, cartes[0]), 'avant la première carte').toBe(true);
    expect(occurrences(page.textContent, EXPLICATION)).toBe(1);
  });

  it('critère 1 : given l\'explication affichée sous « Ton top 3 », when je regarde les 3 cartes, then aucune ne se termine par l\'explication ni ne parle de « Brochet fermé » (retirée du pourquoi)', async () => {
    const { page } = await afficher({ maintenant: FERMETURE_BROCHET, explications: [EXPLICATION] });

    expect(notes(page)).toHaveLength(1);
    const cartes = cartesConseil(page);
    expect(cartes).toHaveLength(3);
    for (const carte of cartes) {
      expect(contient(carte.textContent, 'Eau froide : une animation lente convient.')).toBe(true);
      expect(contient(carte.textContent, 'Brochet fermé')).toBe(false);
      expect(contient(carte.textContent, 'certains leurres sont interdits')).toBe(false);
    }
  });

  it('critère 2 : given brochet fermé, leurres écartés et catégorie inconnue, when j\'ouvre l\'écran Conseil, then l\'explication affichée comporte « (si tu es en 2e catégorie) »', async () => {
    const { page } = await afficher({ maintenant: FERMETURE_BROCHET, explications: [EXPLICATION_INCONNUE] });

    const trouvees = notes(page);
    expect(trouvees, 'une seule explication [role="note"]').toHaveLength(1);
    expect(compact(trouvees[0].textContent)).toBe(compact(`${EXPLICATION_INCONNUE}.`));
    expect(contient(trouvees[0].textContent, SUFFIXE)).toBe(true);
  });

  it('critère 3 : given brochet ouvert (aucune explication du moteur), when j\'ouvre l\'écran Conseil, then aucune explication de fermeture du brochet n\'est affichée', async () => {
    const { page } = await afficher({ maintenant: PRINTEMPS_BROCHET_OUVERT, explications: [] });

    expect(cartesConseil(page)).toHaveLength(3);
    expect(notes(page)).toHaveLength(0);
    expect(contient(page.textContent, 'certains leurres sont interdits')).toBe(false);
  });

  it('critère 3 : given brochet fermé mais aucun leurre écarté (explications vides), when j\'ouvre l\'écran Conseil, then aucune explication de fermeture du brochet n\'est affichée sous « Ton top 3 »', async () => {
    const { page } = await afficher({ maintenant: FERMETURE_BROCHET, explications: [] });

    expect(cartesConseil(page)).toHaveLength(3);
    expect(notes(page)).toHaveLength(0);
    expect(contient(page.textContent, 'certains leurres sont interdits')).toBe(false);
  });

  it('critère 4 : given brochet fermé et le bandeau qui alerte « Brochet fermé en 2e catégorie », when j\'ouvre l\'écran Conseil, then le bandeau reste inchangé et l\'explication des leurres écartés apparaît en plus, hors du bandeau', async () => {
    const { page } = await afficher({ maintenant: FERMETURE_BROCHET, explications: [EXPLICATION_INCONNUE] });

    const texteBandeau = bandeau(page).textContent;
    expect(contient(texteBandeau, 'Brochet fermé en 2e catégorie')).toBe(true);
    expect(contient(texteBandeau, QUOTA)).toBe(true);
    expect(contient(texteBandeau, MENTION)).toBe(true);
    expect(contient(texteBandeau, 'certains leurres sont interdits')).toBe(false);
    const trouvees = notes(page);
    expect(trouvees, 'explication affichée').toHaveLength(1);
    expect(bandeau(page).contains(trouvees[0])).toBe(false);
  });
});
