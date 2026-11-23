/*
 * US 11 : sans réseau, la fiche animation garde ses textes et remplace la vidéo tierce par la boucle courte (PLAN §3, §4, §9 bis, §11).
 * Maquette validée : docs/maquettes/us-11-boucle-sans-reseau.html. Même montage que animation.page.us10.spec.ts ; le mode avion est simulé
 * par `navigator.onLine` et les événements `offline` / `online` de `window`. Aucune plateforme n'est appelée.
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

const HOTES = /youtube|youtu\.be|vimeo|dailymotion|dai\.ly/i;
const BOUCLE = { provider: 'self', fichier: 'videos/animation-video-test.mp4', boucle: true, horsLigne: true, licence: 'propre' };
const YOUTUBE = { provider: 'youtube', id: 'yt123', start: 42, auteur: 'La Minute Carna', lienAuteur: 'https://www.youtube.com/@laminutecarna' };
const TEXTE_HORS_LIGNE = 'Hors ligne : la vidéo complète sera disponible avec du réseau';
const TEXTE_SANS_BOUCLE = 'Vidéo disponible avec du réseau';
const animationAvec = (videos: unknown[]): Animation => ({ ...ANIMATION_TEST, id: 'animation-tierce', nom: 'Animation tierce', videos }) as unknown as Animation;
const iframes = (page: HTMLElement): HTMLIFrameElement[] => [...page.querySelectorAll('iframe')];
const contient = (page: HTMLElement, t: string): boolean => compact(page.textContent).includes(compact(t));

async function ouvrirHorsLigne(videos: unknown[]): Promise<Env> {
  const animation = animationAvec(videos);
  const env = await ouvrirLApp({ techniqueId: animation.id, animations: [...TECHNIQUES, animation], stocke: { analytics: false, video: true } });
  await ouvrirFiche(env);
  return env;
}
const mettreHorsLigne = async (env: Env) => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  window.dispatchEvent(new Event('offline'));
  await env.stabiliser();
};

describe('Fiche animation sans réseau (US 11)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });

  it("critère 1 : given le consentement accepté, une vidéo YouTube et une boucle « self », et l'appareil en mode avion, when j'ouvre la fiche, then aucun lecteur tiers n'est chargé et la boucle est lue avec « Hors ligne : la vidéo complète sera disponible avec du réseau »", async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const env = await ouvrirHorsLigne([YOUTUBE, BOUCLE]);

    expect(iframes(env.page)).toEqual([]);
    expect(env.page.querySelector('[src*="youtube" i], [src*="vimeo" i], [src*="dailymotion" i]')).toBeNull();
    expect(HOTES.test([...env.page.querySelectorAll('iframe')].map((f) => f.getAttribute('src')).join(' '))).toBe(false);
    expect(env.page.querySelector('video'), 'la boucle courte est lue').not.toBeNull();
    expect(contient(env.page, TEXTE_HORS_LIGNE)).toBe(true);
    expect(titres(env.page)).not.toContain('Vidéo complète');
  });

  it("critère 2 : given une animation sans vidéo « self » et l'appareil en mode avion, when j'ouvre la fiche, then la zone vidéo affiche « Vidéo disponible avec du réseau » et les textes de la fiche restent lisibles", async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const env = await ouvrirHorsLigne([YOUTUBE]);

    expect(contient(env.page, TEXTE_SANS_BOUCLE)).toBe(true);
    expect(iframes(env.page)).toEqual([]);
    expect(titres(env.page)).toEqual(expect.arrayContaining(['Animation tierce', 'Le geste']));
    expect(contient(env.page, ANIMATION_TEST.geste)).toBe(true);
    expect(contient(env.page, ANIMATION_TEST.vitesse)).toBe(true);
    expect(contient(env.page, ANIMATION_TEST.erreurAEviter)).toBe(true);
  });

  it("critère 3 : given la fiche ouverte hors ligne avec la boucle courte, when le réseau revient, then le lecteur tiers se charge à la place de la phrase hors ligne, sans recharger la fiche", async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const env = await ouvrirHorsLigne([YOUTUBE, BOUCLE]);
    expect(iframes(env.page)).toEqual([]);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await env.stabiliser();

    expect(iframes(env.page)).toHaveLength(1);
    expect(iframes(env.page)[0].getAttribute('src')).toContain('youtube-nocookie.com/embed/yt123');
    expect(contient(env.page, 'Hors ligne')).toBe(false);
    expect(titres(env.page)).toContain('Vidéo complète');
    expect(env.page.querySelector('video'), 'la boucle reste au-dessus').not.toBeNull();
  });

  it("given la fiche ouverte en ligne avec le lecteur, when l'appareil passe en mode avion, then les textes de la fiche restent lisibles et le lecteur tiers est retiré", async () => {
    const env = await ouvrirHorsLigne([YOUTUBE, BOUCLE]);
    expect(iframes(env.page)).toHaveLength(1);

    await mettreHorsLigne(env);

    expect(iframes(env.page)).toEqual([]);
    expect(contient(env.page, TEXTE_HORS_LIGNE)).toBe(true);
    expect(contient(env.page, ANIMATION_TEST.geste)).toBe(true);
  });
});
