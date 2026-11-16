/*
 * US 95 : convertir mon compte anonyme avec Google ou Apple (PLAN §2.5, §4, §7).
 * Maquette validée : docs/maquettes/us-95-compte-google-apple.html.
 *
 * CONTRAT À IMPLÉMENTER (le développeur crée exactement ceci) :
 *
 *  src/app/core/data/liaison-compte.ts
 *    export type FournisseurLiaison = 'google' | 'apple';
 *    export interface CompteLie { fournisseur: FournisseurLiaison; email: string | null }   // email : null si le fournisseur n'en donne pas
 *    export interface SourceLiaison {
 *      // Le compte déjà lié au lancement (rend `null` tant que le compte est anonyme ou absent). Ne rejette pas hors ligne.
 *      compteLie(): Promise<CompteLie | null>;
 *      // Ouvre la fenêtre de connexion du fournisseur et LIE le compte anonyme courant (linkWithPopup / linkWithCredential :
 *      // l'uid ne change pas, rien n'est copié, supprimé ni réécrit). Rend le compte lié.
 *      // Rejette avec un objet portant `code` (code d'erreur Firebase Auth) :
 *      //   'auth/credential-already-in-use' (ou 'auth/email-already-in-use') : compte déjà associé à un autre profil ;
 *      //   'auth/popup-closed-by-user' | 'auth/cancelled-popup-request' | 'auth/user-cancelled' : annulation ;
 *      //   'auth/network-request-failed' : réseau coupé.
 *      lier(fournisseur: FournisseurLiaison): Promise<CompteLie>;
 *    }
 *    export const SOURCE_LIAISON: InjectionToken<SourceLiaison>   // providedIn: 'root', fabrique Firebase (import dynamique, comme SOURCE_COMPTE)
 *
 *  src/app/features/compte/compte.page.ts : groupe « Ton compte » en tête de l'écran Compte, au-dessus de « Réglages ».
 *   - Anonyme : « Compte anonyme », le texte d'explication, puis deux boutons dans l'ordre « Continuer avec Apple », « Continuer avec Google ».
 *   - Hors ligne (navigator.onLine === false) : `lier` n'est PAS appelé ; message role="status".
 *   - Pendant la connexion : les deux boutons désactivés, « Connexion en cours… ».
 *   - Lié : « Connecté avec Google|Apple », l'adresse si elle existe, « Ta boîte et tes spots sont liés à ce compte. », aucun bouton.
 *   - Déjà associé ailleurs : état anonyme + message role="alert". Annulation : état anonyme, aucun message (ni alert ni status).
 *   - Le composant n'écrit jamais dans la boîte, les spots ni le profil, et ne supprime rien.
 *
 * Les tests passent par l'app réelle (App + routes) avec des doubles ; aucun service réel.
 */
import { HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { SOURCE_COMPTE } from '../../core/data/compte.service';
import { CompteLie, FournisseurLiaison, SOURCE_LIAISON, SourceLiaison } from '../../core/data/liaison-compte';
import { SOURCE_SPOTS } from '../../core/data/spots.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { CONTENU, compact, trouver } from './compte-informations.doubles';

const UID = 'uid-anonyme-95';
// US 96 : l'explication cite aussi l'e-mail (maquette validée).
const EXPLICATION = 'Lie-le à Google, à Apple ou à ton e-mail pour garder ta boîte et tes spots si tu changes de téléphone.';
const DEJA_ASSOCIE = 'Ce compte est déjà associé à un autre profil Leurio.';
const HORS_LIGNE = 'Connecte-toi à internet pour te connecter.';
const LIE = 'Ta boîte et tes spots sont liés à ce compte.';

const contenu: HttpInterceptorFn = (req) => {
  const m = /assets\/data\/([^/]+)\.json$/.exec(req.url);
  if (m && m[1] in CONTENU) return of(new HttpResponse({ status: 200, body: CONTENU[m[1]] }));
  return throwError(() => new Error(`requête non prévue : ${req.url}`));
};

interface Options {
  dejaLie?: CompteLie | null;
  /** Comportement de `lier` ; par défaut : succès avec l'adresse donnée. */
  lier?: (f: FournisseurLiaison) => Promise<CompteLie>;
  horsLigne?: boolean;
}

async function ouvrir(options: Options = {}) {
  const appels: FournisseurLiaison[] = [];
  const ecritures: string[] = [];
  const source: SourceLiaison = {
    compteLie: async () => options.dejaLie ?? null,
    lier: (f) => {
      appels.push(f);
      return (options.lier ?? (async (x) => ({ fournisseur: x, email: 'camille@example.test' })))(f);
    },
    lierEmail: async () => Promise.reject(new Error('non prévu (US 96)')),
  };
  const enregistre = (nom: string) => async () => void ecritures.push(nom);
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideIonicAngular(),
      provideRouter(routes),
      provideHttpClient(withInterceptors([contenu])),
      { provide: SOURCE_LIAISON, useValue: source },
      {
        provide: SOURCE_COMPTE,
        useValue: {
          uidCourant: async () => UID,
          connecterAnonymement: async () => UID,
          profilExiste: async () => true,
          ecrireProfil: enregistre('profil'),
        },
      },
      {
        provide: SOURCE_TACKLE_BOX,
        useValue: {
          uid: async () => UID,
          ecouter: () => () => undefined,
          ajouter: enregistre('boite.ajouter'),
          modifier: enregistre('boite.modifier'),
          supprimer: enregistre('boite.supprimer'),
          envoyerPhoto: async () => 'x',
          supprimerPhoto: enregistre('boite.photo'),
        },
      },
      { provide: SOURCE_SPOTS, useValue: { uid: async () => UID, documents: async () => [] } },
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
  await router.navigateByUrl('/compte');
  await stabiliser();
  return { page, stabiliser, appels, ecritures };
}

const texte = (page: HTMLElement) => compact(page.querySelector('ion-content')?.textContent);
const bouton = (page: HTMLElement, libelle: string) =>
  Array.from(page.querySelectorAll<HTMLElement>('button, ion-button')).find((b) => compact(b.textContent).includes(compact(libelle)));
const estDesactive = (b: HTMLElement) => b.hasAttribute('disabled') || (b as HTMLButtonElement).disabled === true || b.getAttribute('aria-disabled') === 'true';
const erreur = (code: string) => Object.assign(new Error(code), { code });

async function toucher(page: HTMLElement, libelle: string, stabiliser: () => Promise<void>) {
  const b = bouton(page, libelle);
  if (!b) throw new Error(`bouton introuvable : « ${libelle} »`);
  b.click();
  await stabiliser();
}

/** L'état anonyme complet : titre, explication, deux boutons dans l'ordre Apple puis Google. */
function exigerEtatAnonyme(page: HTMLElement) {
  const t = texte(page);
  expect(t, 'groupe « Ton compte »').toContain(compact('Ton compte'));
  expect(t, 'titre anonyme').toContain(compact('Compte anonyme'));
  expect(t, 'explication').toContain(compact(EXPLICATION));
  expect(t).not.toContain(compact('Connecté avec'));
  const labels = Array.from(page.querySelectorAll<HTMLElement>('button, ion-button'))
    .map((b) => compact(b.textContent))
    .filter((x) => x.startsWith(compact('Continuer avec')));
  // US 96 : un troisième bouton, « Continuer avec l’e-mail », vient après Apple et Google (maquette validée).
  expect(labels).toEqual([compact('Continuer avec Apple'), compact('Continuer avec Google'), compact('Continuer avec l’e-mail')]);
}

const aucunMessage = (page: HTMLElement) => {
  expect(page.querySelector('[role="alert"], [role="status"]'), 'aucun message').toBeNull();
  expect(texte(page)).not.toContain(compact(DEJA_ASSOCIE));
  expect(texte(page)).not.toContain(compact(HORS_LIGNE));
};

const proprieteEnLigne = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
function simulerEnLigne(valeur: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => valeur });
}

beforeEach(() => {
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
  simulerEnLigne(true);
});
afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
  delete (navigator as unknown as Record<string, unknown>)['onLine'];
  if (proprieteEnLigne) Object.defineProperty(Navigator.prototype, 'onLine', proprieteEnLigne);
});

