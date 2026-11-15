/*
 * US 94 : la page « Confidentialité » ne dit plus que les consentements sont « tous sur « non » » : ils sont sur « non » par défaut
 * et modifiables dans Compte › Consentements (PLAN §9 bis). Texte attendu dans l'élément de liste qui parle des consentements :
 * « par défaut » et « Compte › Consentements ».
 */
import { TestBed } from '@angular/core/testing';
import { compact, ouvrirCompte, toucher } from './compte-informations.doubles';

beforeEach(() => localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] })));
afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 94 : Confidentialité', () => {
  it('given la page « Confidentialité », when je lis ce que Leurio garde en ligne, then les consentements sont « non » par défaut et modifiables dans Compte › Consentements, sans « tous sur « non » »', async () => {
    const { page, stabiliser } = await ouvrirCompte();
    await toucher(page, 'Confidentialité', stabiliser);

    const texte = compact(page.textContent);
    expect(texte).not.toContain(compact('tous sur « non »'));
    const item = Array.from(page.querySelectorAll('li')).find((li) => compact(li.textContent).includes(compact('consentements')));
    expect(item, 'un élément de liste qui parle des consentements').toBeTruthy();
    const t = compact(item!.textContent);
    expect(t).toContain(compact('« non »'));
    expect(t).toContain(compact('par défaut'));
    expect(t).toContain(compact('Compte › Consentements'));
  });
});
