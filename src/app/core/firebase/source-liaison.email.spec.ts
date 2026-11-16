/*
 * US 96 : liaison du compte anonyme à une adresse e-mail et un mot de passe (PLAN §2.5, §4).
 * CONTRAT : SourceLiaison.lierEmail(email, motDePasse) appelle EmailAuthProvider.credential puis linkWithCredential sur
 * l'utilisateur courant (même uid : la boîte et les spots restent en place ; jamais createUserWithEmailAndPassword ni
 * signInWith…, aucun e-mail de vérification) ; versCompteLie rend le fournisseur 'email' pour le providerId 'password'.
 * Les membres absents sont atteints par conversion : les tests échouent à l'exécution tant que la fonctionnalité manque.
 */
import type { Injector } from '@angular/core';
import type { SourceLiaison } from '../data/liaison-compte';
import { versCompteLie } from './source-liaison';

const { linkWithCredential, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, credential, auth } = vi.hoisted(() => ({
  linkWithCredential: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  credential: vi.fn(),
  auth: { authStateReady: async () => undefined, currentUser: null as unknown },
}));
vi.mock('firebase/auth', () => ({
  linkWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  EmailAuthProvider: { credential },
  GoogleAuthProvider: class {},
  OAuthProvider: class {
    addScope = vi.fn();
  },
  linkWithPopup: vi.fn(),
}));

type AvecEmail = SourceLiaison & { lierEmail(email: string, motDePasse: string): Promise<unknown> };

describe('versCompteLie (e-mail)', () => {
  it("given un compte lié par e-mail et mot de passe (providerId password), then rend le fournisseur email et l'adresse", () => {
    const utilisateur = { email: 'camille.martin@free.fr', providerData: [{ providerId: 'password', email: 'camille.martin@free.fr' }] };
    expect(versCompteLie(utilisateur)).toEqual({ fournisseur: 'email', email: 'camille.martin@free.fr' });
  });
});

describe('creerSourceLiaisonFirebase.lierEmail', () => {
  const anonyme = { uid: 'uid-anonyme', email: null, providerData: [] };
  let source: AvecEmail;

  beforeEach(async () => {
    for (const f of [linkWithCredential, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, credential]) f.mockReset();
    credential.mockImplementation((email: string, mdp: string) => ({ email, mdp }));
    auth.currentUser = anonyme;
    const { creerSourceLiaisonFirebase } = await import('./source-liaison');
    source = creerSourceLiaisonFirebase({ get: () => ({ auth }) } as unknown as Injector) as AvecEmail;
  });

  it("given un compte anonyme, when je lie une adresse et un mot de passe, then linkWithCredential reçoit l'utilisateur courant et le credential e-mail, et le compte lié est rendu", async () => {
    linkWithCredential.mockResolvedValue({ user: { email: 'camille.martin@free.fr', providerData: [{ providerId: 'password', email: 'camille.martin@free.fr' }] } });

    expect(typeof source.lierEmail, 'lierEmail existe').toBe('function');
    await expect(source.lierEmail('camille.martin@free.fr', 'secret6')).resolves.toEqual({ fournisseur: 'email', email: 'camille.martin@free.fr' });

    expect(credential).toHaveBeenCalledWith('camille.martin@free.fr', 'secret6');
    expect(linkWithCredential).toHaveBeenCalledOnce();
    expect(linkWithCredential.mock.calls[0][0]).toBe(anonyme);
    expect(linkWithCredential.mock.calls[0][1]).toEqual({ email: 'camille.martin@free.fr', mdp: 'secret6' });
    // Lié, pas remplacé : même uid, donc boîte et spots inchangés ; aucun e-mail de vérification.
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  it("given Firebase répond auth/email-already-in-use, when je lie l'adresse, then le code de l'erreur est conservé", async () => {
    linkWithCredential.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }));

    expect(typeof source.lierEmail, 'lierEmail existe').toBe('function');
    await expect(source.lierEmail('camille.martin@free.fr', 'secret6')).rejects.toMatchObject({ code: 'auth/email-already-in-use' });
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("given aucun utilisateur courant, when je lie une adresse, then la liaison est rejetée avec auth/no-current-user sans appeler Firebase", async () => {
    auth.currentUser = null;

    expect(typeof source.lierEmail, 'lierEmail existe').toBe('function');
    await expect(source.lierEmail('camille.martin@free.fr', 'secret6')).rejects.toMatchObject({ code: 'auth/no-current-user' });
    expect(linkWithCredential).not.toHaveBeenCalled();
  });
});
