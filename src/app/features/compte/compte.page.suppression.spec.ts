/*
 * US 98 : « Supprimer mon compte » dans l'écran Compte (PLAN §2.5, §4, §7). Maquette : docs/maquettes/us-98-supprimer-mon-compte.html.
 *
 * CONTRAT À IMPLÉMENTER (le développeur crée exactement ceci) :
 *
 *  src/app/core/data/suppression-compte.service.ts
 *    import type { FournisseurLiaison } from './liaison-compte';
 *    export interface SourceSuppression {
 *      // Le fournisseur avec lequel se reconnecter avant de supprimer (compte lié dont la connexion date de plus de 5 min) ;
 *      // `null` sinon (compte anonyme ou connexion récente).
 *      reconnexionRequise(): Promise<FournisseurLiaison | null>;
 *      // Reconnexion par fenêtre ; rejette avec un objet portant `code`.
 *      reconnecter(fournisseur: 'google' | 'apple'): Promise<void>;
 *      // Reconnexion par mot de passe ; rejette avec un objet portant `code`.
 *      reconnecterEmail(motDePasse: string): Promise<void>;
 *      // Supprime les photos de users/{uid}/lures dans Storage, les documents de users/{uid}/tackleBox et users/{uid}/spots, puis users/{uid}.
 *      supprimerDonnees(): Promise<void>;
 *      // Supprime le compte d'authentification ; rejette avec { code: 'auth/requires-recent-login' } si la connexion n'est plus récente.
 *      supprimerCompte(): Promise<void>;
 *    }
 *    export const SOURCE_SUPPRESSION: InjectionToken<SourceSuppression>;   // providedIn root, fabrique : creerSourceSuppressionFirebase
 *  src/app/core/firebase/source-suppression.ts : export function creerSourceSuppressionFirebase(injector: Injector): SourceSuppression
 *
 *  Contrat du DOM (écran Compte) :
 *   - Groupe « Mes données » : sous « Exporter mes données », une rangée-bouton « Supprimer mon compte » (sous-titre « Compte, boîte, spots et photos »),
 *     pour tout compte (anonyme compris).
 *   - Toucher la rangée ouvre un `[role="alertdialog"]` « Supprimer définitivement ton compte, ta boîte et tes spots ? » avec le texte
 *     « Tes leurres, leurs photos et tes spots seront effacés. Cette action est irréversible. » et les boutons « Supprimer définitivement » et « Annuler ».
 *   - Pendant la suppression la rangée est `disabled` et son sous-titre est « Suppression en cours… ».
 *   - Succès : navigation vers `/onboarding` (page 1), les clés localStorage `leurio.onboarding` et `leurio.compte` sont retirées.
 *   - Hors ligne (navigator.onLine === false) : la confirmation se ferme, `[role="status"]` « Connecte-toi à internet pour supprimer ton compte. », rien n'est appelé.
 *   - Reconnexion (avant toute suppression) : un second `[role="alertdialog"]` « Reconnecte-toi pour supprimer ton compte ». Google / Apple : texte
 *     « Par sécurité, confirme que c’est bien toi. », boutons « Continuer avec Google » (ou Apple) et « Annuler ». E-mail : texte « Saisis le mot de passe de <adresse>. »
 *     (adresse de SOURCE_LIAISON.compteLie()), un champ `input[type=password]`, boutons « Supprimer définitivement » et « Annuler ».
 *   - Si `supprimerCompte` rejette encore avec auth/requires-recent-login après `supprimerDonnees`, la reconnexion est demandée, puis `supprimerCompte`
 *     est rappelé (pas `supprimerDonnees`).
 *   - Erreurs en `[role="alert"]` : auth/wrong-password ou auth/invalid-credential : « Mot de passe incorrect. » ; fenêtre fermée
 *     (auth/popup-closed-by-user, auth/cancelled-popup-request, auth/user-cancelled) : aucun message ; autre échec : « La suppression n’a pas abouti. Réessaie. ».
 *     Après un échec de reconnexion, rien n'est supprimé.
 *
 * Les tests passent par l'app réelle (App + routes) avec un double enregistreur de SOURCE_SUPPRESSION ; aucun service réel.
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FournisseurLiaison } from '../../core/data/liaison-compte';
import { SOURCE_SUPPRESSION, SourceSuppression } from '../../core/data/suppression-compte.service';
import { compact, ouvrirCompte, toucher, trouver } from './compte-informations.doubles';

const TITRE = 'Supprimer définitivement ton compte, ta boîte et tes spots ?';
const TEXTE = 'Tes leurres, leurs photos et tes spots seront effacés. Cette action est irréversible.';
const TITRE_RECO = 'Reconnecte-toi pour supprimer ton compte';
const HORS_LIGNE = 'Connecte-toi à internet pour supprimer ton compte.';
const ECHEC = 'La suppression n’a pas abouti. Réessaie.';
const ADRESSE = 'camille@exemple.fr';

interface Options {
  reconnexion?: FournisseurLiaison | null;
  /** Fournisseur du compte lié (SOURCE_LIAISON) quand `reconnexion` est null. */
  lie?: FournisseurLiaison;
  reconnecter?: (f: 'google' | 'apple') => Promise<void>;
  reconnecterEmail?: (m: string) => Promise<void>;
  supprimerDonnees?: () => Promise<void>;
  supprimerCompte?: () => Promise<void>;
}

