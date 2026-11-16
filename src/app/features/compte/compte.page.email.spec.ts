/*
 * US 96 : convertir mon compte anonyme avec une adresse e-mail (PLAN §2.5, §4, §7).
 * Maquette validée : docs/maquettes/us-96-compte-e-mail.html.
 *
 * CONTRAT À IMPLÉMENTER (le développeur crée exactement ceci) :
 *
 *  src/app/core/data/liaison-compte.ts
 *    export type FournisseurLiaison = 'google' | 'apple' | 'email';
 *    export interface SourceLiaison {
 *      ... (US 95 inchangé)
 *      // Lie le compte anonyme courant à l'adresse et au mot de passe (EmailAuthProvider.credential + linkWithCredential :
 *      // même uid, rien n'est copié ni supprimé, aucun e-mail de vérification). Rend { fournisseur: 'email', email }.
 *      // Rejette avec un objet portant `code` : 'auth/email-already-in-use' (adresse d'un autre compte),
 *      // 'auth/network-request-failed' (réseau coupé), etc.
 *      lierEmail(email: string, motDePasse: string): Promise<CompteLie>;
 *    }
 *  src/app/core/firebase/source-liaison.ts : versCompteLie rend 'email' pour le providerId 'password'
 *    (testé dans source-liaison.email.spec.ts).
 *
 *  src/app/features/compte/compte.page.ts, groupe « Ton compte » (anonyme) :
 *   - Explication : « Lie-le à Google, à Apple ou à ton e-mail pour garder ta boîte et tes spots si tu changes de téléphone. »
 *   - Trois boutons dans l'ordre « Continuer avec Apple », « Continuer avec Google », « Continuer avec l’e-mail ».
 *   - Toucher « Continuer avec l’e-mail » : ce bouton est remplacé par les champs libellés « E-mail » (input type=email)
 *     et « Mot de passe » (input type=password, aide « Au moins 6 caractères. ») et par le bouton « Créer mon compte ».
 *   - « Créer mon compte » : l'adresse et le mot de passe sont vérifiés sur l'appareil AVANT l'envoi (lierEmail n'est
 *     alors pas appelé) ; messages role="alert" « Adresse e-mail invalide. » et
 *     « Le mot de passe doit contenir au moins 6 caractères. ».
 *   - Hors ligne (navigator.onLine === false) : lierEmail n'est pas appelé ; role="status" « Connecte-toi à internet pour te connecter. ».
 *   - En cours : tous les boutons désactivés, « Connexion en cours… ».
 *   - Succès : « Connecté avec l’e-mail », l'adresse, « Ta boîte et tes spots sont liés à ce compte. », ni bouton ni formulaire.
 *   - 'auth/email-already-in-use' : role="alert" « Cette adresse est déjà utilisée. », le compte reste anonyme.
 *   - Le composant n'écrit jamais dans la boîte, les spots ni le profil, et ne supprime rien.
 *
 * Les tests passent par l'app réelle (App + routes) avec des doubles ; aucun service réel. `lierEmail` et le
 * fournisseur 'email' n'existent pas encore : les doubles sont typés par conversion pour que les tests échouent à
 * l'exécution, pas à la compilation.
 */
import { HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { SOURCE_COMPTE } from '../../core/data/compte.service';
import { CompteLie, SOURCE_LIAISON, SourceLiaison } from '../../core/data/liaison-compte';
import { SOURCE_SPOTS } from '../../core/data/spots.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { CONTENU, compact } from './compte-informations.doubles';

const UID = 'uid-anonyme-96';
const EXPLICATION = 'Lie-le à Google, à Apple ou à ton e-mail pour garder ta boîte et tes spots si tu changes de téléphone.';
const INVALIDE = 'Adresse e-mail invalide.';
const COURT = 'Le mot de passe doit contenir au moins 6 caractères.';
const DEJA_UTILISEE = 'Cette adresse est déjà utilisée.';
const HORS_LIGNE = 'Connecte-toi à internet pour te connecter.';
const LIE = 'Ta boîte et tes spots sont liés à ce compte.';
const ADRESSE = 'camille.martin@free.fr';
const MOT_DE_PASSE = 'secret6';
/** Le libellé du bouton, avec l'apostrophe typographique de l'app ou l'apostrophe droite des critères. */
const BOUTON_EMAIL = /Continuer avec l['’]e-mail/;
// Comparé au texte compacté (sans espaces) de la page.
const CONNECTE_EMAIL = /Connectéavecl['’]e-mail/;

const contenu: HttpInterceptorFn = (req) => {
  const m = /assets\/data\/([^/]+)\.json$/.exec(req.url);
  if (m && m[1] in CONTENU) return of(new HttpResponse({ status: 200, body: CONTENU[m[1]] }));
  return throwError(() => new Error(`requête non prévue : ${req.url}`));
};

interface Options {
  dejaLie?: unknown;
  /** Comportement de `lierEmail` ; par défaut : succès avec l'adresse donnée. */
  lierEmail?: (email: string, motDePasse: string) => Promise<unknown>;
}

async function ouvrir(options: Options = {}) {
  const appels: { email: string; motDePasse: string }[] = [];
  const autres: string[] = [];
  const ecritures: string[] = [];
  const source = {
    compteLie: async () => (options.dejaLie ?? null) as CompteLie | null,
    lier: async (f: string) => {
      autres.push(f);
      return { fournisseur: f, email: null } as unknown as CompteLie;
    },
    lierEmail: (email: string, motDePasse: string) => {
      appels.push({ email, motDePasse });
      return (options.lierEmail ?? (async (e: string) => ({ fournisseur: 'email', email: e })))(email, motDePasse);
    },
  } as unknown as SourceLiaison;
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
  return { page, stabiliser, appels, autres, ecritures };
}

const texte = (page: HTMLElement) => compact(page.querySelector('ion-content')?.textContent);
const boutons = (page: HTMLElement) => Array.from(page.querySelectorAll<HTMLElement>('button, ion-button'));
const libelles = (page: HTMLElement) => boutons(page).map((b) => compact(b.textContent));
const boutonParNom = (page: HTMLElement, nom: string | RegExp) =>
  boutons(page).find((b) => (typeof nom === 'string' ? compact(b.textContent) === compact(nom) : nom.test((b.textContent ?? '').trim())));
const estDesactive = (b: HTMLElement) => b.hasAttribute('disabled') || (b as HTMLButtonElement).disabled === true || b.getAttribute('aria-disabled') === 'true';
const erreur = (code: string) => Object.assign(new Error(code), { code });

/** Le champ de saisie dont l'étiquette visible commence par `etiquette` (label englobant, label[for] ou aria-label). */
function champ(page: HTMLElement, etiquette: string): HTMLInputElement | undefined {
  for (const label of Array.from(page.querySelectorAll('label'))) {
    if (!compact(label.textContent).startsWith(compact(etiquette))) continue;
    const cible = label.querySelector('input') ?? (label.htmlFor ? page.querySelector<HTMLInputElement>(`input[id="${label.htmlFor}"]`) : null);
    if (cible) return cible as HTMLInputElement;
  }
  return Array.from(page.querySelectorAll<HTMLInputElement>('input')).find((i) => compact(i.getAttribute('aria-label')) === compact(etiquette));
}

function saisir(page: HTMLElement, etiquette: string, valeur: string) {
  const input = champ(page, etiquette);
  if (!input) throw new Error(`champ introuvable : « ${etiquette} »`);
  input.value = valeur;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function toucherBouton(page: HTMLElement, nom: string | RegExp, stabiliser: () => Promise<void>) {
  const b = boutonParNom(page, nom);
  if (!b) throw new Error(`bouton introuvable : ${nom}`);
  b.click();
  await stabiliser();
}

/** Ouvre le formulaire, le remplit puis touche « Créer mon compte ». */
async function creer(page: HTMLElement, stabiliser: () => Promise<void>, email: string, motDePasse: string) {
  await toucherBouton(page, BOUTON_EMAIL, stabiliser);
  saisir(page, 'E-mail', email);
  saisir(page, 'Mot de passe', motDePasse);
  await stabiliser();
  await toucherBouton(page, 'Créer mon compte', stabiliser);
}

function exigerAnonyme(page: HTMLElement) {
  const t = texte(page);
  expect(t, 'titre anonyme').toContain(compact('Compte anonyme'));
  expect(t, 'explication').toContain(compact(EXPLICATION));
  expect(t).not.toMatch(CONNECTE_EMAIL);
  expect(t).not.toContain(compact('Connecté avec'));
}

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

describe('US 96 : lier mon compte anonyme à mon adresse e-mail', () => {
  it("état de départ : given mon compte est anonyme, when j'ouvre Compte, then l'explication cite l'e-mail et « Continuer avec l'e-mail » vient après Apple et Google, sans champ", async () => {
    const { page } = await ouvrir();

    exigerAnonyme(page);
    const attendus = [compact('Continuer avec Apple'), compact('Continuer avec Google')];
    const continuer = libelles(page).filter((l) => l.startsWith(compact('Continuer avec')));
    expect(continuer.slice(0, 2)).toEqual(attendus);
    expect(continuer).toHaveLength(3);
    expect(boutonParNom(page, BOUTON_EMAIL), 'bouton e-mail').toBeDefined();
    expect(page.querySelector('input[type="email"], input[type="password"]')).toBeNull();
    expect(boutonParNom(page, 'Créer mon compte')).toBeUndefined();
  });

  it("critère 1 : given mon compte est anonyme, when je touche « Continuer avec l'e-mail », then les champs « E-mail » et « Mot de passe » et le bouton « Créer mon compte » s'affichent", async () => {
    const { page, stabiliser, appels } = await ouvrir();

    await toucherBouton(page, BOUTON_EMAIL, stabiliser);

    expect(champ(page, 'E-mail'), 'champ E-mail').toBeDefined();
    expect(champ(page, 'E-mail')!.type).toBe('email');
    expect(champ(page, 'Mot de passe'), 'champ Mot de passe').toBeDefined();
    expect(champ(page, 'Mot de passe')!.type).toBe('password');
    expect(texte(page)).toContain(compact('Au moins 6 caractères.'));
    expect(boutonParNom(page, 'Créer mon compte'), 'bouton Créer mon compte').toBeDefined();
    expect(boutonParNom(page, BOUTON_EMAIL), 'le bouton e-mail laisse la place au formulaire').toBeUndefined();
    exigerAnonyme(page);
    expect(appels, 'rien n\'est envoyé tant que je ne valide pas').toEqual([]);
  });

  it("critère 2 : given le formulaire est rempli avec une adresse valide et un mot de passe d'au moins 6 caractères, when je touche « Créer mon compte », then Compte affiche « Connecté avec l'e-mail » et mon adresse, et ma boîte et mes spots sont inchangés", async () => {
    const { page, stabiliser, appels, autres, ecritures } = await ouvrir();

    await creer(page, stabiliser, ADRESSE, MOT_DE_PASSE);

    expect(appels).toEqual([{ email: ADRESSE, motDePasse: MOT_DE_PASSE }]);
    expect(autres, 'aucune fenêtre Google ou Apple').toEqual([]);
    const t = texte(page);
    expect(t).toMatch(CONNECTE_EMAIL);
    expect(t).toContain(compact(ADRESSE));
    expect(t).toContain(compact(LIE));
    expect(t).not.toContain(compact('Compte anonyme'));
    expect(page.querySelector('input[type="email"], input[type="password"]'), 'plus de formulaire').toBeNull();
    expect(boutonParNom(page, 'Créer mon compte')).toBeUndefined();
    expect(libelles(page).filter((l) => l.startsWith(compact('Continuer avec')))).toEqual([]);
    expect(page.querySelector('[role="alert"], [role="status"]')).toBeNull();
    // Boîte et spots inchangés : le compte est lié (même uid), rien n'est écrit ni supprimé.
    expect(ecritures).toEqual([]);
    expect(await TestBed.inject(SOURCE_COMPTE).uidCourant()).toBe(UID);
  });

  it("critère 2 (suite) : given mon compte est déjà lié à l'e-mail, when je rouvre Compte, then « Connecté avec l'e-mail », mon adresse et aucun bouton ni formulaire", async () => {
    const { page } = await ouvrir({ dejaLie: { fournisseur: 'email', email: ADRESSE } });

    const t = texte(page);
    expect(t).toMatch(CONNECTE_EMAIL);
    expect(t).toContain(compact(ADRESSE));
    expect(t).toContain(compact(LIE));
    expect(libelles(page).filter((l) => l.startsWith(compact('Continuer avec')))).toEqual([]);
    expect(page.querySelector('input[type="email"]')).toBeNull();
  });

  it("critère 2 (suite) : given je suis en train de créer mon compte, when Firebase n'a pas répondu, then tous les boutons sont désactivés et « Connexion en cours… » s'affiche", async () => {
    let finir!: (c: unknown) => void;
    const { page, stabiliser } = await ouvrir({ lierEmail: () => new Promise((r) => (finir = r)) });

    await creer(page, stabiliser, ADRESSE, MOT_DE_PASSE);

    expect(texte(page)).toContain(compact('Connexion en cours…'));
    for (const nom of ['Continuer avec Apple', 'Continuer avec Google', 'Créer mon compte']) {
      expect(estDesactive(boutonParNom(page, nom)!), nom).toBe(true);
    }

    finir({ fournisseur: 'email', email: ADRESSE });
    await stabiliser();
    expect(texte(page)).toMatch(CONNECTE_EMAIL);
    expect(texte(page)).not.toContain(compact('Connexion en cours…'));
  });

  for (const invalide of ['camille.martin', 'camille.martin@free', '@free.fr', 'camille martin@free.fr', '']) {
    it(`critère 3 : given l'adresse saisie est invalide (« ${invalide} »), when je touche « Créer mon compte », then « ${INVALIDE} » s'affiche (role="alert"), rien n'est envoyé et le compte reste anonyme`, async () => {
      const { page, stabiliser, appels, ecritures } = await ouvrir();

      await creer(page, stabiliser, invalide, MOT_DE_PASSE);

      const alerte = page.querySelector('[role="alert"]');
      expect(alerte, 'message role="alert"').not.toBeNull();
      expect(compact(alerte!.textContent)).toBe(compact(INVALIDE));
      expect(appels, 'la liaison n\'est pas appelée').toEqual([]);
      exigerAnonyme(page);
      expect(champ(page, 'E-mail'), 'le formulaire reste affiché').toBeDefined();
      expect(ecritures).toEqual([]);
    });
  }

  for (const court of ['', '12345', 'abc']) {
    it(`critère 4 : given le mot de passe a moins de 6 caractères (« ${court} »), when je touche « Créer mon compte », then « ${COURT} » s'affiche (role="alert"), rien n'est envoyé et le compte reste anonyme`, async () => {
      const { page, stabiliser, appels, ecritures } = await ouvrir();

      await creer(page, stabiliser, ADRESSE, court);

      const alerte = page.querySelector('[role="alert"]');
      expect(alerte, 'message role="alert"').not.toBeNull();
      expect(compact(alerte!.textContent)).toBe(compact(COURT));
      expect(appels, 'la liaison n\'est pas appelée').toEqual([]);
      exigerAnonyme(page);
      expect(champ(page, 'Mot de passe'), 'le formulaire reste affiché').toBeDefined();
      expect(ecritures).toEqual([]);
    });
  }

  it("critère 5 : given l'adresse est déjà utilisée par un autre compte, when je touche « Créer mon compte », then « Cette adresse est déjà utilisée. » s'affiche (role=\"alert\") et le compte reste anonyme", async () => {
    const { page, stabiliser, appels, ecritures } = await ouvrir({ lierEmail: async () => Promise.reject(erreur('auth/email-already-in-use')) });

    await creer(page, stabiliser, ADRESSE, MOT_DE_PASSE);

    expect(appels).toEqual([{ email: ADRESSE, motDePasse: MOT_DE_PASSE }]);
    const alerte = page.querySelector('[role="alert"]');
    expect(alerte, 'message role="alert"').not.toBeNull();
    expect(compact(alerte!.textContent)).toBe(compact(DEJA_UTILISEE));
    exigerAnonyme(page);
    expect(texte(page)).not.toContain(compact('Connexion en cours…'));
    expect(estDesactive(boutonParNom(page, 'Créer mon compte')!)).toBe(false);
    expect(estDesactive(boutonParNom(page, 'Continuer avec Google')!)).toBe(false);
    expect(ecritures).toEqual([]);
    expect(await TestBed.inject(SOURCE_COMPTE).uidCourant()).toBe(UID);
  });

  it("hors ligne : given je n'ai pas de réseau, when je touche « Créer mon compte », then « Connecte-toi à internet pour te connecter. » s'affiche (role=\"status\"), rien n'est envoyé et le compte reste anonyme", async () => {
    const { page, stabiliser, appels } = await ouvrir();
    await toucherBouton(page, BOUTON_EMAIL, stabiliser);
    saisir(page, 'E-mail', ADRESSE);
    saisir(page, 'Mot de passe', MOT_DE_PASSE);
    simulerEnLigne(false);

    await toucherBouton(page, 'Créer mon compte', stabiliser);

    const statut = page.querySelector('[role="status"]');
    expect(statut, 'message role="status"').not.toBeNull();
    expect(compact(statut!.textContent)).toBe(compact(HORS_LIGNE));
    expect(appels).toEqual([]);
    exigerAnonyme(page);
  });
});
