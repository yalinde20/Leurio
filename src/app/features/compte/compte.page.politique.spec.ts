/*
 * US 23 : « Politique de confidentialité » dans l'onglet Compte (critères 4 et 5). Maquette : docs/maquettes/us-23-politique-confidentialite.html.
 * Contrat du DOM : dans le groupe « Informations », sous « Confidentialité » (inchangée), un lien `a`
 * href https://leurio.app/confidentialite, target _blank, rel noopener, sous-titre « La version publique, en ligne », valeur « leurio.app ↗ ».
 * Sans réseau (navigator.onLine === false), le toucher est empêché (preventDefault) et un `[role="status"]` affiche le message.
 */
import { TestBed } from '@angular/core/testing';
import { compact, lien, ouvrirCompte, trouver } from './compte-informations.doubles';

const MESSAGE = 'Pas de réseau : la politique est sur leurio.app/confidentialite';

function reseau(valeur: boolean | undefined): void {
  if (valeur === undefined) delete (navigator as unknown as Record<string, unknown>)['onLine'];
  else Object.defineProperty(navigator, 'onLine', { value: valeur, configurable: true });
}

afterEach(() => {
  reseau(undefined);
  TestBed.resetTestingModule();
  localStorage.clear();
});
beforeEach(() => localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] })));

describe('US 23 : « Politique de confidentialité » dans Compte', () => {
  it('critère 4 : given l\'onglet « Compte », when je regarde « Informations », then « Politique de confidentialité » est un lien https://leurio.app/confidentialite (nouvel onglet, noopener) sous « Confidentialité », qui reste inchangée', async () => {
    const { page } = await ouvrirCompte();
    const contenu = page.querySelector('ion-content') as HTMLElement;
    const politique = lien(contenu, 'Politique de confidentialité');

    expect(politique, 'lien « Politique de confidentialité »').toBeTruthy();
    expect(politique!.getAttribute('href')).toMatch(/^https:\/\/leurio\.app\/confidentialite\/?$/);
    expect(politique!.getAttribute('target')).toBe('_blank');
    expect(politique!.getAttribute('rel')).toContain('noopener');
    expect(politique!.hasAttribute('routerlink')).toBe(false);
    expect(compact(politique!.textContent)).toContain(compact('La version publique, en ligne'));
    expect(compact(politique!.textContent)).toContain(compact('leurio.app'));

    const interne = Array.from(contenu.querySelectorAll<HTMLAnchorElement>('a')).find((a) => compact(a.textContent).startsWith(compact('Confidentialité')));
    expect(interne, 'rangée « Confidentialité » inchangée').toBeTruthy();
    expect(interne).not.toBe(politique);
    expect(interne!.getAttribute('href') ?? '').not.toContain('leurio.app');
    const rangees = Array.from(contenu.querySelectorAll('a'));
    expect(rangees.indexOf(politique!)).toBe(rangees.indexOf(interne!) + 1);
  });

  it('critère 4 : given le réseau, when je touche « Politique de confidentialité », then la navigation vers la page n\'est pas empêchée et aucun message n\'apparaît', async () => {
    reseau(true);
    const { page, stabiliser } = await ouvrirCompte();
    const politique = lien(page, 'Politique de confidentialité');
    expect(politique, 'lien « Politique de confidentialité »').toBeTruthy();
    const evenement = new MouseEvent('click', { bubbles: true, cancelable: true });
    politique!.dispatchEvent(evenement);
    await stabiliser();

    expect(evenement.defaultPrevented).toBe(false);
    expect(compact(page.textContent)).not.toContain(compact(MESSAGE));
  });

  it('critère 5 : given un appareil sans réseau, when je touche « Politique de confidentialité », then la navigation est empêchée et le message « Pas de réseau : la politique est sur leurio.app/confidentialite » s\'affiche en role="status"', async () => {
    reseau(false);
    const { page, stabiliser } = await ouvrirCompte();
    const politique = lien(page, 'Politique de confidentialité');
    expect(politique, 'lien « Politique de confidentialité »').toBeTruthy();
    const evenement = new MouseEvent('click', { bubbles: true, cancelable: true });
    politique!.dispatchEvent(evenement);
    await stabiliser();

    expect(evenement.defaultPrevented).toBe(true);
    const statut = Array.from(page.querySelectorAll('[role="status"]')).find((e) => compact(e.textContent) === compact(MESSAGE));
    expect(statut, 'message hors ligne').toBeTruthy();
    expect(trouver(page, MESSAGE)).toBeTruthy();
  });
});
