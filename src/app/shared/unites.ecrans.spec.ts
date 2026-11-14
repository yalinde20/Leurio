/*
 * US 93, critère 4 : « Given Préférences est ouvert, when je choisis l'autre système dans Unités, then les températures, tailles et poids
 * de l'app s'affichent dans ce système » (décision I1 : l'affichage change partout, les saisies restent métriques ; le vent et la pression
 * ne changent pas). Le choix est lu dans `UnitesService` (voir unites.spec.ts) : ici on le pose dans le localStorage (`leurio.unites`)
 * avant de créer l'écran, puis on regarde ce que l'écran affiche. Par défaut (rien dans le stockage) tout reste métrique, comme avant.
 *
 * Contrats attendus (à créer ou à étendre) :
 *  - `Conditions.unites?: 'metriques' | 'imperiales'` (src/app/core/engine/conditions.ts), optionnel, défaut métrique : l'entrée du moteur
 *    (TypeScript pur). ConseilPage la renseigne seulement en impérial (en métrique elle est absente, les conditions restent celles du relevé).
 *    Les règles `temperature` et `taille` écrivent leurs phrases dans ce système ; `Conseil.taille` reste en cm ou en g (donnée, pas affichage).
 *  - src/app/features/conseil/conseil-format.ts : `formaterTaille(taille, unites = 'metriques')`, `formaterPoidsTete(plage, unites = 'metriques')`,
 *    `detailDuConseil(rang, conseil, contenu, unites = 'metriques')` et `ligneDeLaBoite(correspondance, contenu, unites = 'metriques')`.
 *  - src/app/core/regulation/sizes.ts : `libelleTailleMinimale(espece, unites = 'metriques')`.
 *  - ConseilPage (carte « Conditions », cartes du top 3) et BoitePage (liste) lisent `UnitesService`.
 * Les espaces (insécables ou non) ne comptent pas dans les comparaisons.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../core/data/astro.service';
import { Animation, CatalogService, Couleur, Espece, TypeLeurre } from '../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../core/data/conditions.service';
import { MoteurService } from '../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../core/data/position.service';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../core/data/tackle-box.service';
import { Conditions } from '../core/engine/conditions';
import { Correspondance } from '../core/engine/matcher';
import { Conseil, ContenuMoteur, PoidsMoteur, recommander, ResultatConseil } from '../core/engine/scorer';
import { libelleTailleMinimale } from '../core/regulation/sizes';
import { BoitePage } from '../features/boite/boite.page';
import { detailDuConseil, formaterPoidsTete, formaterTaille, ligneDeLaBoite } from '../features/conseil/conseil-format';
import { ConseilPage } from '../features/conseil/conseil.page';
import poidsReels from '../../assets/data/engine-weights.json';

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  TestBed.resetTestingModule();
  localStorage.clear();
});

// ---------------------------------------------------------------------------------------------------------------------
// ConseilPage : carte « Conditions » et cartes du top 3
// ---------------------------------------------------------------------------------------------------------------------
const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-09T06:32:00Z'), coucher: new Date('2026-11-09T17:01:00Z') };
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
const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'jig', nom: 'Jig à jupe' },
] as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tirée-relâchée' },
  { id: 'gratte', nom: 'Gratté' },
] as Animation[];
const COULEURS = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];
const TOP: ResultatConseil = {
  conseils: [
    { typeId: 'shad', techniqueId: 'tiree', especeCode: 'SAN', score: 9, pourquoi: ['Phrase.'], couleur: 'gardon', taille: { valeur: 8, unite: 'cm' } },
    { typeId: 'jig', techniqueId: 'gratte', especeCode: 'SAN', score: 7, pourquoi: ['Phrase.'], couleur: 'gardon', taille: { valeur: 10, unite: 'g' } },
  ],
  explications: [],
};

async function afficherConseil(unites?: 'metriques' | 'imperiales') {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
  if (unites) localStorage.setItem('leurio.unites', unites);
  const appelsMoteur: Conditions[] = [];
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      {
        provide: CatalogService,
        useValue: {
          federation: async () => undefined,
          typesDeLeurres: async () => TYPES,
          animations: async () => ANIMATIONS,
          couleurs: async () => COULEURS,
        },
      },
      { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
      { provide: AstroService, useValue: { soleil: (): SoleilDuJour => SOLEIL, lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async (conditions: Conditions) => {
            appelsMoteur.push(conditions);
            return TOP;
          },
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  return { texte: compact((fixture.nativeElement as HTMLElement).textContent), appelsMoteur };
}

describe('Unités dans l\'écran Conseil (US 93)', () => {
  it('critère 4 : given le système impérial, when la carte « Conditions » s\'affiche, then la température de l\'eau est en °F (52,7 °F pour 11,5 °C) et le vent et la pression ne changent pas', async () => {
    const { texte } = await afficherConseil('imperiales');

    expect(texte).toContain(compact("Température de l'eau : 52,7 °F"));
    expect(texte).not.toContain(compact('11,5 °C'));
    expect(texte).toContain(compact('Vent : 12 km/h'));
    expect(texte).toContain(compact('Pression : 1012 hPa'));
  });

  it('critère 4 : given le système impérial, when les cartes du top 3 s\'affichent, then la taille est en po (8 cm : 3,1 po) et le poids en oz (10 g : 0,35 oz)', async () => {
    const { texte } = await afficherConseil('imperiales');

    expect(texte).toContain(compact('Taille : 3,1 po'));
    expect(texte).toContain(compact('Poids : 0,35 oz'));
    expect(texte).not.toContain(compact('8 cm'));
    expect(texte).not.toContain(compact('10 g'));
  });

  it('critère 4 : given le système impérial, when le top 3 est demandé, then le moteur reçoit « imperiales » dans ses conditions (le reste des conditions est inchangé, en °C)', async () => {
    const { appelsMoteur } = await afficherConseil('imperiales');

    expect(appelsMoteur).toHaveLength(1);
    expect(appelsMoteur[0].unites).toBe('imperiales');
    expect(appelsMoteur[0].tempEau).toBe(11.5);
  });

  it('critère 4 : given aucun choix d\'unités, when l\'écran Conseil s\'affiche, then tout reste en métrique comme avant et le moteur n\'est pas en impérial', async () => {
    const { texte, appelsMoteur } = await afficherConseil();

    expect(texte).toContain(compact("Température de l'eau : 11,5 °C"));
    expect(texte).toContain(compact('Taille : 8 cm'));
    expect(texte).toContain(compact('Poids : 10 g'));
    expect(texte).not.toContain('°F');
    expect(appelsMoteur[0].unites ?? 'metriques').toBe('metriques');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Le moteur : phrases du « pourquoi » (entrée `unites` des conditions)
// ---------------------------------------------------------------------------------------------------------------------
describe('Unités dans les phrases du moteur (US 93)', () => {
  const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };
  const espece = {
    code: 'SAN',
    nom: 'Sandre',
    tempEauC: { active: [12, 24], ralentie: [4, 12], quasiNulle: [0, 4] },
    postes: [],
    proies: [],
    tailleMinCm: null,
    fermetureAvecBrochet: false,
    verifDepartementPrintemps: false,
    ...FICHE,
  } as Espece;
  const animation = { id: 'lente', nom: 'lente', geste: 'Geste.', vitesse: 'lent', erreurAEviter: 'Rien.', difficulte: 1, videos: [], rythme: 'lent', ...FICHE } as unknown as Animation;
  const type = (id: string, gamme: Partial<TypeLeurre>): TypeLeurre =>
    ({ id, nom: id, article: 'un', especes: ['SAN'], techniques: ['lente'], zoneNage: 'mi-eau', interditFermetureBrochet: false, ...gamme, ...FICHE }) as TypeLeurre;
  const contenu: ContenuMoteur = {
    especes: [espece],
    typesLeurres: [type('shad', { tailleCm: [7, 12] }), type('cuiller', { poidsG: [7, 21] })],
    animations: [animation],
    couleurs: [],
  };
  const conditions = (surcharge: Partial<Conditions> = {}): Conditions => ({ ...CONDITIONS, tempEau: 11.5, sourceTempEau: 'saisie', especeCible: 'SAN', ...surcharge });
  const pourquoi = (conseils: Conseil[], typeId: string): string => compact(conseils.find((c) => c.typeId === typeId)?.pourquoi.join(' '));

  it('critère 4 : given le système impérial, when le moteur explique son conseil, then la température est en °F et la taille en po ou en oz dans les phrases du « pourquoi »', () => {
    const conseils = recommander(conditions({ unites: 'imperiales' }), contenu, poidsReels as PoidsMoteur);

    expect(pourquoi(conseils, 'shad')).toContain(compact('À 52,7 °F'));
    expect(pourquoi(conseils, 'shad')).toContain(compact('autour de 3,3 po'));
    expect(pourquoi(conseils, 'shad')).not.toContain('°C');
    expect(pourquoi(conseils, 'cuiller')).toContain(compact('autour de 0,37 oz'));
    // La donnée reste métrique : seule la phrase change.
    expect(conseils.find((c) => c.typeId === 'shad')?.taille).toEqual({ valeur: 8.5, unite: 'cm' });
  });

  it('critère 4 : given le système métrique ou aucun choix, when le moteur explique son conseil, then les phrases restent en °C, cm et g', () => {
    for (const unites of [undefined, 'metriques' as const]) {
      const conseils = recommander(conditions(unites ? { unites } : {}), contenu, poidsReels as PoidsMoteur);
      expect(pourquoi(conseils, 'shad')).toContain(compact('À 11,5 °C'));
      expect(pourquoi(conseils, 'shad')).toContain(compact('autour de 8,5 cm'));
      expect(pourquoi(conseils, 'cuiller')).toContain(compact('autour de 10,5 g'));
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Détail d'un conseil, ligne « leurre de ma boîte » (US 105), taille minimale légale
// ---------------------------------------------------------------------------------------------------------------------
describe('Unités dans le détail, la ligne de la boîte et la taille minimale (US 93)', () => {
  const types = [
    { id: 'shad', nom: 'Shad', article: 'un', tailleCm: [7, 12], poidsTeteG: [5, 10] },
    { id: 'cuiller', nom: 'Cuillère tournante', article: 'une', poidsG: [3, 10] },
  ] as unknown as TypeLeurre[];
  const couleurs = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];
  const conseil: Conseil = { typeId: 'shad', techniqueId: 'tiree', especeCode: 'SAN', score: 1, pourquoi: ['Phrase.'], couleur: 'gardon', taille: { valeur: 8, unite: 'cm' } };
  const contenuDetail = { types, animations: [{ id: 'tiree', nom: 'Tirée' }] as Animation[], couleurs, especes: [{ code: 'SAN', nom: 'Sandre', postes: [] }] as unknown as Espece[] };
  const leurre = (typeId: string, tailleCm: number, poidsG: number) => ({ id: 'a1', typeId, tailleCm, poidsG, couleur: 'Noir', enAttente: false, createdAt: 1 });

  it('critère 4 : given le système impérial, when le détail d\'un conseil est construit, then la taille est en po et le poids de tête en oz (« 0,18 à 0,35 oz » pour 5 à 10 g)', () => {
    const detail = detailDuConseil(1, conseil, contenuDetail, 'imperiales');

    expect(detail.taille?.libelle).toBe('Taille');
    expect(compact(detail.taille?.valeur)).toBe('3,1po');
    expect(compact(detail.poidsTete)).toBe('0,18à0,35oz');
    expect(compact(formaterPoidsTete([5, 10], 'imperiales'))).toBe('0,18à0,35oz');
    expect(compact(formaterTaille({ valeur: 10, unite: 'g' }, 'imperiales'))).toBe('0,35oz');
  });

  it('critère 4 : given le système métrique ou aucun choix, when le détail est construit, then taille et poids de tête restent en cm et en g', () => {
    for (const detail of [detailDuConseil(1, conseil, contenuDetail), detailDuConseil(1, conseil, contenuDetail, 'metriques')]) {
      expect(compact(detail.taille?.valeur)).toBe('8cm');
      expect(compact(detail.poidsTete)).toBe('5à10g');
    }
  });

  it('critère 4 : given le système impérial, when la ligne « Dans ta boîte / À la place / Il te manque » est construite, then les tailles et poids y sont en po et en oz', () => {
    const dans: Correspondance = { statut: 'dans-ta-boite', typeId: 'shad', leurre: leurre('shad', 10, 14) };
    expect(compact(ligneDeLaBoite(dans, { types, couleurs }, 'imperiales').texte)).toBe(compact('Shad 3,9 po Noir'));

    const place: Correspondance = { statut: 'substitution', typeId: 'shad', leurre: leurre('cuiller', 6, 14) };
    expect(compact(ligneDeLaBoite(place, { types, couleurs }, 'imperiales').texte)).toBe(compact('Cuillère tournante 0,49 oz Noir'));

    const manque: Correspondance = { statut: 'il-te-manque', typeId: 'shad', plage: { min: 7, max: 12, unite: 'cm' }, couleur: 'gardon' };
    expect(compact(ligneDeLaBoite(manque, { types, couleurs }, 'imperiales').texte)).toBe(compact('un shad 2,8–4,7 po couleur gardon'));
    const manquePoids: Correspondance = { statut: 'il-te-manque', typeId: 'cuiller', plage: { min: 3, max: 10, unite: 'g' }, couleur: 'gardon' };
    expect(compact(ligneDeLaBoite(manquePoids, { types, couleurs }, 'imperiales').texte)).toBe(compact('une cuillère tournante 0,11–0,35 oz couleur gardon'));
  });

  it('critère 4 : given le système métrique ou aucun choix, when la ligne de la boîte est construite, then elle reste en cm et en g', () => {
    const dans: Correspondance = { statut: 'dans-ta-boite', typeId: 'shad', leurre: leurre('shad', 7.5, 9) };
    expect(compact(ligneDeLaBoite(dans, { types, couleurs }).texte)).toBe(compact('Shad 7,5 cm Noir'));
    expect(compact(ligneDeLaBoite(dans, { types, couleurs }, 'metriques').texte)).toBe(compact('Shad 7,5 cm Noir'));
  });

  it('critère 4 : given le système impérial, when la taille minimale légale d\'une espèce est affichée, then elle est en po (50 cm : 19,7 po)', () => {
    expect(compact(libelleTailleMinimale({ tailleMinCm: 50 }, 'imperiales'))).toBe('19,7po');
    expect(compact(libelleTailleMinimale({ tailleMinCm: 50 }, 'metriques'))).toBe('50cm');
    expect(compact(libelleTailleMinimale({ tailleMinCm: 50 }))).toBe('50cm');
    expect(libelleTailleMinimale({ tailleMinCm: null }, 'imperiales')).toBe('pas de taille minimale nationale');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// BoitePage : liste des leurres
// ---------------------------------------------------------------------------------------------------------------------
describe('Unités dans la liste de la boîte (US 93)', () => {
  async function afficherBoite(unites?: 'imperiales') {
    if (unites) localStorage.setItem('leurio.unites', unites);
    const docs: DocumentLeurre[] = [
      { id: 'l1', enAttente: false, data: { typeId: 'shad', tailleCm: 10, poidsG: 14, couleur: 'gardon', createdAt: 1 } },
    ];
    const source = { uid: async () => 'u1', ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => (ok(docs), () => undefined) };
    await TestBed.configureTestingModule({
      imports: [BoitePage],
      providers: [
        provideIonicAngular(),
        { provide: SOURCE_TACKLE_BOX, useValue: source },
        { provide: CatalogService, useValue: { typesDeLeurres: async () => [{ id: 'shad', nom: 'Shad' }] as TypeLeurre[], famillesDeLeurres: async () => [] } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(BoitePage);
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
    return compact((fixture.nativeElement as HTMLElement).textContent);
  }

  it('critère 4 : given le système impérial, when la liste de la boîte s\'affiche, then la taille et le poids du leurre sont en po et en oz (10 cm : 3,9 po, 14 g : 0,49 oz)', async () => {
    const texte = await afficherBoite('imperiales');

    expect(texte).toContain(compact('3,9 po · 0,49 oz · gardon'));
    expect(texte).not.toContain(compact('10 cm'));
  });

  it('critère 4 : given aucun choix d\'unités, when la liste de la boîte s\'affiche, then la taille et le poids restent en cm et en g', async () => {
    expect(await afficherBoite()).toContain(compact('10 cm · 14 g · gardon'));
  });
});
