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
