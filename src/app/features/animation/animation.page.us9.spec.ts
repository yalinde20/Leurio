/*
 * US 9 : lire la boucle courte de l'animation dans la fiche (PLAN §9 bis, §11). Maquette : docs/maquettes/us-9-boucle-animation.html.
 *
 * Décisions du propriétaire : les vrais fichiers src/assets/videos/*.mp4 n'existent pas encore ; tant qu'un fichier référencé
 * manque ou ne se charge pas, la fiche se comporte comme celle d'une animation sans vidéo (textes seuls, ni zone vidéo,
 * ni encadré « La vidéo… arrive bientôt. », ni erreur). Ici, aucun fichier vidéo n'est lu : jsdom ne lit pas les médias,
 * on contrôle l'élément <video> (attributs, événements). La lecture réelle est dans e2e/animation-boucle.spec.ts.
 *
 * Contrat du DOM supposé : un <video> dans la fiche, avec muted, loop, autoplay, playsinline, sans controls, dont la source
 * (attribut src de <video> ou d'un <source>) se termine par « assets/videos/<fichier> » (fichier du contenu, chemin relatif),
 * et le libellé « Boucle · sans son ». La fiche reste sans <video> pour les vidéos qui ne sont pas « self ».
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
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

/** US 295 : le détail du coup 01 s'ouvre par son lien, posé dans la rivière en coupe. */
async function ouvrirDetail(env: Env): Promise<void> {
  const lien = env.page.querySelector<HTMLElement>('app-riviere-en-coupe a.coup');
  if (!lien) throw new Error('Aucun coup 01 dans la rivière');
  lien.click();
  await env.stabiliser();
}
async function ouvrirFiche(env: Env): Promise<void> {
  await ouvrirDetail(env);
  bouton(env.page, "Voir l'animation").click();
  await env.stabiliser();
}


const ENCADRE = "La vidéo de l'animation arrive bientôt";
const autreQueSelf = { provider: 'youtube', id: 'abc', start: 0, auteur: 'Test' };
const FICHIER = 'videos/animation-video-test.mp4';
const AVEC_BOUCLE = {
  ...ANIMATION_TEST,
  id: 'animation-video',
  nom: 'Animation avec boucle',
  videos: [autreQueSelf, { provider: 'self', fichier: FICHIER, boucle: true, horsLigne: true, licence: 'propre' }],
} as unknown as Animation;
const SANS_VIDEO = { ...ANIMATION_TEST, id: 'animation-sans-video', nom: 'Animation sans vidéo', videos: [] } as unknown as Animation;
const SEULEMENT_YOUTUBE = { ...ANIMATION_TEST, id: 'animation-youtube', nom: 'Animation youtube', videos: [autreQueSelf] } as unknown as Animation;

const lecteur = (page: HTMLElement): HTMLVideoElement | null => page.querySelector('video');
const sourceDe = (v: HTMLVideoElement): string => v.getAttribute('src') ?? v.querySelector('source')?.getAttribute('src') ?? '';
const attribut = (v: HTMLVideoElement, nom: string, propriete: boolean): boolean => propriete || v.hasAttribute(nom);

