import type { Injector } from '@angular/core';
import type { SourceLiaison } from '../data/liaison-compte';
import { versCompteLie } from './source-liaison';

describe('versCompteLie', () => {
  it('given un compte anonyme sans fournisseur, then rend null', () => {
    expect(versCompteLie({ email: null, providerData: [] })).toBeNull();
    expect(versCompteLie(null)).toBeNull();
  });

  it('given un compte lié à Google, then rend google et son adresse', () => {
    const utilisateur = { email: 'camille@example.test', providerData: [{ providerId: 'google.com', email: 'camille@example.test' }] };
    expect(versCompteLie(utilisateur)).toEqual({ fournisseur: 'google', email: 'camille@example.test' });
  });

  it('given un compte lié à Apple sans adresse, then rend apple et une adresse null', () => {
    expect(versCompteLie({ email: null, providerData: [{ providerId: 'apple.com', email: null }] })).toEqual({ fournisseur: 'apple', email: null });
  });

  it("given l'adresse seulement dans le fournisseur, then la reprend", () => {
    expect(versCompteLie({ email: null, providerData: [{ providerId: 'apple.com', email: 'relais@privaterelay.appleid.com' }] })).toEqual({
      fournisseur: 'apple',
      email: 'relais@privaterelay.appleid.com',
    });
  });
});

// Le compte est LIÉ (linkWithPopup sur l'utilisateur anonyme courant), jamais remplacé (signInWithPopup) : même uid,
// donc la boîte et les spots de users/{uid} restent en place (critères 1 à 3 de l'US 95).
const { linkWithPopup, signInWithPopup, GoogleAuthProvider, OAuthProvider, auth } = vi.hoisted(() => {
  class Fournisseur {
    scopes: string[] = [];
    constructor(public id: string) {}
    addScope(scope: string) {
      this.scopes.push(scope);
    }
  }
  return {
    linkWithPopup: vi.fn(),
    signInWithPopup: vi.fn(),
    GoogleAuthProvider: class extends Fournisseur {
      constructor() {
        super('google.com');
      }
    },
    OAuthProvider: class extends Fournisseur {},
    auth: { authStateReady: async () => undefined, currentUser: null as unknown },
  };
});
vi.mock('firebase/auth', () => ({ linkWithPopup, signInWithPopup, GoogleAuthProvider, OAuthProvider }));

describe('creerSourceLiaisonFirebase', () => {
  const anonyme = { uid: 'uid-anonyme', email: null, providerData: [] };
  let source: SourceLiaison;

  beforeEach(async () => {
    linkWithPopup.mockReset();
    signInWithPopup.mockReset();
    auth.currentUser = anonyme;
    const { creerSourceLiaisonFirebase } = await import('./source-liaison');
    source = creerSourceLiaisonFirebase({ get: () => ({ auth }) } as unknown as Injector);
  });

  it("given un compte anonyme, when je lie Google, then linkWithPopup reçoit l'utilisateur courant et un fournisseur Google, et le compte lié est rendu", async () => {
    linkWithPopup.mockResolvedValue({ user: { email: 'camille@example.test', providerData: [{ providerId: 'google.com', email: 'camille@example.test' }] } });

    await expect(source.lier('google')).resolves.toEqual({ fournisseur: 'google', email: 'camille@example.test' });

    expect(linkWithPopup).toHaveBeenCalledOnce();
    expect(linkWithPopup.mock.calls[0][0]).toBe(anonyme);
    expect(linkWithPopup.mock.calls[0][1]).toBeInstanceOf(GoogleAuthProvider);
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it("given un compte anonyme, when je lie Apple, then linkWithPopup reçoit l'utilisateur courant et un OAuthProvider apple.com avec la portée email", async () => {
    linkWithPopup.mockResolvedValue({ user: { email: null, providerData: [{ providerId: 'apple.com', email: null }] } });

    await expect(source.lier('apple')).resolves.toEqual({ fournisseur: 'apple', email: null });

    const [utilisateur, fournisseur] = linkWithPopup.mock.calls[0];
    expect(utilisateur).toBe(anonyme);
    expect(fournisseur).toBeInstanceOf(OAuthProvider);
    expect(fournisseur.id).toBe('apple.com');
    expect(fournisseur.scopes).toContain('email');
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it('given Firebase refuse la liaison, when je lie Google, then le code de l\'erreur est conservé', async () => {
    linkWithPopup.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/credential-already-in-use' }));

    await expect(source.lier('google')).rejects.toMatchObject({ code: 'auth/credential-already-in-use' });
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it("given aucun utilisateur courant, when je lie Google, then la liaison est rejetée avec auth/no-current-user sans ouvrir de fenêtre", async () => {
    auth.currentUser = null;

    await expect(source.lier('google')).rejects.toMatchObject({ code: 'auth/no-current-user' });
    expect(linkWithPopup).not.toHaveBeenCalled();
    expect(signInWithPopup).not.toHaveBeenCalled();
  });
});
