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
import { ecranDe, liensDesCoups, ouvrirAutresCoups, ouvrirReglementation } from './conseil.page.aides';
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
  return { page: fixture.nativeElement as HTMLElement, stabiliser, demandesFederation, fixture };
}

afterEach(() => vi.useRealTimers());

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');
const contient = (texte: string | null | undefined, voulu: string): boolean => compact(texte).includes(compact(voulu));

type Env = Awaited<ReturnType<typeof afficher>>;
/** Le bandeau « Réglementation » : la feuille de la ligne d'état. */
async function bandeau(env: Env): Promise<HTMLElement> {
  await ouvrirReglementation(ecranDe(env.fixture));
  const racine = env.page.querySelector<HTMLElement>('app-bandeau-reglementation');
  if (!racine) throw new Error('aucun bandeau « Réglementation »');
  return racine;
}
/** US 295 : l'explication est dans la feuille « 2 autres coups », sous les coups 02 et 03. Rend les liens des coups de cette feuille. */
async function ouvrirAutres(env: Env): Promise<HTMLElement[]> {
  const feuille = await ouvrirAutresCoups(ecranDe(env.fixture));
  return liensDesCoups(env.page).filter((l) => feuille.contains(l));
}
const EXPLICATION = "Brochet fermé : certains leurres sont interdits jusqu'au 24/04";
const SUFFIXE = '(si tu es en 2e catégorie)';
const EXPLICATION_INCONNUE = `${EXPLICATION} ${SUFFIXE}`;

const occurrences = (texte: string | null | undefined, voulu: string): number =>
  compact(texte).split(compact(voulu)).length - 1;
const notes = (page: HTMLElement): HTMLElement[] =>
  [...page.querySelectorAll<HTMLElement>('[role="note"]')].filter((n) => contient(n.textContent, 'Brochet fermé'));
const avant = (a: Node, b: Node): boolean => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('ConseilPage : explication des leurres écartés près du top 3 (US 205)', () => {
  it('critère 1 : given brochet fermé et des leurres écartés (catégorie connue), when j\'ouvre « 2 autres coups », then l\'explication « Brochet fermé : certains leurres sont interdits jusqu\'au JJ/MM » est affichée une seule fois, après les coups 02 et 03, terminée par un point, et pas sur l\'écran', async () => {
    const env = await afficher({ maintenant: FERMETURE_BROCHET, explications: [EXPLICATION] });
    expect(notes(env.page), 'pas sur l\'écran, seulement dans la feuille').toHaveLength(0);
    expect(contient(env.page.textContent, 'certains leurres sont interdits')).toBe(false);

    const liens = await ouvrirAutres(env);

    const trouvees = notes(env.page);
    expect(trouvees, 'une seule explication [role="note"]').toHaveLength(1);
    const note = trouvees[0];
    expect(compact(note.textContent)).toBe(compact(`${EXPLICATION}.`));
    expect(contient(note.textContent, SUFFIXE)).toBe(false);
    expect(liens).toHaveLength(2);
    expect(avant(liens[1], note), 'après le dernier coup de la feuille').toBe(true);
    expect(occurrences(env.page.textContent, EXPLICATION)).toBe(1);
  });

  it('critère 1 : given l\'explication affichée dans la feuille, when je regarde les 3 coups, then aucun ne parle de « Brochet fermé » (retirée du pourquoi)', async () => {
    const env = await afficher({ maintenant: FERMETURE_BROCHET, explications: [EXPLICATION] });
    await ouvrirAutres(env);

    expect(notes(env.page)).toHaveLength(1);
    const coups = liensDesCoups(env.page);
    expect(coups).toHaveLength(3);
    for (const coup of coups) {
      expect(contient(coup.textContent, 'Brochet fermé')).toBe(false);
      expect(contient(coup.textContent, 'certains leurres sont interdits')).toBe(false);
    }
  });

  it('critère 2 : given brochet fermé, leurres écartés et catégorie inconnue, when j\'ouvre l\'écran Conseil, then l\'explication affichée comporte « (si tu es en 2e catégorie) »', async () => {
    const env = await afficher({ maintenant: FERMETURE_BROCHET, explications: [EXPLICATION_INCONNUE] });
    await ouvrirAutres(env);

    const trouvees = notes(env.page);
    expect(trouvees, 'une seule explication [role="note"]').toHaveLength(1);
    expect(compact(trouvees[0].textContent)).toBe(compact(`${EXPLICATION_INCONNUE}.`));
    expect(contient(trouvees[0].textContent, SUFFIXE)).toBe(true);
  });

  it('critère 3 : given brochet ouvert (aucune explication du moteur), when j\'ouvre l\'écran Conseil, then aucune explication de fermeture du brochet n\'est affichée', async () => {
    const env = await afficher({ maintenant: PRINTEMPS_BROCHET_OUVERT, explications: [] });
    await ouvrirAutres(env);

    expect(liensDesCoups(env.page)).toHaveLength(3);
    expect(notes(env.page)).toHaveLength(0);
    expect(contient(env.page.textContent, 'certains leurres sont interdits')).toBe(false);
  });

  it('critère 3 : given brochet fermé mais aucun leurre écarté (explications vides), when j\'ouvre l\'écran Conseil, then aucune explication de fermeture du brochet n\'est affichée dans « 2 autres coups »', async () => {
    const env = await afficher({ maintenant: FERMETURE_BROCHET, explications: [] });
    await ouvrirAutres(env);

    expect(liensDesCoups(env.page)).toHaveLength(3);
    expect(notes(env.page)).toHaveLength(0);
    expect(contient(env.page.textContent, 'certains leurres sont interdits')).toBe(false);
  });

  it('critère 4 : given brochet fermé et le bandeau qui alerte « Brochet fermé en 2e catégorie », when j\'ouvre l\'écran Conseil, then le bandeau reste inchangé et l\'explication des leurres écartés apparaît en plus, hors du bandeau', async () => {
    const env = await afficher({ maintenant: FERMETURE_BROCHET, explications: [EXPLICATION_INCONNUE] });
    await ouvrirAutres(env);
    const racine = await bandeau(env);

    const texteBandeau = racine.textContent;
    expect(contient(texteBandeau, 'Brochet fermé en 2e catégorie')).toBe(true);
    expect(contient(texteBandeau, QUOTA)).toBe(true);
    expect(contient(texteBandeau, MENTION)).toBe(true);
    expect(contient(texteBandeau, 'certains leurres sont interdits')).toBe(false);
    const trouvees = notes(env.page);
    expect(trouvees, 'explication affichée').toHaveLength(1);
    expect(racine.contains(trouvees[0])).toBe(false);
  });
});
