/*
 * US 94 : modifier mes consentements depuis Compte (PLAN §4, §7, §9 bis). Maquette validée : docs/maquettes/us-94-consentements.html.
 * Périmètre (décision du propriétaire, option A) : la page, le service et le texte de confidentialité. Le SDK Analytics (US 19),
 * la boucle courte (US 9) et le lecteur tiers (US 10) ne sont pas faits.
 *
 * Fichiers et symboles attendus (à créer) :
 *  - src/app/features/compte/consentements.page.ts : `ConsentementsPage`, route enfant de Compte : `compte/consentements` (comme `theme`).
 *    Titre « Consentements », bouton retour « Compte ». Deux `ion-toggle` (ou `role="switch"`, ou cases) « Mesure d’audience (Analytics) » puis
 *    « Lecteurs vidéo tiers », dans cet ordre. Chaque changement s'applique tout de suite (pas de bouton Enregistrer) via ConsentementsService.
 *    Mention pendant une écriture en attente : « Pas encore synchronisé : ce sera fait au retour du réseau. »
 *  - src/app/features/compte/compte.page.ts : ligne « Consentements » (sous-texte « Mesure d’audience, vidéos », lien `/compte/consentements`)
 *    dans « Réglages », après « Thème ».
 *  - src/app/core/data/consentements.service.ts, SourceProfil.lireConsentements : voir consentements.service.spec.ts.
 * Les interrupteurs sont lus par leur propriété `checked` (ion-toggle) ou `aria-checked` ; on les change en y mettant `checked` et en émettant `ionChange`
 * (ion-toggle), ou par un clic (case ou interrupteur natif).
 */
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { throwError } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { SOURCE_COMPTE, SourceCompte } from '../../core/data/compte.service';
import { ConsentementsService } from '../../core/data/consentements.service';
import { SOURCE_PROFIL } from '../../core/data/profil.service';
import { SOURCE_SPOTS } from '../../core/data/spots.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { compact, trouver } from './compte-informations.doubles';

const MENTION = 'Pas encore synchronisé : ce sera fait au retour du réseau.';
const ANALYTICS = 'Mesure d’audience (Analytics)';
const VIDEO = 'Lecteurs vidéo tiers';

interface Consentements {
  analytics: boolean;
  video: boolean;
}
interface Ecriture {
  uid: string;
  champs: { consentements?: Consentements };
  resoudre: () => void;
}
interface Options {
  /** `null` : pas de compte. */
  uid?: string | null;
  /** Ce que contient users/{uid}.consentements. */
  stocke?: Consentements;
  /** Les écritures ne se résolvent qu'à la main (réseau absent). */
  enAttente?: boolean;
}

const sansReseau: HttpInterceptorFn = (req) => throwError(() => new Error(`requête non prévue : ${req.url}`));

