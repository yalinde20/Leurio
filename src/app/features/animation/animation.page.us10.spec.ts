/*
 * US 10 : lire la vidéo YouTube, Vimeo ou Dailymotion dans la fiche, après consentement (PLAN §7, §9 bis, §11).
 * Maquette validée : docs/maquettes/us-10-video-tierce-consentement.html.
 *
 * Contrat du DOM supposé (décisions du propriétaire) :
 *  - sous la boucle courte (US 9), un titre « Vidéo complète », puis la carte de consentement (texte + boutons « Non merci » et « Charger la vidéo »)
 *    ou un <iframe> (lecteur officiel), puis la ligne de crédit « Vidéo : <auteur> » (absente sans auteur) ;
 *  - la fiche lit la première vidéo tierce (youtube, vimeo, dailymotion) de `videos` ;
 *  - consentement unique `users/{uid}.consentements.video` : booléen ou null (null ou absent : jamais répondu, on demande ; faux : refusé, on ne redemande pas) ;
 *  - URL des lecteurs : YouTube https://www.youtube-nocookie.com/embed/<id>?start=<start>&playsinline=1, Vimeo https://player.vimeo.com/video/<id>#t=<start>s,
 *    Dailymotion https://geo.dailymotion.com/player.html?video=<id>&startTime=<start> ; l'<iframe> a un `title` qui cite la plateforme ;
 *  - après « Non merci », la rubrique « Vidéo complète » disparaît ; la boucle reste.
 * Aucune plateforme n'est appelée : jsdom ne charge pas les <iframe> et les doubles remplacent le catalogue et le profil.
 */
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, Espece, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SOURCE_COMPTE, SourceCompte } from '../../core/data/compte.service';
import { SOURCE_PROFIL } from '../../core/data/profil.service';
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

/** Ce que contient users/{uid}.consentements : `video` vaut null tant que le pêcheur n'a jamais répondu. `undefined` : pas de document. */
type Stocke = { analytics: boolean; video: boolean | null } | undefined;

interface Options {
  techniqueId: string;
  /** Animations fournies par le contenu (ou une erreur de lecture). */
  animations: Animation[] | 'illisible';
  stocke?: Stocke;
}

/** Les écritures reçues par le double du profil (SOURCE_PROFIL.mettreAJour). */
let ecritures: { uid: string; champs: unknown }[] = [];

/** Le contenu des animations devient illisible une fois le détail ouvert (l'écran Conseil, lui, a pu s'afficher). */
let contenuIllisible = false;

async function ouvrirLApp(options: Options, urlDepart = '/conseil') {
  contenuIllisible = false;
  ecritures = [];
  const stocke = 'stocke' in options ? options.stocke : { analytics: false, video: null };
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  const top3: ResultatConseil = { conseils: [conseil(options.techniqueId)], explications: [] };
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      {
        provide: SOURCE_COMPTE,
        useValue: {
          uidCourant: async () => 'uid-test-123',
          connecterAnonymement: async () => 'uid-test-123',
          profilExiste: async () => true,
          ecrireProfil: async () => undefined,
        } satisfies SourceCompte,
      },
      {
        provide: SOURCE_PROFIL,
        useValue: {
          mettreAJour: async (uid: string, champs: unknown) => void ecritures.push({ uid, champs }),
          lireConsentements: async () => stocke ?? null,
        },
      },
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
  TestBed.resetTestingModule();
});

const boutons = (page: HTMLElement): HTMLElement[] => [...page.querySelectorAll<HTMLElement>('button, ion-button, ion-back-button, a[role="button"]')];
function bouton(page: HTMLElement, texte: string): HTMLElement {
  const b = boutons(page).find((e) => e.getAttribute('role') !== 'tab' && compact(e.textContent).replace('‹', '') === compact(texte));
  if (!b) throw new Error(`Aucun bouton « ${texte} »`);
  return b;
}
const titres = (page: HTMLElement): string[] =>
  [...page.querySelectorAll<HTMLElement>('h1, h2, h3, h4, [role="heading"]')].map((h) => (h.textContent ?? '').trim());

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



