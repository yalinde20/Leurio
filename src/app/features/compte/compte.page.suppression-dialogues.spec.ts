/*
 * US 98 (revue) : les dialogues de suppression couvrent toute la fenêtre, onglets compris, et un toucher hors de l'alerte vaut « Annuler »
 * (maquette docs/maquettes/us-98-supprimer-mon-compte.html, état 2).
 */
import { TestBed } from '@angular/core/testing';
import { SOURCE_SUPPRESSION, SourceSuppression } from '../../core/data/suppression-compte.service';
import { compact, ouvrirCompte, toucher } from './compte-informations.doubles';

const TITRE = 'Supprimer définitivement ton compte, ta boîte et tes spots ?';
const TITRE_RECO = 'Reconnecte-toi pour supprimer ton compte';

async function ouvrir(reconnexion: 'google' | null = null) {
  const appels: string[] = [];
  const source: SourceSuppression = {
    reconnexionRequise: async () => reconnexion,
    reconnecter: async () => void appels.push('reconnecter'),
    reconnecterEmail: async () => void appels.push('reconnecterEmail'),
    supprimerDonnees: async () => void appels.push('supprimerDonnees'),
    supprimerCompte: async () => void appels.push('supprimerCompte'),
  };
  const compteLie = reconnexion ? { fournisseur: reconnexion, email: 'camille@exemple.fr' } : null;
  const app = await ouvrirCompte({ compteLie, providers: [{ provide: SOURCE_SUPPRESSION, useValue: source }] });
  return { ...app, appels };
}

const dialogues = () => [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')];
const voile = () => dialogues()[0]?.parentElement ?? null;
const bouton = (texte: string) => [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((b) => compact(b.textContent) === compact(texte));

beforeEach(() => {
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
  localStorage.setItem('leurio.compte', '1');
});
afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 98 : dialogues de suppression au-dessus des onglets', () => {
  it('given la confirmation est affichée, when je regarde où elle est, then elle est hors de la page Compte, sous body, et son voile est fixé à la fenêtre', async () => {
    const { page, stabiliser } = await ouvrir();

    await toucher(page, 'Supprimer mon compte', stabiliser);

    expect(dialogues()).toHaveLength(1);
    expect(dialogues()[0].closest('app-compte')).toBeNull();
    expect(dialogues()[0].closest('.ion-page')).toBeNull();
    expect(voile()!.parentElement).toBe(document.body);
    expect(getComputedStyle(voile()!).position).toBe('fixed');
  });

  it('given la confirmation est affichée, when elle se ferme, then plus aucun dialogue ne reste dans le document', async () => {
    const { page, stabiliser } = await ouvrir();
    await toucher(page, 'Supprimer mon compte', stabiliser);

    bouton('Annuler')!.click();
    await stabiliser();

    expect(dialogues()).toHaveLength(0);
    expect(document.body.querySelector('.voile')).toBeNull();
  });

  it('given la confirmation est affichée, when la page est détruite, then le dialogue déplacé est retiré du document', async () => {
    const { page, stabiliser } = await ouvrir();
    await toucher(page, 'Supprimer mon compte', stabiliser);

    TestBed.resetTestingModule();

    expect(dialogues()).toHaveLength(0);
  });

  it('given la confirmation est affichée, when je touche hors de l\'alerte, then elle se ferme et rien n\'est supprimé', async () => {
    const { page, stabiliser, appels } = await ouvrir();
    await toucher(page, 'Supprimer mon compte', stabiliser);

    voile()!.click();
    await stabiliser();

    expect(dialogues()).toHaveLength(0);
    expect(appels).toEqual([]);
  });

  it('given la confirmation est affichée, when je touche le texte de l\'alerte, then elle reste ouverte', async () => {
    const { page, stabiliser } = await ouvrir();
    await toucher(page, 'Supprimer mon compte', stabiliser);

    dialogues()[0].querySelector<HTMLElement>('h3')!.click();
    await stabiliser();

    expect(dialogues()).toHaveLength(1);
  });

  it('given la reconnexion est demandée avant toute suppression, when je touche hors de l\'alerte, then elle se ferme et rien n\'est supprimé', async () => {
    const { page, stabiliser, appels } = await ouvrir('google');
    await toucher(page, 'Supprimer mon compte', stabiliser);
    bouton('Supprimer définitivement')!.click();
    await stabiliser();
    expect(compact(dialogues()[0]?.textContent)).toContain(compact(TITRE_RECO));
    expect(compact(dialogues()[0].textContent)).not.toContain(compact(TITRE));

    voile()!.click();
    await stabiliser();

    expect(dialogues()).toHaveLength(0);
    expect(appels).toEqual([]);
  });
});
