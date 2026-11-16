/*
 * US 95, cas limites de l'écran « Ton compte » : lecture du compte en cours, double toucher, fournisseur déjà lié,
 * aucun compte anonyme à lier. Complète compte.page.liaison.spec.ts (critères) avec des doubles de SOURCE_LIAISON.
 */
import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { CompteLie, SOURCE_LIAISON, SourceLiaison } from '../../core/data/liaison-compte';
import { ComptePage } from './compte.page';

afterEach(() => vi.restoreAllMocks());

const erreur = (code: string) => Object.assign(new Error(code), { code });
const boutons = (page: HTMLElement) => Array.from(page.querySelectorAll('button')).map((b) => b.textContent?.trim());

/** US 96 : ces cas limites ne touchent pas à l'e-mail ; `lierEmail` est complété par un double qui échoue. */
async function ouvrir(source: Omit<SourceLiaison, 'lierEmail'>) {
  await TestBed.configureTestingModule({
    imports: [ComptePage],
    providers: [provideIonicAngular(), provideRouter([]), { provide: SOURCE_LIAISON, useValue: { ...source, lierEmail: async () => Promise.reject(new Error('non prévu')) } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(ComptePage);
  const page = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  await stabiliser();
  return { page, stabiliser };
}

describe('US 95 : cas limites de la liaison du compte', () => {
  it("given la lecture du compte n'est pas terminée, when j'ouvre Compte, then aucun bouton de connexion ne s'affiche, puis « Connecté avec Google » sans bouton", async () => {
    let repondre!: (c: CompteLie) => void;
    const { page, stabiliser } = await ouvrir({ compteLie: () => new Promise<CompteLie>((r) => (repondre = r)), lier: async () => Promise.reject(new Error('non prévu')) });
    expect(boutons(page)).toEqual([]);

    repondre({ fournisseur: 'google', email: 'camille@example.test' });
    await stabiliser();
    expect(page.textContent).toContain('Connecté avec Google');
    expect(boutons(page)).toEqual([]);
  });

  it('given une connexion en cours, when je touche de nouveau un bouton, then une seule fenêtre de connexion est ouverte', async () => {
    const appels: string[] = [];
    const { page, stabiliser } = await ouvrir({
      compteLie: async () => null,
      lier: (f) => {
        appels.push(f);
        return new Promise<CompteLie>(() => undefined);
      },
    });
    const [apple] = Array.from(page.querySelectorAll('button'));
    apple.click();
    apple.click();
    await stabiliser();
    expect(appels).toEqual(['apple']);
  });

  it('given le compte est déjà lié à ce fournisseur (auth/provider-already-linked), when je valide, then l\'état lié s\'affiche sans erreur', async () => {
    let lu = 0;
    const { page, stabiliser } = await ouvrir({
      compteLie: async () => (lu++ === 0 ? null : { fournisseur: 'google', email: null }),
      lier: async () => Promise.reject(erreur('auth/provider-already-linked')),
    });
    page.querySelectorAll('button')[1].click();
    await stabiliser();
    expect(page.textContent).toContain('Connecté avec Google');
    expect(page.querySelector('[role="alert"]')).toBeNull();
  });

  it("given aucun compte anonyme n'existe encore (auth/no-current-user), when je touche « Continuer avec Google », then le message générique s'affiche en role=\"alert\" et les boutons restent actifs", async () => {
    const { page, stabiliser } = await ouvrir({ compteLie: async () => null, lier: async () => Promise.reject(erreur('auth/no-current-user')) });
    page.querySelectorAll('button')[1].click();
    await stabiliser();
    expect(page.querySelector('[role="alert"]')?.textContent?.trim()).toBe('La connexion n’a pas abouti. Réessaie.');
    expect(Array.from(page.querySelectorAll('button')).every((b) => !b.disabled)).toBe(true);
  });
});

describe('US 95 : app native (décision du propriétaire, réponse B)', () => {
  it('given l\'app native, when j\'ouvre Compte, then ni le groupe « Ton compte » ni les boutons « Continuer avec … » ne s\'affichent et le compte n\'est pas lu', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const compteLie = vi.fn(async () => null);
    const { page } = await ouvrir({ compteLie, lier: async () => Promise.reject(new Error('non prévu')) });

    expect(page.textContent).not.toContain('Ton compte');
    expect(page.textContent).not.toContain('Continuer avec');
    expect(page.querySelectorAll('button')).toHaveLength(0);
    expect(page.textContent).toContain('Réglages');
    expect(compteLie).not.toHaveBeenCalled();
  });
});
