/*
 * US 8 : ouvrir la fiche animation depuis un conseil (PLAN §2.2, §3, §5). Maquette : docs/maquettes/us-8-fiche-animation.html.
 *
 * Les tests passent par l'app réelle (App + routes) : écran « Conseil », détail, « Voir l'animation », fiche, retour.
 * Les textes de la fiche viennent du contenu (techniques.json), jamais du code : critère 1 lit le vrai fichier,
 * critère 3 ajoute une 9e animation uniquement dans le contenu fourni au CatalogService.
 *
 * Contrat du DOM supposé (neutre sur les balises) :
 *  - fiche : nom de l'animation, titres exacts « Le geste », « Vitesse », « Erreur à éviter » suivis des textes du contenu ;
 *  - animation absente ou contenu illisible : la fiche s'ouvre quand même (bouton de retour « Détail »), avec
 *    « Cette animation n'est pas encore décrite » et sans emplacement vidéo ;
 *  - rechargement ou lien direct sans conseil en mémoire : retour à /conseil.
 * Temps : faux timers sur `Date`. Maintenant = lundi 9 novembre 2026, 14 h à Paris.
 */
import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, Espece, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import couleursReelles from '../../../assets/data/couleurs.json';
import especesReelles from '../../../assets/data/species.json';
import federationsReelles from '../../../assets/data/federations.json';
import typesReels from '../../../assets/data/lure-types.json';
import techniquesReelles from '../../../assets/data/techniques.json';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const LEVER = new Date('2026-11-09T06:32:00Z');
const COUCHER = new Date('2026-11-09T17:01:00Z');
const JOUR_MS = 24 * 3600 * 1000;
function soleilDu(moment: Date): SoleilDuJour {
  const jours = Math.floor(moment.getTime() / JOUR_MS) - Math.floor(LEVER.getTime() / JOUR_MS);
  return { lever: new Date(LEVER.getTime() + jours * JOUR_MS), coucher: new Date(COUCHER.getTime() + jours * JOUR_MS) };
}
const MAINTENANT = new Date('2026-11-09T13:00:00Z');
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

const TYPES = [{ id: 'shad', nom: 'Shad', poidsTeteG: [5, 10] }] as unknown as TypeLeurre[];
const COULEURS = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];
const ESPECES = [{ code: 'SAN', nom: 'Sandre', postes: ['cassures', 'fond'] }] as unknown as Espece[];

const TECHNIQUES = techniquesReelles as unknown as Animation[];
const TIREE_RELACHEE = TECHNIQUES.find((a) => a.id === 'tiree-relachee')!;

const ANIMATION_TEST = {
  id: 'animation-test',
  nom: 'Animation de test',
  geste: 'Geste de test : trois tapotements puis un silence.',
  vitesse: 'Vitesse de test : ni lente ni rapide.',
  erreurAEviter: "Erreur de test : oublier d'être patient.",
  rythme: 'moyen',
  difficulte: 1,
  videos: [],
} as unknown as Animation;

const conseil = (techniqueId: string): Conseil => ({
  typeId: 'shad',
  techniqueId,
  especeCode: 'SAN',
  score: 10,
  pourquoi: ['Par eau froide, une animation lente convient.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
});

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s     ]/g, '');

interface Options {
  techniqueId: string;
  /** Animations fournies par le contenu (ou une erreur de lecture). */
  animations: Animation[] | 'illisible';
}

/** Le contenu des animations devient illisible une fois le détail ouvert (l'écran Conseil, lui, a pu s'afficher). */
let contenuIllisible = false;

async function ouvrirLApp(options: Options, urlDepart = '/conseil') {
  contenuIllisible = false;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  const top3: ResultatConseil = { conseils: [conseil(options.techniqueId)], explications: [] };
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      provideRouter(routes),
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      {
        provide: CatalogService,
        useValue: {
          federation: async () => undefined,
          especes: async () => ESPECES,
          typesDeLeurres: async () => TYPES,
          animations: async () => {
            if (options.animations === 'illisible' && contenuIllisible) throw new Error('techniques.json illisible');
            return options.animations === 'illisible' ? TECHNIQUES : options.animations;
          },
          couleurs: async () => COULEURS,
        },
      },
      { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
      { provide: AstroService, useValue: { soleil: (_l: unknown, m: Date): SoleilDuJour => soleilDu(m), lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
      { provide: MoteurService, useValue: { conseiller: async () => top3 } },
    ],
  }).compileComponents();
  return demarrer(top3, urlDepart);
}