const CONSENTEMENT_TEXTE = (plateforme: string) => `Cette vidéo est hébergée par ${plateforme}. La charger ?`;
const HOTES = /youtube|youtu\.be|vimeo|dailymotion|dai\.ly/i;
const BOUCLE = { provider: 'self', fichier: 'videos/animation-video-test.mp4', boucle: true, horsLigne: true, licence: 'propre' };

interface VideoTierce {
  provider: 'youtube' | 'vimeo' | 'dailymotion';
  id: string;
  start?: number;
  auteur?: string;
  lienAuteur?: string;
}
const animationAvec = (videos: unknown[], id = 'animation-tierce'): Animation =>
  ({ ...ANIMATION_TEST, id, nom: 'Animation tierce', videos }) as unknown as Animation;
const YOUTUBE: VideoTierce = { provider: 'youtube', id: 'yt123', start: 42, auteur: 'La Minute Carna', lienAuteur: 'https://www.youtube.com/@laminutecarna' };

async function ouvrirAvec(videos: unknown[], ...stocke: [Stocke?]): Promise<Env> {
  const animation = animationAvec(videos);
  // Sans argument : le pêcheur n'a jamais répondu (video null). Avec `undefined` : pas de document users/{uid}.
  const env = await ouvrirLApp({ techniqueId: animation.id, animations: [...TECHNIQUES, animation], ...(stocke.length ? { stocke: stocke[0] } : {}) });
  await ouvrirFiche(env);
  return env;
}

const lecteur = (page: HTMLElement): HTMLVideoElement | null => page.querySelector('video');
const iframes = (page: HTMLElement): HTMLIFrameElement[] => [...page.querySelectorAll('iframe')];
const lecteurTiers = (page: HTMLElement): HTMLIFrameElement | undefined => iframes(page).find((f) => HOTES.test(f.getAttribute('src') ?? ''));
const sansLecteurTiers = (page: HTMLElement): void => {
  expect(iframes(page)).toEqual([]);
  expect(page.querySelector('[src*="youtube" i], [src*="vimeo" i], [src*="dailymotion" i], [data-src*="youtube" i]')).toBeNull();
};
const credit = (page: HTMLElement): HTMLElement | undefined =>
  [...page.querySelectorAll<HTMLElement>('p, div, span, small')]
    .filter((e) => compact(e.textContent).startsWith(compact('Vidéo :')) && !compact(e.textContent).includes(compact('Vidéo complète')))
    .sort((a, b) => (a.textContent ?? '').length - (b.textContent ?? '').length)[0];
const aLeMessage = (page: HTMLElement, plateforme: string): boolean => compact(page.textContent).includes(compact(CONSENTEMENT_TEXTE(plateforme)));
const aLaRubrique = (page: HTMLElement): boolean => titres(page).includes('Vidéo complète');
const queryStart = (src: string, cle: string): string | null => new URL(src).searchParams.get(cle);

