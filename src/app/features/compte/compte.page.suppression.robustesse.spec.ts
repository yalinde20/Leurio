/*
 * US 98, revue : marqueur de profil, focus, abandon de la reconnexion et mot de passe vide (écran Compte, source de suppression doublée).
 */
import { TestBed } from '@angular/core/testing';
import { SOURCE_SUPPRESSION, SourceSuppression } from '../../core/data/suppression-compte.service';
import { compact, ouvrirCompte, toucher, trouver } from './compte-informations.doubles';

const ECHEC = 'La suppression n’a pas abouti. Réessaie.';

async function ouvrir(o: { reconnexion?: 'email' | 'google'; supprimerCompte?: () => Promise<void> } = {}) {
  const source: SourceSuppression = {
    reconnexionRequise: async () => o.reconnexion ?? null,
    reconnecter: async () => undefined,
    reconnecterEmail: async () => undefined,
    supprimerDonnees: async () => undefined,
    supprimerCompte: async () => o.supprimerCompte?.(),
  };
  const compteLie = o.reconnexion ? { fournisseur: o.reconnexion, email: 'camille@exemple.fr' } : null;
  return ouvrirCompte({ compteLie, providers: [{ provide: SOURCE_SUPPRESSION, useValue: source }] });
}

const rangee = (page: HTMLElement) => trouver(page, 'Supprimer mon compte')?.closest('button') as HTMLButtonElement;
const dialogue = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const bouton = (texte: string) => [...(dialogue()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) => compact(b.textContent) === compact(texte));

beforeEach(() => {
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
  localStorage.setItem('leurio.compte', 'uid-1');
});
afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 98 : robustesse de la suppression dans Compte', () => {
  it('given les données effacées mais deleteUser en échec, when la suppression échoue, then le marqueur du profil est déjà retiré', async () => {
    const { page, stabiliser } = await ouvrir({ supprimerCompte: () => Promise.reject({ code: 'auth/internal-error' }) });

    await toucher(page, 'Supprimer mon compte', stabiliser);
    bouton('Supprimer définitivement')!.click();
    await stabiliser();

    expect(localStorage.getItem('leurio.compte')).toBeNull();
    expect(compact(page.textContent)).toContain(compact(ECHEC));
  });

  it('given la confirmation ouverte, when je touche Annuler, then le focus revient sur « Supprimer mon compte »', async () => {
    const { page, stabiliser } = await ouvrir();
    document.body.appendChild(page);

    await toucher(page, 'Supprimer mon compte', stabiliser);
    bouton('Annuler')!.click();
    await stabiliser();

    expect(document.activeElement).toBe(rangee(page));
  });

  it('given la reconnexion par e-mail, when le mot de passe est vide, then « Supprimer définitivement » est inactif (aria-disabled) et ne fait rien', async () => {
    const { page, stabiliser } = await ouvrir({ reconnexion: 'email' });

    await toucher(page, 'Supprimer mon compte', stabiliser);
    bouton('Supprimer définitivement')!.click();
    await stabiliser();

    expect(bouton('Supprimer définitivement')!.getAttribute('aria-disabled')).toBe('true');
    bouton('Supprimer définitivement')!.click();
    await stabiliser();
    expect(dialogue()).not.toBeNull();
  });
});