describe('US 95 : lier mon compte anonyme à Google ou Apple', () => {
  it('état de départ : given mon compte est anonyme, when j\'ouvre Compte, then « Ton compte » est au-dessus de « Réglages » avec « Compte anonyme », l\'explication et les boutons Apple puis Google', async () => {
    const { page } = await ouvrir();

    exigerEtatAnonyme(page);
    expect(texte(page).indexOf(compact('Ton compte'))).toBeLessThan(texte(page).indexOf(compact('Réglages')));
    aucunMessage(page);
  });

  it('critère 1 : given mon compte est anonyme et ma boîte et mes spots ne sont pas vides, when je touche « Continuer avec Google » et je valide la connexion, then Compte affiche « Connecté avec Google » et mon adresse, et ma boîte et mes spots sont inchangés', async () => {
    const { page, stabiliser, appels, ecritures } = await ouvrir();

    await toucher(page, 'Continuer avec Google', stabiliser);

    expect(appels).toEqual(['google']);
    const t = texte(page);
    expect(t).toContain(compact('Connecté avec Google'));
    expect(t).toContain(compact('camille@example.test'));
    expect(t).toContain(compact(LIE));
    expect(t).not.toContain(compact('Compte anonyme'));
    expect(bouton(page, 'Continuer avec')).toBeUndefined();
    expect(bouton(page, 'Déconnexion') ?? bouton(page, 'Se déconnecter')).toBeUndefined();
    // Boîte et spots inchangés : le compte est lié (même uid), rien n'est écrit ni supprimé.
    expect(ecritures).toEqual([]);
    expect(await TestBed.inject(SOURCE_COMPTE).uidCourant()).toBe(UID);
  });

  it('critère 1 (suite) : given mon compte est déjà lié à Google, when je rouvre Compte, then « Connecté avec Google », mon adresse et aucun bouton de connexion', async () => {
    const { page } = await ouvrir({ dejaLie: { fournisseur: 'google', email: 'camille@example.test' } });

    expect(texte(page)).toContain(compact('Connecté avec Google'));
    expect(texte(page)).toContain(compact('camille@example.test'));
    expect(bouton(page, 'Continuer avec')).toBeUndefined();
  });

  it('critère 2 : given mon compte est anonyme, when je touche « Continuer avec Apple » et je valide la connexion, then Compte affiche « Connecté avec Apple » et ma boîte et mes spots sont inchangés', async () => {
    const { page, stabiliser, appels, ecritures } = await ouvrir({ lier: async () => ({ fournisseur: 'apple', email: null }) });

    await toucher(page, 'Continuer avec Apple', stabiliser);

    expect(appels).toEqual(['apple']);
    const t = texte(page);
    expect(t).toContain(compact('Connecté avec Apple'));
    expect(t).toContain(compact(LIE));
    expect(t).not.toContain('@'); // pas d'adresse quand le fournisseur n'en donne pas
    expect(bouton(page, 'Continuer avec')).toBeUndefined();
    expect(ecritures).toEqual([]);
  });

  it('critère 2 (suite) : given je suis en train de me connecter, when la fenêtre est ouverte, then les deux boutons sont désactivés et « Connexion en cours… » s\'affiche', async () => {
    let finir!: (c: CompteLie) => void;
    const { page, stabiliser } = await ouvrir({ lier: () => new Promise<CompteLie>((r) => (finir = r)) });

    await toucher(page, 'Continuer avec Google', stabiliser);

    expect(texte(page)).toContain(compact('Connexion en cours…'));
    expect(estDesactive(bouton(page, 'Continuer avec Apple')!)).toBe(true);
    expect(estDesactive(bouton(page, 'Continuer avec Google')!)).toBe(true);

    finir({ fournisseur: 'google', email: null });
    await stabiliser();
    expect(texte(page)).toContain(compact('Connecté avec Google'));
    expect(texte(page)).not.toContain(compact('Connexion en cours…'));
  });

  for (const [libelle, fournisseur] of [
    ['Continuer avec Google', 'google'],
    ['Continuer avec Apple', 'apple'],
  ] as const) {
    it(`critère 3 : given le compte ${fournisseur} choisi est déjà lié à un autre profil Leurio, when je valide la connexion, then « ${DEJA_ASSOCIE} » s'affiche (role="alert") et mes données restent sur le compte anonyme`, async () => {
      const { page, stabiliser, appels, ecritures } = await ouvrir({ lier: async () => Promise.reject(erreur('auth/credential-already-in-use')) });

      await toucher(page, libelle, stabiliser);

      expect(appels).toEqual([fournisseur]);
      const alerte = page.querySelector('[role="alert"]');
      expect(alerte, 'message role="alert"').not.toBeNull();
      expect(compact(alerte!.textContent)).toBe(compact(DEJA_ASSOCIE));
      exigerEtatAnonyme(page);
      expect(texte(page)).not.toContain(compact('Connexion en cours…'));
      expect(estDesactive(bouton(page, 'Continuer avec Google')!)).toBe(false);
      expect(ecritures).toEqual([]);
      expect(await TestBed.inject(SOURCE_COMPTE).uidCourant()).toBe(UID);
    });
  }

  for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) {
    it(`critère 4 : given la fenêtre de connexion est ouverte, when je l'annule (${code}), then le compte reste anonyme sans message d'erreur`, async () => {
      const { page, stabiliser, appels } = await ouvrir({ lier: async () => Promise.reject(erreur(code)) });

      await toucher(page, 'Continuer avec Google', stabiliser);

      expect(appels).toEqual(['google']);
      exigerEtatAnonyme(page);
      aucunMessage(page);
      expect(texte(page)).not.toContain(compact('Connexion en cours…'));
      expect(estDesactive(bouton(page, 'Continuer avec Apple')!)).toBe(false);
      expect(estDesactive(bouton(page, 'Continuer avec Google')!)).toBe(false);
    });
  }

  for (const [libelle, fournisseur] of [
    ['Continuer avec Google', 'google'],
    ['Continuer avec Apple', 'apple'],
  ] as const) {
    it(`critère 5 : given je n'ai pas de réseau, when je touche « ${libelle} », then « ${HORS_LIGNE} » s'affiche (role="status") et aucune fenêtre de connexion ne s'ouvre (${fournisseur})`, async () => {
      const { page, stabiliser, appels } = await ouvrir();
      simulerEnLigne(false);

      await toucher(page, libelle, stabiliser);

      const statut = page.querySelector('[role="status"]');
      expect(statut, 'message role="status"').not.toBeNull();
      expect(compact(statut!.textContent)).toBe(compact(HORS_LIGNE));
      expect(appels, 'la fenêtre de connexion ne s\'ouvre pas').toEqual([]);
      exigerEtatAnonyme(page);
    });
  }

  it('critère 5 (suite) : given le réseau tombe pendant la connexion (auth/network-request-failed), when je touche « Continuer avec Google », then « Connecte-toi à internet pour te connecter. » s\'affiche et le compte reste anonyme', async () => {
    const { page, stabiliser } = await ouvrir({ lier: async () => Promise.reject(erreur('auth/network-request-failed')) });

    await toucher(page, 'Continuer avec Google', stabiliser);

    expect(compact(page.querySelector('[role="status"]')?.textContent)).toBe(compact(HORS_LIGNE));
    exigerEtatAnonyme(page);
  });

  it('critère 6 : given un utilisateur existe, when on lit users/{uid}, then il contient un champ plan (« free ») et aucun écran ne propose de fonctionnalité payante', async () => {
    // Le profil écrit pour un nouvel utilisateur porte plan « free » (CompteService, comme à l'US 90).
    const profils: Record<string, unknown>[] = [];
    const { CompteService } = await import('../../core/data/compte.service');
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        {
          provide: SOURCE_COMPTE,
          useValue: { uidCourant: async () => null, connecterAnonymement: async () => UID, profilExiste: async () => false, ecrireProfil: async (_u: string, d: Record<string, unknown>) => void profils.push(d) },
        },
      ],
    }).compileComponents();
    await TestBed.inject(CompteService).assurerCompte({ niveau: 'debutant', especesFavorites: [] });
    expect(profils).toHaveLength(1);
    expect(profils[0]['plan']).toBe('free');

    // Aucun écran Compte (anonyme ou lié) ne propose de fonctionnalité payante.
    TestBed.resetTestingModule();
    for (const dejaLie of [null, { fournisseur: 'google', email: 'camille@example.test' } as CompteLie]) {
      const { page } = await ouvrir({ dejaLie });
      const t = page.querySelector('ion-content')?.textContent ?? '';
      expect(t).not.toMatch(/\b(pro|premium|payant|payante|abonnement|abonner|tarif|prix|acheter|upgrade)\b|€|\$/i);
      expect(trouver(page, 'Compte')).toBeTruthy();
      TestBed.resetTestingModule();
    }
  });
});