async function ouvrir(o: Options = {}) {
  const appels: string[] = [];
  const source: SourceSuppression = {
    reconnexionRequise: async () => o.reconnexion ?? null,
    reconnecter: async (f: 'google' | 'apple') => {
      appels.push(`reconnecter:${f}`);
      await o.reconnecter?.(f);
    },
    reconnecterEmail: async (m: string) => {
      appels.push(`reconnecterEmail:${m}`);
      await o.reconnecterEmail?.(m);
    },
    supprimerDonnees: async () => {
      appels.push('supprimerDonnees');
      await o.supprimerDonnees?.();
    },
    supprimerCompte: async () => {
      appels.push('supprimerCompte');
      await o.supprimerCompte?.();
    },
  };
  const f = o.reconnexion ?? o.lie;
  const compteLie = f ? { fournisseur: f, email: f === 'apple' ? null : ADRESSE } : null;
  const app = await ouvrirCompte({ compteLie, providers: [{ provide: SOURCE_SUPPRESSION, useValue: source }] });
  return { ...app, appels };
}

function definirEnLigne(valeur: boolean | undefined) {
  if (valeur === undefined) delete (navigator as unknown as Record<string, unknown>)['onLine'];
  else Object.defineProperty(navigator, 'onLine', { value: valeur, configurable: true });
}

