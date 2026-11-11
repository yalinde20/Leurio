/*
 * US 99, revue : double validation, erreur de lecture, échec d'enregistrement et aides à la saisie de la page « Boîte ».
 * Doubles : SOURCE_TACKLE_BOX (aucun appel Firebase) et CatalogService.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { BoitePage } from './boite.page';

const attendre = () => new Promise<void>((r) => setTimeout(r));
const TYPES = [{ id: 'shad', nom: 'Shad' }] as TypeLeurre[];

async function afficher(opts: { ajouter?: () => Promise<void>; erreurLecture?: boolean | 'au-retour' } = {}) {
  let ecritures = 0;
  // 'au-retour' : les deux premières lectures échouent (la lecture initiale, puis la relecture que la première page fait
  // en s'ouvrant, le service ayant déjà échoué à ce moment-là) ; la relecture à la visite suivante réussit.
  let ecoutes = 0;
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: never[]) => void, ko: (e: unknown) => void) => {
      if (opts.erreurLecture === true || (opts.erreurLecture === 'au-retour' && ecoutes < 2)) ko(new Error('lecture'));
      else ok([]);
      ecoutes++;
      return () => undefined;
    },
    ajouter: async () => {
      ecritures++;
      await opts.ajouter?.();
    },
  };
  await TestBed.configureTestingModule({
    imports: [BoitePage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: source },
      { provide: CatalogService, useValue: { typesDeLeurres: async () => TYPES } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(BoitePage);
  const stabiliser = async () => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await attendre();
    }
  };
  await stabiliser();
  const page = fixture.nativeElement as HTMLElement;
  const dialogue = () => page.querySelector<HTMLElement>('[role="dialog"]');
  const saisir = (id: string, valeur: string) => {
    const c = page.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
    c.value = valeur;
    c.dispatchEvent(new Event('input', { bubbles: true }));
    c.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const ouvrirEtRemplir = async () => {
    [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Ajouter un leurre'))!.click();
    await stabiliser();
    saisir('leurre-type', 'shad');
    saisir('leurre-taille', '10');
    saisir('leurre-poids', '12');
    saisir('leurre-couleur', 'gardon');
    await stabiliser();
  };
  const enregistrer = () => dialogue()!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  return { fixture, page, stabiliser, dialogue, ouvrirEtRemplir, enregistrer, ecritures: () => ecritures };
}

describe('BoitePage : robustesse (US 99, revue)', () => {
  it('given un enregistrement en cours, when je touche deux fois « Enregistrer », then un seul leurre est écrit et le bouton est désactivé', async () => {
    let finir: () => void = () => undefined;
    const env = await afficher({ ajouter: () => new Promise<void>((r) => (finir = r)) });
    await env.ouvrirEtRemplir();
    const bouton = env.enregistrer();
    bouton.click();
    await env.stabiliser();
    expect(bouton.disabled).toBe(true);
    expect(bouton.getAttribute('aria-busy')).toBe('true');
    bouton.click();
    bouton.form!.requestSubmit();
    await env.stabiliser();
    expect(env.ecritures()).toBe(1);
    finir();
    await env.stabiliser();
    expect(env.dialogue()).toBeNull();
    expect(env.ecritures()).toBe(1);
  });

  it('given la source qui échoue à lire, when j\'ouvre la boîte, then « Impossible de lire ta boîte. Réessaie plus tard. » remplace l\'état vide', async () => {
    const env = await afficher({ erreurLecture: true });
    const texte = (env.page.textContent ?? '').replace(/\s+/g, ' ');
    expect(texte).toContain('Impossible de lire ta boîte. Réessaie plus tard.');
    expect(texte).not.toContain('Ta boîte est vide.');
  });

  it('given l\'écriture refusée, when je touche « Enregistrer », then la feuille reste ouverte avec « Impossible d\'enregistrer le leurre. Réessaie. »', async () => {
    const env = await afficher({ ajouter: () => Promise.reject(new Error('refus')) });
    await env.ouvrirEtRemplir();
    env.enregistrer().click();
    await env.stabiliser();
    expect(env.dialogue()).not.toBeNull();
    expect(env.dialogue()!.textContent).toContain("Impossible d'enregistrer le leurre. Réessaie.");
    expect(env.enregistrer().disabled).toBe(false);
  });

  it('given le formulaire ouvert, when je regarde les champs, then taille, poids et couleur ont un exemple en aide', async () => {
    const env = await afficher();
    await env.ouvrirEtRemplir();
    const aide = (id: string) => env.page.querySelector<HTMLInputElement>(`#${id}`)!.placeholder;
    expect([aide('leurre-taille'), aide('leurre-poids'), aide('leurre-couleur')]).toEqual(['Ex. : 10', 'Ex. : 12', 'Ex. : gardon']);
  });

  it('given une erreur de lecture, when je reviens sur la page « Boîte », then la boîte est relue et la liste réapparaît', async () => {
    const env = await afficher({ erreurLecture: 'au-retour' });
    expect(env.page.textContent).toContain('Impossible de lire ta boîte.');
    const retour = TestBed.createComponent(BoitePage);
    await retour.whenStable();
    retour.detectChanges();
    await attendre();
    retour.detectChanges();
    const texte = (retour.nativeElement as HTMLElement).textContent ?? '';
    expect(texte).not.toContain('Impossible de lire ta boîte.');
    expect(texte).toContain('Ta boîte est vide.');
  });
});