describe('Vidéo tierce après consentement dans la fiche animation (US 10)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });

  it("critère 1 : given en ligne, une animation avec une vidéo YouTube et un pêcheur qui n'a jamais répondu, when j'ouvre la fiche, then aucun lecteur tiers n'est chargé, le message « Cette vidéo est hébergée par YouTube. La charger ? » s'affiche avec « Charger la vidéo » et « Non merci », et la boucle reste visible", async () => {
    const env = await ouvrirAvec([YOUTUBE, BOUCLE]);

    expect(titres(env.page)).toEqual(expect.arrayContaining([ 'Animation tierce', 'Le geste', 'Vidéo complète']));
    expect(aLeMessage(env.page, 'YouTube')).toBe(true);
    expect(() => bouton(env.page, 'Charger la vidéo')).not.toThrow();
    expect(() => bouton(env.page, 'Non merci')).not.toThrow();
    sansLecteurTiers(env.page);
    expect(lecteur(env.page), 'la boucle courte reste visible').not.toBeNull();
    expect(compact(env.page.textContent)).toContain(compact('Boucle · sans son'));
    expect(credit(env.page), 'pas de crédit avant que la vidéo ne se charge').toBeUndefined();
    expect(ecritures).toEqual([]);
  });

  it("critère 1 : given un pêcheur dont users/{uid} n'a pas de consentement vidéo (null) ou pas de document, when j'ouvre la fiche, then la question est posée", async () => {
    for (const stocke of [{ analytics: false, video: null }, undefined] as Stocke[]) {
      const env = await ouvrirAvec([YOUTUBE], stocke);
      expect(aLeMessage(env.page, 'YouTube'), `question posée pour ${JSON.stringify(stocke)}`).toBe(true);
      sansLecteurTiers(env.page);
      TestBed.resetTestingModule();
      vi.useRealTimers();
    }
  });

  it("critère 2 : given le message de consentement affiché, when je touche « Charger la vidéo », then le lecteur officiel s'affiche dans la fiche, démarre à start, et le consentement vidéo est enregistré comme accepté sur mon compte", async () => {
    const env = await ouvrirAvec([YOUTUBE, BOUCLE]);

    bouton(env.page, 'Charger la vidéo').click();
    await env.stabiliser();

    const f = lecteurTiers(env.page);
    expect(f, 'un <iframe> du lecteur officiel').toBeDefined();
    const src = f!.getAttribute('src')!;
    expect(new URL(src).host).toBe('www.youtube-nocookie.com');
    expect(new URL(src).pathname).toBe('/embed/yt123');
    expect(queryStart(src, 'start')).toBe('42');
    expect(f!.getAttribute('title') ?? '').toContain('YouTube');
    expect(aLeMessage(env.page, 'YouTube')).toBe(false);
    expect(() => bouton(env.page, 'Non merci')).toThrow();
    expect(titres(env.page)).toContain('Vidéo complète');
    expect(lecteur(env.page), 'la boucle reste en place').not.toBeNull();
    // Le choix est écrit sur le compte (analytics inchangé).
    expect(ecritures).toEqual([{ uid: 'uid-test-123', champs: { consentements: { analytics: false, video: true } } }]);
  });

  it("critère 3 : given un pêcheur qui a déjà accepté la vidéo, when il ouvre la fiche d'une animation avec une vidéo tierce, then le lecteur se charge sans redemander", async () => {
    const env = await ouvrirAvec([YOUTUBE], { analytics: false, video: true });

    expect(lecteurTiers(env.page), 'lecteur chargé tout de suite').toBeDefined();
    expect(aLeMessage(env.page, 'YouTube')).toBe(false);
    expect(() => bouton(env.page, 'Charger la vidéo')).toThrow();
    expect(() => bouton(env.page, 'Non merci')).toThrow();
    expect(ecritures).toEqual([]);
  });

  it("critère 3 : given j'ai accepté sur une première fiche, when j'ouvre à nouveau une fiche avec une vidéo tierce, then le lecteur se charge sans redemander", async () => {
    const env = await ouvrirAvec([YOUTUBE]);
    bouton(env.page, 'Charger la vidéo').click();
    await env.stabiliser();
    expect(lecteurTiers(env.page)).toBeDefined();

    TestBed.inject(Location).back();
    await env.stabiliser();
    bouton(env.page, "Voir l'animation").click();
    await env.stabiliser();

    expect(lecteurTiers(env.page), 'lecteur chargé sans question').toBeDefined();
    expect(aLeMessage(env.page, 'YouTube')).toBe(false);
  });

  it("critère 4 : given le message de consentement affiché, when je touche « Non merci », then aucun lecteur tiers n'est chargé, la boucle reste lue, la rubrique « Vidéo complète » disparaît et le refus est enregistré sur mon compte", async () => {
    const env = await ouvrirAvec([YOUTUBE, BOUCLE]);

    bouton(env.page, 'Non merci').click();
    await env.stabiliser();

    sansLecteurTiers(env.page);
    expect(aLeMessage(env.page, 'YouTube')).toBe(false);
    expect(() => bouton(env.page, 'Charger la vidéo')).toThrow();
    expect(aLaRubrique(env.page)).toBe(false);
    expect(credit(env.page)).toBeUndefined();
    const v = lecteur(env.page);
    expect(v, 'la boucle courte reste dans la fiche').not.toBeNull();
    expect(v!.hasAttribute('autoplay') || v!.autoplay).toBe(true);
    expect(ecritures).toEqual([{ uid: 'uid-test-123', champs: { consentements: { analytics: false, video: false } } }]);
  });

  it("critère 4 : given j'ai refusé sur une fiche, when j'ouvre à nouveau une fiche avec une vidéo tierce, then la question n'est plus posée", async () => {
    const env = await ouvrirAvec([YOUTUBE, BOUCLE]);
    bouton(env.page, 'Non merci').click();
    await env.stabiliser();

    TestBed.inject(Location).back();
    await env.stabiliser();
    bouton(env.page, "Voir l'animation").click();
    await env.stabiliser();

    expect(aLeMessage(env.page, 'YouTube')).toBe(false);
    expect(aLaRubrique(env.page)).toBe(false);
    sansLecteurTiers(env.page);
    expect(lecteur(env.page)).not.toBeNull();
  });

  it("critère 4 : given users/{uid} a déjà un refus (video faux), when j'ouvre la fiche, then la question n'est pas posée, aucun lecteur tiers n'est chargé et la boucle est lue", async () => {
    // Témoin positif : la même fiche, sans réponse enregistrée, pose bien la question.
    const temoin = await ouvrirAvec([YOUTUBE, BOUCLE], { analytics: false, video: null });
    expect(aLeMessage(temoin.page, 'YouTube'), 'témoin : la question est posée quand video est null').toBe(true);
    TestBed.resetTestingModule();
    vi.useRealTimers();

    const env = await ouvrirAvec([YOUTUBE, BOUCLE], { analytics: false, video: false });

    expect(titres(env.page)).toEqual(expect.arrayContaining(['Animation tierce', 'Le geste']));
    expect(aLeMessage(env.page, 'YouTube')).toBe(false);
    expect(aLaRubrique(env.page)).toBe(false);
    sansLecteurTiers(env.page);
    expect(lecteur(env.page)).not.toBeNull();
    expect(ecritures).toEqual([]);
  });

  it("critère 5 : given une vidéo « youtube » et le consentement accepté, when j'ouvre la fiche, then le lecteur officiel YouTube joue et démarre à start", async () => {
    const env = await ouvrirAvec([{ provider: 'youtube', id: 'yt123', start: 42 }], { analytics: false, video: true });

    const f = lecteurTiers(env.page);
    expect(f, 'un <iframe> YouTube').toBeDefined();
    const url = new URL(f!.getAttribute('src')!);
    expect(url.protocol + '//' + url.host).toBe('https://www.youtube-nocookie.com');
    expect(url.pathname).toBe('/embed/yt123');
    expect(url.searchParams.get('start')).toBe('42');
    expect(f!.getAttribute('title') ?? '').toContain('YouTube');
  });

  it("critère 5 : given une vidéo « vimeo » et le consentement accepté, when j'ouvre la fiche, then le lecteur officiel Vimeo joue et démarre à start", async () => {
    const env = await ouvrirAvec([{ provider: 'vimeo', id: '987654', start: 42 }], { analytics: false, video: true });

    const f = lecteurTiers(env.page);
    expect(f, 'un <iframe> Vimeo').toBeDefined();
    const url = new URL(f!.getAttribute('src')!);
    expect(url.host).toBe('player.vimeo.com');
    expect(url.pathname).toBe('/video/987654');
    expect(url.hash).toMatch(/(^#|&)t=42s(&|$)/);
    expect(f!.getAttribute('title') ?? '').toContain('Vimeo');
    expect(aLeMessage(env.page, 'Vimeo')).toBe(false);
  });

  it("critère 5 : given une vidéo « dailymotion » et le consentement accepté, when j'ouvre la fiche, then le lecteur officiel Dailymotion joue et démarre à start", async () => {
    const env = await ouvrirAvec([{ provider: 'dailymotion', id: 'x8abc12', start: 42 }], { analytics: false, video: true });

    const f = lecteurTiers(env.page);
    expect(f, 'un <iframe> Dailymotion').toBeDefined();
    const url = new URL(f!.getAttribute('src')!);
    expect(url.host).toBe('geo.dailymotion.com');
    expect(url.pathname).toBe('/player.html');
    expect(url.searchParams.get('video')).toBe('x8abc12');
    expect(url.searchParams.get('startTime')).toBe('42');
    expect(f!.getAttribute('title') ?? '').toContain('Dailymotion');
  });

  it("critère 5 : given une vidéo Vimeo et une vidéo Dailymotion, when le message s'affiche, then il nomme la plateforme de la vidéo lue", async () => {
    const vimeo = await ouvrirAvec([{ provider: 'vimeo', id: '987654', start: 10 }]);
    expect(aLeMessage(vimeo.page, 'Vimeo')).toBe(true);
    TestBed.resetTestingModule();
    vi.useRealTimers();
    const dailymotion = await ouvrirAvec([{ provider: 'dailymotion', id: 'x8abc12', start: 10 }]);
    expect(aLeMessage(dailymotion.page, 'Dailymotion')).toBe(true);
  });

  it("critère 5 : given plusieurs vidéos tierces, when j'ouvre la fiche, then seule la première est lue", async () => {
    const env = await ouvrirAvec(
      [{ provider: 'vimeo', id: '111', start: 5 }, { provider: 'youtube', id: 'yt222', start: 7 }, BOUCLE],
      { analytics: false, video: true },
    );

    expect(iframes(env.page)).toHaveLength(1);
    expect(iframes(env.page)[0].getAttribute('src')).toContain('player.vimeo.com/video/111');
    expect(env.page.innerHTML).not.toContain('yt222');
  });

  it("critère 6 : given une vidéo tierce avec auteur et lienAuteur, when la vidéo s'affiche, then « Vidéo : <auteur> » est sous le lecteur et le nom ouvre sa chaîne hors de l'app", async () => {
    const env = await ouvrirAvec([YOUTUBE], { analytics: false, video: true });

    const f = lecteurTiers(env.page);
    const c = credit(env.page);
    expect(f).toBeDefined();
    expect(c, 'ligne de crédit').toBeDefined();
    expect(compact(c!.textContent)).toBe(compact('Vidéo : La Minute Carna'));
    expect(f!.compareDocumentPosition(c!) & Node.DOCUMENT_POSITION_FOLLOWING, 'le crédit est sous le lecteur').toBeTruthy();
    const lien = [...c!.querySelectorAll('a')].find((a) => compact(a.textContent) === compact('La Minute Carna'));
    expect(lien, 'le nom est un lien').toBeDefined();
    expect(lien!.getAttribute('href')).toBe('https://www.youtube.com/@laminutecarna');
    expect(lien!.getAttribute('target')).toBe('_blank');
    expect(lien!.getAttribute('rel') ?? '').toContain('noopener');
  });

  it("critère 7 : given une vidéo tierce avec auteur mais sans lienAuteur, when la vidéo s'affiche, then « Vidéo : <auteur> » est affiché sans lien", async () => {
    const env = await ouvrirAvec([{ provider: 'youtube', id: 'yt123', start: 42, auteur: 'La Minute Carna' }], { analytics: false, video: true });

    expect(lecteurTiers(env.page)).toBeDefined();
    const c = credit(env.page);
    expect(c, 'ligne de crédit').toBeDefined();
    expect(compact(c!.textContent)).toBe(compact('Vidéo : La Minute Carna'));
    expect(c!.querySelector('a')).toBeNull();
  });

  it("critère 7 : given une vidéo tierce sans auteur, when la vidéo s'affiche, then aucune ligne de crédit n'apparaît", async () => {
    const env = await ouvrirAvec([{ provider: 'youtube', id: 'yt123', start: 42 }], { analytics: false, video: true });

    expect(lecteurTiers(env.page)).toBeDefined();
    expect(credit(env.page)).toBeUndefined();
  });
});