describe('Boucle courte dans la fiche animation (US 9)', () => {
  beforeEach(() => {
    // jsdom n'implémente pas la lecture : on évite le bruit « not implemented ».
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });

  it("critère 1 : given une animation dont les vidéos contiennent une vidéo « self », when j'ouvre sa fiche, then la boucle est lue dans la fiche, muette, sans commandes, en ligne, et repart dès qu'elle se termine", async () => {
    const env = await ouvrirLApp({ techniqueId: AVEC_BOUCLE.id, animations: [...TECHNIQUES, AVEC_BOUCLE] });
    await ouvrirFiche(env);

    const v = lecteur(env.page);
    expect(v, 'un élément <video> dans la fiche').not.toBeNull();
    expect(sourceDe(v!)).toMatch(new RegExp(`(^|/)assets/${FICHIER.replace('.', '\\.')}$`));
    expect(attribut(v!, 'muted', v!.muted)).toBe(true);
    expect(attribut(v!, 'autoplay', v!.autoplay)).toBe(true);
    expect(attribut(v!, 'playsinline', v!.playsInline)).toBe(true);
    expect(v!.hasAttribute('controls') || v!.controls).toBe(false);
    expect(compact(env.page.textContent)).toContain(compact('Boucle · sans son'));
    expect(compact(env.page.textContent)).not.toContain(compact(ENCADRE));
    // les trois textes restent au-dessus de la vidéo
    expect(titres(env.page)).toEqual(expect.arrayContaining(['Le geste', 'Vitesse', 'Erreur à éviter']));

    // Redémarrage dès la fin : attribut loop, ou à défaut une nouvelle lecture après « ended ».
    const lectures = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
    v!.dispatchEvent(new Event('ended'));
    await env.stabiliser();
    const repart = attribut(v!, 'loop', v!.loop) || vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length > lectures;
    expect(repart).toBe(true);
  });

  it("critère 1 : given la fiche d'une animation réelle du contenu qui référence une vidéo « self », when je l'ouvre, then la <video> pointe vers le fichier du contenu sous assets/", async () => {
    const self = (TIREE_RELACHEE as unknown as { videos: { provider: string; fichier?: string }[] }).videos.find((x) => x.provider === 'self')!;
    const env = await ouvrirLApp({ techniqueId: 'tiree-relachee', animations: TECHNIQUES });
    await ouvrirFiche(env);

    const v = lecteur(env.page);
    expect(v, 'un élément <video> dans la fiche').not.toBeNull();
    expect(sourceDe(v!).endsWith(`assets/${self.fichier}`)).toBe(true);
  });

  it("critère 2 : given l'appareil en mode avion, when j'ouvre la fiche d'une animation avec une vidéo « self », then la boucle est présente avec sa source embarquée et lue, sans autre requête réseau", async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    const env = await ouvrirLApp({ techniqueId: AVEC_BOUCLE.id, animations: [...TECHNIQUES, AVEC_BOUCLE] });
    await ouvrirFiche(env);

    const v = lecteur(env.page);
    expect(navigator.onLine).toBe(false);
    expect(v, 'un élément <video> dans la fiche hors ligne').not.toBeNull();
    expect(sourceDe(v!)).toMatch(/(^|\/)assets\/videos\/animation-video-test\.mp4$/);
    expect(sourceDe(v!)).not.toMatch(/^https?:/);
    expect(attribut(v!, 'autoplay', v!.autoplay)).toBe(true);
    expect(compact(env.page.textContent)).not.toContain(compact(ENCADRE));
  });

  it("critère 3 : given une animation sans aucune vidéo, when j'ouvre sa fiche, then la fiche montre les textes sans zone vidéo ni encadré ni erreur", async () => {
    const env = await ouvrirLApp({ techniqueId: SANS_VIDEO.id, animations: [...TECHNIQUES, SANS_VIDEO] });
    await ouvrirFiche(env);
    verifierTextesSeuls(env.page, SANS_VIDEO);
  });

  it("critère 3 : given une animation dont les seules vidéos ne sont pas « self », when j'ouvre sa fiche, then la fiche montre les textes sans zone vidéo ni encadré ni erreur", async () => {
    const env = await ouvrirLApp({ techniqueId: SEULEMENT_YOUTUBE.id, animations: [...TECHNIQUES, SEULEMENT_YOUTUBE] });
    await ouvrirFiche(env);
    verifierTextesSeuls(env.page, SEULEMENT_YOUTUBE);
  });

  it("critère 3 : given une vidéo « self » dont le fichier ne se charge pas, when la <video> signale l'erreur, then la zone vidéo disparaît, les textes restent, sans encadré ni message d'erreur", async () => {
    const env = await ouvrirLApp({ techniqueId: AVEC_BOUCLE.id, animations: [...TECHNIQUES, AVEC_BOUCLE] });
    await ouvrirFiche(env);
    const v = lecteur(env.page);
    expect(v, 'la <video> existe avant l\'erreur (témoin positif)').not.toBeNull();

    v!.dispatchEvent(new Event('error'));
    await env.stabiliser();

    verifierTextesSeuls(env.page, AVEC_BOUCLE);
  });
});

function verifierTextesSeuls(page: HTMLElement, a: Animation): void {
  const texte = compact(page.textContent);
  // témoin positif : la fiche est bien ouverte, avec ses textes
  expect(titres(page)).toEqual(expect.arrayContaining([a.nom, 'Le geste', 'Vitesse', 'Erreur à éviter']));
  expect(texte).toContain(compact(a.geste));
  expect(texte).toContain(compact(a.vitesse));
  expect(texte).toContain(compact(a.erreurAEviter));
  expect(lecteur(page)).toBeNull();
  expect(texte).not.toContain(compact('Boucle · sans son'));
  expect(texte).not.toContain(compact(ENCADRE));
  expect(texte).not.toMatch(/erreur de lecture|impossible|échec/i);
  expect(page.querySelector('[role="alert"], .erreur, ion-toast')).toBeNull();
}
