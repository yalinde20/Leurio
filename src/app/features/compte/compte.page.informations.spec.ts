/*
 * US 91 : consulter « À propos et sources » et « Confidentialité » dans Compte. Maquette : docs/maquettes/us-91-a-propos-confidentialite.html.
 * Critères 1 et 4 (l'onglet Compte). Les tests passent par l'app réelle (App + routes), sans imposer d'URL.
 *
 * Fichiers et classes attendus (à créer) :
 *  - src/app/features/compte/a-propos.page.ts : `AProposPage` (route enfant de l'onglet Compte, p. ex. `compte/a-propos`)
 *  - src/app/features/compte/confidentialite.page.ts : `ConfidentialitePage` (p. ex. `compte/confidentialite`)
 *  - src/app/features/compte/compte.page.ts : `ComptePage` (existe), avec les groupes « Informations » et « Réglementation ».
 * Contrat du DOM : les lignes « À propos et sources » et « Confidentialité » sont touchables (lien ou bouton) ;
 * « cartedepeche.fr » est un `a` (href https://www.cartedepeche.fr, target _blank, rel noopener).
 */
import { TestBed } from '@angular/core/testing';
import { compact, lien, ouvrirCompte, trouver } from './compte-informations.doubles';

afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});
beforeEach(() => localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] })));

describe('US 91 : l\'onglet Compte', () => {
  it('critère 1 : given j\'ouvre l\'onglet « Compte », when je le regarde, then il propose les groupes « Informations » et « Réglementation », les lignes « À propos et sources » et « Confidentialité » et le lien « cartedepeche.fr »', async () => {
    const { page } = await ouvrirCompte();
    const contenu = page.querySelector('ion-content') as HTMLElement;

    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Compte');
    expect(compact(contenu.textContent)).toContain(compact('Informations'));
    expect(trouver(contenu, 'À propos et sources')).toBeTruthy();
    expect(trouver(contenu, 'Confidentialité')).toBeTruthy();
    expect(compact(contenu.textContent)).toContain(compact('Réglementation'));
    expect(compact(contenu.textContent)).toContain(compact('Achète ta carte sur le site officiel'));

    // Les deux lignes se touchent : un lien ou un bouton, pas un simple texte.
    for (const texte of ['À propos et sources', 'Confidentialité']) {
      const ligne = trouver(contenu, texte)!;
      expect(ligne.closest('a, button, ion-item[button], ion-item[routerLink], [role="link"], [role="button"]'), texte).toBeTruthy();
    }

    const carte = lien(contenu, 'cartedepeche.fr');
    expect(carte).toBeTruthy();
    expect(carte!.getAttribute('href')).toMatch(/^https:\/\/www\.cartedepeche\.fr\/?$/);
    expect(carte!.getAttribute('target')).toBe('_blank');
    expect(carte!.getAttribute('rel')).toContain('noopener');
  });

  it('critère 4 : given l\'onglet « Compte » affiché, when je touche « cartedepeche.fr », then le site https://www.cartedepeche.fr s\'ouvre dans un nouvel onglet (lien externe, sans passer par le routeur)', async () => {
    const { page } = await ouvrirCompte();
    const carte = lien(page.querySelector('ion-content') as HTMLElement, 'cartedepeche.fr');

    expect(carte, 'lien cartedepeche.fr').toBeTruthy();
    expect(carte!.href).toMatch(/^https:\/\/www\.cartedepeche\.fr\/?$/);
    expect(carte!.target).toBe('_blank');
    expect(carte!.rel).toContain('noopener');
    // Un lien interne (routerLink) n'aurait pas cet href absolu.
    expect(carte!.hasAttribute('routerlink')).toBe(false);
  });
});