async function demarrer(_top3: ResultatConseil, urlDepart = '/conseil') {
  const fixture = TestBed.createComponent(App);
  const page = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  const router = TestBed.inject(Router);
  router.setUpLocationChangeListener();
  await router.navigateByUrl(urlDepart);
  await stabiliser();
  return { page, stabiliser, router };
}
type Env = Awaited<ReturnType<typeof demarrer>>;

beforeEach(() => localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] })));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

const boutons = (page: HTMLElement): HTMLElement[] => [...page.querySelectorAll<HTMLElement>('button, ion-button, ion-back-button, a[role="button"]')];
function bouton(page: HTMLElement, texte: string): HTMLElement {
  const b = boutons(page).find((e) => e.getAttribute('role') !== 'tab' && compact(e.textContent).replace('‹', '') === compact(texte));
  if (!b) throw new Error(`Aucun bouton « ${texte} »`);
  return b;
}
const titres = (page: HTMLElement): string[] =>
  [...page.querySelectorAll<HTMLElement>('h1, h2, h3, h4, [role="heading"]')].map((h) => (h.textContent ?? '').trim());
const detailOuvert = (page: HTMLElement): boolean => compact(page.textContent).includes(compact('Détail du conseil'));

async function ouvrirDetail(env: Env): Promise<void> {
  const carte = [...env.page.querySelectorAll<HTMLElement>('section, article, ion-card')].find(
    (e) => compact(e.textContent).includes(compact('Animation :')) && !e.querySelector('section, article, ion-card'),
  );
  if (!carte) throw new Error('Aucune carte de conseil');
  const candidats = [...carte.querySelectorAll<HTMLElement>('*')].filter((e) => compact(e.textContent).includes(compact('Voir le détail')));
  candidats.filter((e) => !candidats.some((autre) => autre !== e && e.contains(autre)))[0].click();
  await env.stabiliser();
}
async function ouvrirFiche(env: Env): Promise<void> {
  await ouvrirDetail(env);
  bouton(env.page, "Voir l'animation").click();
  await env.stabiliser();
}

describe("Fiche animation depuis un conseil (US 8)", () => {
  it("critère 1 : given le détail d'un conseil à animation « tirée-relâchée », when je touche « Voir l'animation », then la fiche s'ouvre avec le nom et les sections « Le geste », « Vitesse », « Erreur à éviter » remplies avec les textes du contenu", async () => {
    const env = await ouvrirLApp({ techniqueId: 'tiree-relachee', animations: TECHNIQUES });
    await ouvrirFiche(env);

    const texte = compact(env.page.textContent);
    expect(detailOuvert(env.page)).toBe(false);
    expect(titres(env.page)).toContain(TIREE_RELACHEE.nom);
    expect(titres(env.page)).toEqual(expect.arrayContaining(['Le geste', 'Vitesse', 'Erreur à éviter']));
    expect(titres(env.page)).not.toContain('La vitesse');
    expect(titres(env.page)).not.toContain("L'erreur à éviter");
    expect(texte).toContain(compact(TIREE_RELACHEE.geste));
    expect(texte).toContain(compact(TIREE_RELACHEE.vitesse));
    expect(texte).toContain(compact(TIREE_RELACHEE.erreurAEviter));
  });

  it("critère 2 : given la fiche animation ouverte, when je touche le bouton de retour, then je reviens au détail du conseil d'où je viens", async () => {
    const env = await ouvrirLApp({ techniqueId: 'tiree-relachee', animations: TECHNIQUES });
    await ouvrirFiche(env);
    expect(detailOuvert(env.page)).toBe(false);

    bouton(env.page, 'Détail').click();
    await env.stabiliser();

    expect(detailOuvert(env.page)).toBe(true);
    expect(compact(env.page.textContent)).toContain(compact("Voir l'animation"));
  });

  it("critère 3 : given une 9e animation ajoutée seulement au contenu, when un conseil la propose et je touche « Voir l'animation », then sa fiche montre ses textes sans changement de code", async () => {
    const env = await ouvrirLApp({ techniqueId: 'animation-test', animations: [...TECHNIQUES, ANIMATION_TEST] });
    await ouvrirFiche(env);

    const texte = compact(env.page.textContent);
    expect(titres(env.page)).toContain(ANIMATION_TEST.nom);
    expect(titres(env.page)).toEqual(expect.arrayContaining(['Le geste', 'Vitesse', 'Erreur à éviter']));
    expect(texte).toContain(compact(ANIMATION_TEST.geste));
    expect(texte).toContain(compact(ANIMATION_TEST.vitesse));
    expect(texte).toContain(compact(ANIMATION_TEST.erreurAEviter));
    expect(texte).not.toContain(compact("Cette animation n'est pas encore décrite"));
  });

  it("critère 4 : given un conseil dont l'animation est absente du contenu, when je touche « Voir l'animation », then la fiche s'ouvre avec « Cette animation n'est pas encore décrite », un retour « Détail » et sans emplacement vidéo", async () => {
    const env = await ouvrirLApp({ techniqueId: 'animation-inconnue', animations: TECHNIQUES });
    await ouvrirFiche(env);

    expect(env.router.url).not.toBe('/conseil');
    expect(detailOuvert(env.page)).toBe(false);
    expect(compact(env.page.textContent)).toContain(compact("Cette animation n'est pas encore décrite"));
    expect(compact(env.page.textContent)).not.toContain(compact("La vidéo de l'animation arrive bientôt"));
    expect(bouton(env.page, 'Détail')).toBeDefined();

    bouton(env.page, 'Détail').click();
    await env.stabiliser();
    expect(detailOuvert(env.page)).toBe(true);
  });

  it("critère 4 : given un contenu d'animations illisible, when je touche « Voir l'animation », then la fiche s'ouvre avec « Cette animation n'est pas encore décrite » au lieu d'une erreur ou d'une page vide", async () => {
    const env = await ouvrirLApp({ techniqueId: 'tiree-relachee', animations: 'illisible' });
    await ouvrirDetail(env);
    contenuIllisible = true;
    bouton(env.page, "Voir l'animation").click();
    await env.stabiliser();

    expect(env.router.url).not.toBe('/conseil');
    expect(compact(env.page.textContent)).toContain(compact("Cette animation n'est pas encore décrite"));
    expect(bouton(env.page, 'Détail')).toBeDefined();
  });

  it("given un lien direct vers une fiche sans conseil en mémoire, when la page s'ouvre, then on est renvoyé à l'écran Conseil", async () => {
    const env = await ouvrirLApp({ techniqueId: 'tiree-relachee', animations: TECHNIQUES }, '/conseil/detail/1/animation');
    await new Promise((r) => setTimeout(r, 50));
    await env.stabiliser();

    expect(env.router.url).toBe('/conseil');
    expect(compact(env.page.textContent)).not.toContain(compact('Le geste'));
  });
});

