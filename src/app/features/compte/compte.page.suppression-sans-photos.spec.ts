/*
 * US 287 : supprimer mon compte quand le stockage des photos n'est pas disponible (forfait Spark, pas de Cloud Storage).
 * PLAN §2.5, §4, §7. Aucun changement d'écran : pas de maquette.
 *
 * Les tests passent par l'écran Compte (App + routes) avec la VRAIE source de suppression (SOURCE_SUPPRESSION par défaut,
 * creerSourceSuppressionFirebase) ; seuls les modules `firebase/*` et `FirebaseService` sont remplacés par des doubles
 * (journal d'appels, aucun réseau). Le stockage double se comporte comme sur le forfait Spark : toute opération Storage échoue.
 *
 * Valeur du flag `photosLeurres` : le double de `FEATURE_FLAGS` (PortFeatureFlags : `estActif(nom)`) est fourni dans TestBed.
 * Sans double, c'est le vrai jeton qui est lu : inerte hors production, il rend la valeur par défaut de `FLAGS`
 * (flag désactivé, comme quand Remote Config est injoignable).
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FEATURE_FLAGS, FLAGS, PortFeatureFlags } from '../../core/firebase/feature-flags';
import { compact, ouvrirCompte, toucher, trouver } from './compte-informations.doubles';

const { journal, etat, auth, storageObtenu, chemin, documents } = vi.hoisted(() => {
  const etat = { storageRepond: false };
  return {
    journal: [] as string[],
    etat,
    storageObtenu: vi.fn(),
    chemin: (...parties: unknown[]) => ({ path: parties.filter((p) => typeof p === 'string').join('/') }),
    documents: { 'users/u1/tackleBox': ['l1', 'l2'], 'users/u1/spots': ['s1'] } as Record<string, string[]>,
    auth: { authStateReady: async () => undefined, currentUser: { uid: 'u1', email: null, providerData: [], metadata: {} } },
  };
});

vi.mock('firebase/firestore', () => ({
  collection: (...a: unknown[]) => chemin(...a),
  doc: (...a: unknown[]) => chemin(...a),
  getDocs: async (c: { path: string }) => ({ metadata: { fromCache: false }, docs: (documents[c.path] ?? []).map((id) => ({ ref: { path: `${c.path}/${id}` } })) }),
  deleteDoc: async (r: { path: string }) => void journal.push(`doc:${r.path}`),
}));
vi.mock('firebase/storage', () => ({
  ref: (...a: unknown[]) => chemin(...a),
  listAll: async (r: { path: string }) => {
    journal.push(`storage:listAll:${r.path}`);
    if (!etat.storageRepond) throw Object.assign(new Error('Cloud Storage indisponible (Spark)'), { code: 'storage/retry-limit-exceeded' });
    return { items: [{ path: `${r.path}/a.jpg` }], prefixes: [] };
  },
  deleteObject: async (r: { path: string }) => {
    journal.push(`storage:deleteObject:${r.path}`);
    if (!etat.storageRepond) throw Object.assign(new Error('Cloud Storage indisponible (Spark)'), { code: 'storage/retry-limit-exceeded' });
    journal.push(`photo:${r.path}`);
  },
}));
vi.mock('firebase/auth', () => ({
  deleteUser: async () => void journal.push('deleteUser'),
}));

const ECHEC = 'La suppression n’a pas abouti. Réessaie.';
const TITRE = 'Supprimer définitivement ton compte, ta boîte et tes spots ?';
const flags = (photosLeurres: boolean): PortFeatureFlags => ({ initialiser: async () => undefined, estActif: (nom) => nom === 'photosLeurres' && photosLeurres });

async function supprimer(photosLeurres?: boolean) {
  const { FirebaseService } = await import('../../core/firebase/firebase.service');
  const providers: unknown[] = [
    {
      provide: FirebaseService,
      useValue: {
        auth,
        db: {},
        get storage() {
          storageObtenu();
          return {};
        },
      },
    },
  ];
  if (photosLeurres !== undefined) providers.push({ provide: FEATURE_FLAGS, useValue: flags(photosLeurres) });
  const { page, stabiliser } = await ouvrirCompte({ providers: providers as never });
  await toucher(page, 'Supprimer mon compte', stabiliser);
  const bouton = [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')]
    .find((d) => compact(d.textContent).includes(compact(TITRE)))
    ?.querySelectorAll('button');
  [...(bouton ?? [])].find((b) => compact(b.textContent) === compact('Supprimer définitivement'))?.click();
  await stabiliser();
  await new Promise((r) => setTimeout(r, 50));
  await stabiliser();
  return page;
}
const erreur = (page: HTMLElement) => compact(page.querySelector('[role="alert"]')?.textContent);
const suppressionReussie = (page: HTMLElement) => {
  expect(TestBed.inject(Router).url).toBe('/onboarding');
  expect(compact(page.textContent)).toContain(compact('Leurio, ton conseil de pêche au leurre'));
  expect(trouver(page, ECHEC)).toBeUndefined();
};

beforeEach(() => {
  journal.length = 0;
  etat.storageRepond = false;
  storageObtenu.mockClear();
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
  localStorage.setItem('leurio.compte', '1');
});
afterEach(() => {
  document.querySelectorAll('ion-alert').forEach((a) => a.remove());
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 287 : supprimer mon compte sans stockage des photos', () => {
  it('critère 1 : given le flag photosLeurres est déclaré désactivé par défaut, when je regarde FLAGS, then photosLeurres vaut false', () => {
    expect(FLAGS).toHaveProperty('photosLeurres', false);
  });

  it('critère 1 : given le flag photosLeurres est désactivé (valeur par défaut, Remote Config injoignable), when je confirme la suppression, then ma boîte, mes spots, mon profil et mon compte sont supprimés et la suppression réussie s\'affiche', async () => {
    const page = await supprimer();

    expect(journal.filter((e) => !e.startsWith('storage:'))).toEqual([
      'doc:users/u1/tackleBox/l1',
      'doc:users/u1/tackleBox/l2',
      'doc:users/u1/spots/s1',
      'doc:users/u1',
      'deleteUser',
    ]);
    suppressionReussie(page);
  });

  it('critère 1 : given le flag photosLeurres est explicitement désactivé, when je confirme la suppression, then toutes les données et le compte sont supprimés et la suppression réussie s\'affiche', async () => {
    const page = await supprimer(false);

    expect(journal.filter((e) => !e.startsWith('storage:'))).toEqual([
      'doc:users/u1/tackleBox/l1',
      'doc:users/u1/tackleBox/l2',
      'doc:users/u1/spots/s1',
      'doc:users/u1',
      'deleteUser',
    ]);
    suppressionReussie(page);
  });

  it('critère 2 : given le flag photosLeurres est désactivé, when je supprime mon compte, then Cloud Storage n\'est jamais appelé (ni obtenu, ni liste, ni suppression de fichier)', async () => {
    await supprimer(false);

    expect(journal.filter((e) => e.startsWith('storage:'))).toEqual([]);
    expect(storageObtenu).not.toHaveBeenCalled();
  });

  it('critère 2 : given le flag photosLeurres est à sa valeur par défaut (jeton réel), when je supprime mon compte, then Cloud Storage n\'est jamais appelé', async () => {
    await supprimer();

    expect(journal.filter((e) => e.startsWith('storage:'))).toEqual([]);
    expect(storageObtenu).not.toHaveBeenCalled();
  });

  it('critère 3 : given le flag photosLeurres est activé et Cloud Storage ne répond pas, when je supprime mon compte, then rien n\'est supprimé et « La suppression n\'a pas abouti. Réessaie. » s\'affiche', async () => {
    etat.storageRepond = false;

    const page = await supprimer(true);

    expect(journal.filter((e) => !e.startsWith('storage:'))).toEqual([]);
    expect(erreur(page)).toBe(compact(ECHEC));
    expect(TestBed.inject(Router).url).toBe('/compte');
  });

  it('critère 4 : given le flag photosLeurres est activé et Cloud Storage répond, when je supprime mon compte, then mes photos de leurres sont supprimées avec le reste de mes données', async () => {
    etat.storageRepond = true;

    const page = await supprimer(true);

    expect(journal.filter((e) => !e.startsWith('storage:') || e.startsWith('storage:listAll'))).toEqual([
      'storage:listAll:users/u1/lures',
      'photo:users/u1/lures/a.jpg',
      'doc:users/u1/tackleBox/l1',
      'doc:users/u1/tackleBox/l2',
      'doc:users/u1/spots/s1',
      'doc:users/u1',
      'deleteUser',
    ]);
    suppressionReussie(page);
  });
});
