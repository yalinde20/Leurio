/*
 * US 98 : suppression du compte côté Firebase (PLAN §2.5, §4, §7).
 * CONTRAT : creerSourceSuppressionFirebase(injector) (source-suppression.ts) rend une SourceSuppression
 * (voir src/app/features/compte/compte.page.suppression.spec.ts) :
 *  - supprimerDonnees : listAll(ref(storage, 'users/{uid}/lures')) puis deleteObject de chaque photo ; getDocs + deleteDoc de chaque
 *    document de users/{uid}/tackleBox, puis de users/{uid}/spots, puis deleteDoc(users/{uid}) en dernier. Rien n'est supprimé
 *    si aucun utilisateur n'est connecté (rejette).
 *  - supprimerCompte : deleteUser(auth.currentUser).
 *  - reconnexionRequise : null pour un compte anonyme (aucun fournisseur lié) ou une connexion de moins de 5 minutes
 *    (metadata.lastSignInTime) ; sinon le fournisseur lié.
 *  - reconnecter : reauthenticateWithPopup (Google ou OAuthProvider apple.com) ; reconnecterEmail : reauthenticateWithCredential
 *    avec EmailAuthProvider.credential(email, motDePasse).
 * Les modules firebase/* sont remplacés par des doubles : aucun réseau. Les journaux enregistrent l'ordre des appels.
 */
import type { Injector } from '@angular/core';
import type { SourceSuppression } from '../data/suppression-compte.service';

const { journal, auth, deleteDoc, getDocs, deleteObject, listAll, deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, credential } = vi.hoisted(() => {
  const journal: string[] = [];
  const documents: Record<string, string[]> = {
    'users/u1/tackleBox': ['l1', 'l2'],
    'users/u1/spots': ['s1'],
  };
  return {
    journal,
    auth: { authStateReady: async () => undefined, currentUser: null as unknown },
    getDocs: vi.fn(async (c: { path: string }) => ({ docs: (documents[c.path] ?? []).map((id) => ({ id, ref: { path: `${c.path}/${id}` } })) })),
    deleteDoc: vi.fn(async (r: { path: string }) => void journal.push(`doc:${r.path}`)),
    listAll: vi.fn(async (r: { path: string }) => ({ items: ['a.jpg', 'b.jpg'].map((n) => ({ path: `${r.path}/${n}` })), prefixes: [] })),
    deleteObject: vi.fn(async (r: { path: string }) => void journal.push(`photo:${r.path}`)),
    deleteUser: vi.fn(async () => void journal.push('deleteUser')),
    reauthenticateWithPopup: vi.fn((...args: unknown[]) => Promise.resolve(args.length && undefined)),
    reauthenticateWithCredential: vi.fn((...args: unknown[]) => Promise.resolve(args.length && undefined)),
    credential: vi.fn((email: string, mdp: string) => ({ email, mdp })),
  };
});
const chemin = (...parties: unknown[]) => ({ path: parties.filter((p) => typeof p === 'string').join('/') });
vi.mock('firebase/firestore', () => ({ collection: (...a: unknown[]) => chemin(...a), doc: (...a: unknown[]) => chemin(...a), getDocs, deleteDoc }));
vi.mock('firebase/storage', () => ({ ref: (...a: unknown[]) => chemin(...a), listAll, deleteObject }));
vi.mock('firebase/auth', () => ({
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider: { credential },
  GoogleAuthProvider: class {},
  OAuthProvider: class {
    addScope = vi.fn();
  },
}));

const ILYA = (minutes: number) => new Date(Date.now() - minutes * 60_000).toUTCString();