async function ouvrir(url: string, { uid = 'uid-test-123', stocke = { analytics: false, video: false }, enAttente = false }: Options = {}) {
  localStorage.clear();
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
  const ecritures: Ecriture[] = [];
  const compte: SourceCompte = {
    uidCourant: async () => uid,
    connecterAnonymement: async () => uid ?? 'uid-test-123',
    profilExiste: async () => true,
    ecrireProfil: async () => undefined,
  };
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideIonicAngular(),
      provideRouter(routes),
      provideHttpClient(withInterceptors([sansReseau])),
      { provide: SOURCE_COMPTE, useValue: compte },
      {
        provide: SOURCE_PROFIL,
        useValue: {
          lireConsentements: async () => ({ ...stocke }),
          mettreAJour: (u: string, champs: Ecriture['champs']) =>
            new Promise<void>((resolve) => {
              ecritures.push({ uid: u, champs, resoudre: resolve });
              if (!enAttente) resolve();
            }),
        },
      },
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: SOURCE_SPOTS, useValue: { uid: async () => null, documents: async () => [] } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(App);
  const page = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    for (let i = 0; i < 5; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  const router = TestBed.inject(Router);
  router.setUpLocationChangeListener();
  await router.navigateByUrl(url);
  await stabiliser();
  return { page, stabiliser, router, ecritures, service: TestBed.inject(ConsentementsService) };
}

const SELECTEUR = 'ion-toggle, [role="switch"], input[type="checkbox"]';

/** L'interrupteur nommé `nom` : le plus proche ancêtre qui porte ce nom sans porter l'autre. */
function interrupteur(page: HTMLElement, nom: string): HTMLElement {
  const autre = nom === ANALYTICS ? VIDEO : ANALYTICS;
  const tous = Array.from(page.querySelectorAll<HTMLElement>(SELECTEUR));
  const trouve = tous.find((el) => {
    let n: HTMLElement | null = el;
    while (n && n !== page) {
      const t = compact(`${n.getAttribute('aria-label') ?? ''}${n.textContent ?? ''}`);
      if (t.includes(compact(nom)) && !t.includes(compact(autre))) return true;
      if (t.includes(compact(autre))) return false;
      n = n.parentElement;
    }
    return false;
  });
  if (!trouve) throw new Error(`pas d'interrupteur « ${nom} » (présents : ${tous.length})`);
  return trouve;
}
const estActif = (el: HTMLElement): boolean => ('checked' in el && typeof (el as HTMLInputElement).checked === 'boolean' ? (el as HTMLInputElement).checked : el.getAttribute('aria-checked') === 'true');

async function basculer(page: HTMLElement, nom: string, stabiliser: () => Promise<void>) {
  const el = interrupteur(page, nom);
  if (el.tagName === 'ION-TOGGLE') {
    const suivant = !estActif(el);
    (el as HTMLElement & { checked: boolean }).checked = suivant;
    el.dispatchEvent(new CustomEvent('ionChange', { detail: { checked: suivant }, bubbles: true }));
  } else {
    el.click();
  }
  await stabiliser();
}

afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 94 : Compte, ligne « Consentements »', () => {
  it('given l\'onglet Compte, when je le regarde, then « Consentements » (sous-texte « Mesure d’audience, vidéos ») est dans « Réglages », après « Thème » et avant « Informations »', async () => {
    const { page } = await ouvrir('/compte');

    const texte = compact(page.querySelector('ion-content')?.textContent);
    const ordre = ['Réglages', 'Thème', 'Consentements', 'Mesure d’audience, vidéos', 'Informations'].map((t) => texte.indexOf(compact(t)));
    expect(ordre.every((i) => i >= 0), `tous présents : ${ordre}`).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  it('given l\'onglet Compte, when je touche « Consentements », then la page « Consentements » s\'ouvre à l\'adresse /compte/consentements avec le retour « Compte »', async () => {
    const { page, stabiliser, router } = await ouvrir('/compte');

    const ligne = trouver(page.querySelector('ion-content') as HTMLElement, 'Consentements')?.closest<HTMLElement>('a');
    expect(ligne, 'une ligne « Consentements » (lien)').toBeTruthy();
    expect(ligne!.getAttribute('href') ?? '').toContain('/compte/consentements');
    ligne!.click();
    await stabiliser();

    expect(router.url).toBe('/compte/consentements');
    expect(compact(page.querySelector('ion-toolbar ion-title')?.textContent)).toBe('Consentements');
    expect(page.querySelector('app-bouton-retour')?.textContent).toContain('Compte');
  });
});

describe('US 94 : Consentements', () => {
  it('critère 1 : given les deux consentements sont refusés dans users/{uid}, when j\'ouvre « Consentements », then les interrupteurs « Mesure d’audience (Analytics) » et « Lecteurs vidéo tiers » sont désactivés, sans mention de synchronisation', async () => {
    const { page } = await ouvrir('/compte/consentements', { stocke: { analytics: false, video: false } });

    expect(page.querySelectorAll(SELECTEUR)).toHaveLength(2);
    expect(estActif(interrupteur(page, ANALYTICS))).toBe(false);
    expect(estActif(interrupteur(page, VIDEO))).toBe(false);
    expect(compact(page.querySelector('ion-toolbar ion-title')?.textContent)).toBe('Consentements');
    expect(compact(page.textContent)).not.toContain(compact(MENTION));
  });

  it('critère 1 : given les deux consentements sont acceptés dans users/{uid}, when j\'ouvre « Consentements », then les deux interrupteurs sont activés', async () => {
    const { page } = await ouvrir('/compte/consentements', { stocke: { analytics: true, video: true } });

    expect(estActif(interrupteur(page, ANALYTICS))).toBe(true);
    expect(estActif(interrupteur(page, VIDEO))).toBe(true);
  });

  it('critère 1 : given seule la mesure d\'audience est acceptée, when j\'ouvre « Consentements », then seul « Mesure d’audience (Analytics) » est activé', async () => {
    const { page } = await ouvrir('/compte/consentements', { stocke: { analytics: true, video: false } });

    expect(estActif(interrupteur(page, ANALYTICS))).toBe(true);
    expect(estActif(interrupteur(page, VIDEO))).toBe(false);
  });

  it('critère 3 : given « Mesure d’audience (Analytics) » est désactivé, when je l\'active, then il est activé tout de suite, users/{uid} reçoit consentements.analytics vrai (video inchangé) et analytics() du service vaut vrai', async () => {
    const { page, stabiliser, ecritures, service } = await ouvrir('/compte/consentements', { stocke: { analytics: false, video: false } });

    await basculer(page, ANALYTICS, stabiliser);

    expect(estActif(interrupteur(page, ANALYTICS))).toBe(true);
    expect(ecritures.map((e) => ({ uid: e.uid, champs: e.champs }))).toEqual([{ uid: 'uid-test-123', champs: { consentements: { analytics: true, video: false } } }]);
    expect(service.analytics()).toBe(true);
    expect(service.video()).toBe(false);
  });

  it('critère 2 : given « Mesure d’audience (Analytics) » est activé, when je le désactive, then users/{uid} reçoit consentements.analytics faux (video inchangé) et analytics() du service vaut faux', async () => {
    const { page, stabiliser, ecritures, service } = await ouvrir('/compte/consentements', { stocke: { analytics: true, video: true } });

    await basculer(page, ANALYTICS, stabiliser);

    expect(estActif(interrupteur(page, ANALYTICS))).toBe(false);
    expect(ecritures.map((e) => e.champs)).toEqual([{ consentements: { analytics: false, video: true } }]);
    expect(service.analytics()).toBe(false);
    expect(service.video()).toBe(true);
  });

  it('critère 2 : given « Mesure d’audience (Analytics) » est désactivé et je n\'y touche pas, when j\'ouvre « Consentements » et que j\'utilise l\'app, then analytics() du service vaut faux et aucune écriture n\'est faite', async () => {
    const { ecritures, service } = await ouvrir('/compte/consentements', { stocke: { analytics: false, video: false } });

    expect(service.analytics()).toBe(false);
    expect(service.video()).toBe(false);
    expect(ecritures).toEqual([]);
  });

  it('critère 5 : given « Lecteurs vidéo tiers » est désactivé, when je l\'active, then il est activé tout de suite, users/{uid} reçoit consentements.video vrai (analytics inchangé) et video() du service vaut vrai', async () => {
    const { page, stabiliser, ecritures, service } = await ouvrir('/compte/consentements', { stocke: { analytics: true, video: false } });

    await basculer(page, VIDEO, stabiliser);

    expect(estActif(interrupteur(page, VIDEO))).toBe(true);
    expect(ecritures.map((e) => ({ uid: e.uid, champs: e.champs }))).toEqual([{ uid: 'uid-test-123', champs: { consentements: { analytics: true, video: true } } }]);
    expect(service.video()).toBe(true);
    expect(service.analytics()).toBe(true);
  });

  it('critère 4 : given « Lecteurs vidéo tiers » est activé, when je le désactive, then users/{uid} reçoit consentements.video faux et video() du service vaut faux (plus aucun lecteur tiers ne doit se charger)', async () => {
    const { page, stabiliser, ecritures, service } = await ouvrir('/compte/consentements', { stocke: { analytics: false, video: true } });

    await basculer(page, VIDEO, stabiliser);

    expect(estActif(interrupteur(page, VIDEO))).toBe(false);
    expect(ecritures.map((e) => e.champs)).toEqual([{ consentements: { analytics: false, video: false } }]);
    expect(service.video()).toBe(false);
  });

  it('critère 3 : given je n\'ai pas de réseau (l\'écriture ne se résout pas), when j\'active « Mesure d’audience (Analytics) », then le choix s\'applique tout de suite avec « Pas encore synchronisé : ce sera fait au retour du réseau. », puis la mention disparaît à l\'accusé du serveur', async () => {
    const { page, stabiliser, ecritures, service } = await ouvrir('/compte/consentements', { enAttente: true });
    expect(compact(page.textContent)).not.toContain(compact(MENTION));

    await basculer(page, ANALYTICS, stabiliser);

    expect(estActif(interrupteur(page, ANALYTICS))).toBe(true);
    expect(service.analytics()).toBe(true);
    expect(ecritures).toHaveLength(1);
    expect(compact(page.textContent)).toContain(compact(MENTION));

    ecritures.forEach((e) => e.resoudre());
    await stabiliser();

    expect(compact(page.textContent)).not.toContain(compact(MENTION));
    expect(estActif(interrupteur(page, ANALYTICS))).toBe(true);
  });

  it('critère 5 : given je n\'ai pas encore de compte (uid null), when j\'active « Lecteurs vidéo tiers », then le choix s\'applique mais rien n\'est écrit dans users/{uid} et aucune mention n\'est affichée', async () => {
    const { page, stabiliser, ecritures, service } = await ouvrir('/compte/consentements', { uid: null });

    await basculer(page, VIDEO, stabiliser);

    expect(ecritures).toEqual([]);
    expect(estActif(interrupteur(page, VIDEO))).toBe(true);
    expect(service.video()).toBe(true);
    expect(compact(page.textContent)).not.toContain(compact(MENTION));
  });
});