describe('Fiche animation hors ligne (US 8)', () => {
  it("critère 5 : given l'appareil hors ligne, when j'ouvre une fiche animation, then le geste, la vitesse et l'erreur à éviter s'affichent depuis le contenu embarqué, sans autre requête réseau", async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(MAINTENANT);

    // Le vrai CatalogService lit assets/data/*.json (fichiers embarqués) : on les sert depuis le dépôt, et rien d'autre.
    const fichiers: Record<string, unknown> = {
      'assets/data/techniques.json': techniquesReelles,
      'assets/data/species.json': especesReelles,
      'assets/data/lure-types.json': typesReels,
      'assets/data/couleurs.json': couleursReelles,
      'assets/data/federations.json': federationsReelles,
    };
    const requetes: string[] = [];
    const top3: ResultatConseil = { conseils: [conseil('tiree-relachee')], explications: [] };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideIonicAngular(),
        provideHttpClient(
          withInterceptors([
            (req) => {
              requetes.push(req.url);
              if (!(req.url in fichiers)) throw new Error(`Requête réseau hors contenu embarqué : ${req.url}`);
              return of(new HttpResponse({ status: 200, body: fichiers[req.url] }));
            },
          ]),
        ),
        { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
        provideRouter(routes),
        { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
        { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
        { provide: AstroService, useValue: { soleil: (_l: unknown, m: Date): SoleilDuJour => soleilDu(m), lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
        { provide: MoteurService, useValue: { conseiller: async () => top3 } },
      ],
    }).compileComponents();
    const env = await demarrer(top3);
    await ouvrirFiche(env);

    const texte = compact(env.page.textContent);
    expect(navigator.onLine).toBe(false);
    expect(titres(env.page)).toEqual(expect.arrayContaining(['Le geste', 'Vitesse', 'Erreur à éviter']));
    expect(texte).toContain(compact(TIREE_RELACHEE.geste));
    expect(texte).toContain(compact(TIREE_RELACHEE.vitesse));
    expect(texte).toContain(compact(TIREE_RELACHEE.erreurAEviter));
    expect(requetes.every((u) => u in fichiers)).toBe(true);
  });
});