describe('creerSourceSuppressionFirebase', () => {
  let source: SourceSuppression;

  beforeEach(async () => {
    journal.length = 0;
    vi.clearAllMocks();
    auth.currentUser = { uid: 'u1', email: null, providerData: [], metadata: { lastSignInTime: ILYA(0) } };
    const { creerSourceSuppressionFirebase } = await import('./source-suppression');
    source = creerSourceSuppressionFirebase({ get: () => ({ auth, db: {}, storage: {} }) } as unknown as Injector);
  });

  it('critère 3 : given un compte avec des photos, des leurres et des spots, when je supprime les données, then les photos, les leurres, les spots puis users/{uid} sont supprimés, dans cet ordre', async () => {
    await source.supprimerDonnees();

    expect(journal).toEqual([
      'photo:users/u1/lures/a.jpg',
      'photo:users/u1/lures/b.jpg',
      'doc:users/u1/tackleBox/l1',
      'doc:users/u1/tackleBox/l2',
      'doc:users/u1/spots/s1',
      'doc:users/u1',
    ]);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('critère 3 : given aucun utilisateur connecté, when je supprime les données, then rien n\'est supprimé', async () => {
    auth.currentUser = null;

    await expect(source.supprimerDonnees()).rejects.toBeTruthy();

    expect(journal).toEqual([]);
  });

  it('critère 3 : given un utilisateur connecté, when je supprime le compte, then deleteUser reçoit l\'utilisateur courant', async () => {
    await source.supprimerCompte();

    expect(deleteUser).toHaveBeenCalledExactlyOnceWith(auth.currentUser);
  });

  it('critère 5 : given un compte anonyme dont la connexion est ancienne, when je demande si une reconnexion est requise, then rend null', async () => {
    auth.currentUser = { uid: 'u1', email: null, providerData: [], metadata: { lastSignInTime: ILYA(60) } };

    await expect(source.reconnexionRequise()).resolves.toBeNull();
  });

  it('critère 5 : given un compte Google connecté depuis moins de 5 minutes, when je demande si une reconnexion est requise, then rend null', async () => {
    auth.currentUser = { uid: 'u1', email: 'a@b.test', providerData: [{ providerId: 'google.com', email: 'a@b.test' }], metadata: { lastSignInTime: ILYA(2) } };

    await expect(source.reconnexionRequise()).resolves.toBeNull();
  });

  it('critère 5 : given un compte Google ou e-mail connecté depuis plus de 5 minutes, when je demande si une reconnexion est requise, then rend le fournisseur', async () => {
    auth.currentUser = { uid: 'u1', email: 'a@b.test', providerData: [{ providerId: 'google.com', email: 'a@b.test' }], metadata: { lastSignInTime: ILYA(10) } };
    await expect(source.reconnexionRequise()).resolves.toBe('google');

    auth.currentUser = { uid: 'u1', email: 'a@b.test', providerData: [{ providerId: 'password', email: 'a@b.test' }], metadata: { lastSignInTime: ILYA(10) } };
    await expect(source.reconnexionRequise()).resolves.toBe('email');
  });

  it('critère 5 : given un compte Apple, when je me reconnecte, then reauthenticateWithPopup reçoit l\'utilisateur courant', async () => {
    auth.currentUser = { uid: 'u1', email: null, providerData: [{ providerId: 'apple.com', email: null }], metadata: { lastSignInTime: ILYA(10) } };

    await source.reconnecter('apple');

    expect(reauthenticateWithPopup).toHaveBeenCalledOnce();
    expect(reauthenticateWithPopup.mock.calls[0][0]).toBe(auth.currentUser);
  });

  it('critère 5 : given un compte e-mail, when je me reconnecte avec mon mot de passe, then reauthenticateWithCredential reçoit l\'adresse et le mot de passe', async () => {
    auth.currentUser = { uid: 'u1', email: 'a@b.test', providerData: [{ providerId: 'password', email: 'a@b.test' }], metadata: { lastSignInTime: ILYA(10) } };

    await source.reconnecterEmail('secret');

    expect(credential).toHaveBeenCalledWith('a@b.test', 'secret');
    expect(reauthenticateWithCredential).toHaveBeenCalledOnce();
    expect(reauthenticateWithCredential.mock.calls[0][0]).toBe(auth.currentUser);
  });
});