const rangee = (page: HTMLElement) => trouver(page, 'Supprimer mon compte')?.closest('button') as HTMLButtonElement | null | undefined;
const dialogues = () => [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')];
const dialogue = (titre: string) => dialogues().find((d) => compact(d.textContent).includes(compact(titre)));
const bouton = (d: HTMLElement | undefined, texte: string) =>
  [...(d?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) => compact(b.textContent) === compact(texte));
async function toucherDans(titre: string, texte: string, stabiliser: () => Promise<void>) {
  const b = bouton(dialogue(titre), texte);
  if (!b) throw new Error(`Aucun bouton « ${texte} » dans le dialogue « ${titre} »`);
  b.click();
  await stabiliser();
}
async function confirmer(page: HTMLElement, stabiliser: () => Promise<void>) {
  await toucher(page, 'Supprimer mon compte', stabiliser);
  await toucherDans(TITRE, 'Supprimer définitivement', stabiliser);
}
const erreur = (page: HTMLElement) => compact(page.querySelector('[role="alert"]')?.textContent);

beforeEach(() => {
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
  localStorage.setItem('leurio.compte', '1');
});
afterEach(() => {
  document.querySelectorAll('ion-alert').forEach((a) => a.remove());
  definirEnLigne(undefined);
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 98 : « Supprimer mon compte » dans Compte', () => {
  it('given j\'ouvre Compte, when je regarde « Mes données », then « Supprimer mon compte » et son sous-titre sont sous « Exporter mes données »', async () => {
    const { page } = await ouvrir();
    const texte = compact(page.querySelector('ion-content')!.textContent);

    expect(rangee(page), 'bouton Supprimer mon compte').toBeTruthy();
    expect(texte).toContain(compact('Compte, boîte, spots et photos'));
    expect(texte.indexOf(compact('Supprimer mon compte'))).toBeGreaterThan(texte.indexOf(compact('Exporter mes données')));
  });

  it('critère 1 : given l\'onglet « Compte » est affiché, when je touche « Supprimer mon compte », then la confirmation propose « Supprimer définitivement » et « Annuler »', async () => {
    const { page, stabiliser, appels } = await ouvrir();

    await toucher(page, 'Supprimer mon compte', stabiliser);

    const d = dialogue(TITRE);
    expect(d, 'confirmation').toBeTruthy();
    expect(compact(d!.textContent)).toContain(compact(TEXTE));
    expect(bouton(d, 'Supprimer définitivement')).toBeTruthy();
    expect(bouton(d, 'Annuler')).toBeTruthy();
    expect(appels).toEqual([]);
  });

  it('critère 2 : given la confirmation est affichée, when je touche « Annuler », then elle se ferme et rien n\'est supprimé', async () => {
    const { page, stabiliser, appels } = await ouvrir();
    await toucher(page, 'Supprimer mon compte', stabiliser);

    await toucherDans(TITRE, 'Annuler', stabiliser);
    await new Promise((r) => setTimeout(r, 600));
    await stabiliser();

    expect(dialogue(TITRE)).toBeUndefined();
    expect(appels).toEqual([]);
    expect(TestBed.inject(Router).url).toBe('/compte');
    expect(localStorage.getItem('leurio.onboarding')).not.toBeNull();
    expect(rangee(page)!.disabled).toBe(false);
  });

  it('critère 3 : given la confirmation est affichée et j\'ai du réseau, when je touche « Supprimer définitivement », then les données sont supprimées, puis le compte', async () => {
    const { page, stabiliser, appels } = await ouvrir();

    await confirmer(page, stabiliser);

    expect(appels).toEqual(['supprimerDonnees', 'supprimerCompte']);
  });

  it('critère 3 : given la suppression a abouti, when elle se termine, then l\'app revient à la page 1 de l\'onboarding, choix et marqueur du téléphone effacés', async () => {
    const { page, stabiliser } = await ouvrir();

    await confirmer(page, stabiliser);

    expect(TestBed.inject(Router).url).toBe('/onboarding');
    expect(compact(page.textContent)).toContain(compact('Leurio, ton conseil de pêche au leurre'));
    expect(localStorage.getItem('leurio.onboarding')).toBeNull();
    expect(localStorage.getItem('leurio.compte')).toBeNull();
  });

  it('given la suppression est en cours, when je regarde la rangée, then elle est inactive et dit « Suppression en cours… »', async () => {
    let finir!: () => void;
    const attente = new Promise<void>((r) => (finir = r));
    const { page, stabiliser } = await ouvrir({ supprimerDonnees: () => attente });

    await confirmer(page, stabiliser);

    expect(rangee(page)!.disabled).toBe(true);
    expect(compact(page.textContent)).toContain(compact('Suppression en cours…'));
    finir();
    await stabiliser();
  });

  it('critère 4 : given je n\'ai pas de réseau, when je touche « Supprimer définitivement », then « Connecte-toi à internet pour supprimer ton compte. » s\'affiche et rien n\'est supprimé', async () => {
    definirEnLigne(false);
    const { page, stabiliser, appels } = await ouvrir();

    await confirmer(page, stabiliser);

    expect(compact(page.querySelector('[role="status"]')?.textContent)).toBe(compact(HORS_LIGNE));
    expect(appels).toEqual([]);
    expect(TestBed.inject(Router).url).toBe('/compte');
    expect(localStorage.getItem('leurio.onboarding')).not.toBeNull();
    expect(rangee(page)!.disabled).toBe(false);
  });

  it('critère 5 : given mon compte Google demande une connexion récente, when je touche « Supprimer définitivement », then la reconnexion est demandée avant toute suppression, puis « Continuer avec Google » reconnecte et supprime', async () => {
    const { page, stabiliser, appels } = await ouvrir({ reconnexion: 'google' });

    await confirmer(page, stabiliser);

    const d = dialogue(TITRE_RECO);
    expect(d, 'dialogue de reconnexion').toBeTruthy();
    expect(compact(d!.textContent)).toContain(compact('Par sécurité, confirme que c’est bien toi.'));
    expect(bouton(d, 'Annuler')).toBeTruthy();
    expect(appels).toEqual([]);

    await toucherDans(TITRE_RECO, 'Continuer avec Google', stabiliser);

    expect(appels).toEqual(['reconnecter:google', 'supprimerDonnees', 'supprimerCompte']);
    expect(TestBed.inject(Router).url).toBe('/onboarding');
  });

  it('critère 5 : given mon compte Apple demande une connexion récente, when je touche « Supprimer définitivement », then « Continuer avec Apple » reconnecte puis supprime', async () => {
    const { page, stabiliser, appels } = await ouvrir({ reconnexion: 'apple' });

    await confirmer(page, stabiliser);
    expect(bouton(dialogue(TITRE_RECO), 'Continuer avec Apple')).toBeTruthy();
    expect(appels).toEqual([]);
    await toucherDans(TITRE_RECO, 'Continuer avec Apple', stabiliser);

    expect(appels).toEqual(['reconnecter:apple', 'supprimerDonnees', 'supprimerCompte']);
  });

  it('critère 5 : given mon compte e-mail demande une connexion récente, when je saisis mon mot de passe et touche « Supprimer définitivement », then je suis reconnecté puis le compte est supprimé', async () => {
    const { page, stabiliser, appels } = await ouvrir({ reconnexion: 'email' });

    await confirmer(page, stabiliser);

    const d = dialogue(TITRE_RECO);
    expect(compact(d?.textContent)).toContain(compact(`Saisis le mot de passe de ${ADRESSE}.`));
    const champ = d!.querySelector<HTMLInputElement>('input[type="password"]');
    expect(champ, 'champ mot de passe').toBeTruthy();
    expect(appels).toEqual([]);
    champ!.value = 'secret';
    champ!.dispatchEvent(new Event('input', { bubbles: true }));
    await toucherDans(TITRE_RECO, 'Supprimer définitivement', stabiliser);

    expect(appels).toEqual(['reconnecterEmail:secret', 'supprimerDonnees', 'supprimerCompte']);
    expect(TestBed.inject(Router).url).toBe('/onboarding');
  });

  it('critère 5 : given la connexion n\'est plus récente après l\'effacement des données, when supprimerCompte la refuse, then je me reconnecte et seul supprimerCompte est rappelé', async () => {
    let refus = true;
    const { page, stabiliser, appels } = await ouvrir({
      reconnexion: null,
      lie: 'google',
      supprimerCompte: async () => {
        if (refus) {
          refus = false;
          return Promise.reject({ code: 'auth/requires-recent-login' });
        }
      },
      reconnecter: async () => undefined,
    });

    await confirmer(page, stabiliser);
    expect(appels).toEqual(['supprimerDonnees', 'supprimerCompte']);
    expect(dialogue(TITRE_RECO), 'dialogue de reconnexion').toBeTruthy();
    expect(TestBed.inject(Router).url).toBe('/compte');

    await toucherDans(TITRE_RECO, 'Continuer avec Google', stabiliser);

    expect(appels).toEqual(['supprimerDonnees', 'supprimerCompte', 'reconnecter:google', 'supprimerCompte']);
    expect(TestBed.inject(Router).url).toBe('/onboarding');
  });

  it('given je me trompe de mot de passe, when je touche « Supprimer définitivement », then « Mot de passe incorrect. » s\'affiche et rien n\'est supprimé', async () => {
    const { page, stabiliser, appels } = await ouvrir({ reconnexion: 'email', reconnecterEmail: async () => Promise.reject({ code: 'auth/wrong-password' }) });

    await confirmer(page, stabiliser);
    const champ = dialogue(TITRE_RECO)!.querySelector<HTMLInputElement>('input[type="password"]')!;
    champ.value = 'faux';
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    await toucherDans(TITRE_RECO, 'Supprimer définitivement', stabiliser);

    expect(erreur(page)).toBe(compact('Mot de passe incorrect.'));
    expect(appels).toEqual(['reconnecterEmail:faux']);
    expect(TestBed.inject(Router).url).toBe('/compte');
    expect(rangee(page)!.disabled).toBe(false);
  });

  it('given la fenêtre du fournisseur est fermée, when je me reconnecte, then aucun message ne s\'affiche et rien n\'est supprimé', async () => {
    const { page, stabiliser, appels } = await ouvrir({ reconnexion: 'google', reconnecter: async () => Promise.reject({ code: 'auth/popup-closed-by-user' }) });

    await confirmer(page, stabiliser);
    await toucherDans(TITRE_RECO, 'Continuer avec Google', stabiliser);

    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(appels).toEqual(['reconnecter:google']);
    expect(rangee(page)!.disabled).toBe(false);
  });

  it('given la suppression échoue pour une autre raison, when je confirme, then « La suppression n’a pas abouti. Réessaie. » s\'affiche et je reste sur Compte', async () => {
    const { page, stabiliser } = await ouvrir({ supprimerDonnees: async () => Promise.reject(new Error('panne')) });

    await confirmer(page, stabiliser);

    expect(erreur(page)).toBe(compact(ECHEC));
    expect(TestBed.inject(Router).url).toBe('/compte');
    expect(rangee(page)!.disabled).toBe(false);
  });
});
