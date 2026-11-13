/** US 101 (revue) : préremplissage à la française, fermeture du formulaire quand le leurre disparaît ailleurs, focus après suppression. */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { BoitePage } from './boite.page';

const attendre = () => new Promise<void>((r) => setTimeout(r));

async function afficher() {
  let docs: DocumentLeurre[] = [
    { id: 'a', enAttente: false, data: { typeId: 'shad', tailleCm: 7.5, poidsG: 12.5, couleur: 'gardon', marque: '', createdAt: 1 } },
  ];
  let rappel: ((d: DocumentLeurre[]) => void) | null = null;
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => {
      rappel = ok;
      ok([...docs]);
      return () => undefined;
    },
    ajouter: async () => undefined,
    modifier: async () => undefined,
    supprimer: async () => undefined,
  };
  await TestBed.configureTestingModule({
    imports: [BoitePage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: source },
      { provide: CatalogService, useValue: { typesDeLeurres: async () => [{ id: 'shad', nom: 'Shad' }] as TypeLeurre[] } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(BoitePage);
  document.body.appendChild(fixture.nativeElement);
  const stabiliser = async () => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await attendre();
    }
  };
  await stabiliser();
  return {
    page: fixture.nativeElement as HTMLElement,
    stabiliser,
    supprimerAilleurs: () => {
      docs = [];
      rappel?.([]);
    },
  };
}

describe('BoitePage : revue de l\'US 101', () => {
  it('given un leurre de 7,5 cm et 12,5 g, when je le modifie, then les nombres sont préremplis avec une virgule', async () => {
    const env = await afficher();
    env.page.querySelector<HTMLElement>('li button')!.click();
    await env.stabiliser();
    expect(env.page.querySelector<HTMLInputElement>('#leurre-taille')!.value).toBe('7,5');
    expect(env.page.querySelector<HTMLInputElement>('#leurre-poids')!.value).toBe('12,5');
  });

  it('given son formulaire ouvert, when le leurre est supprimé ailleurs, then le formulaire se ferme et le focus va sur « Ajouter un leurre »', async () => {
    const env = await afficher();
    env.page.querySelector<HTMLElement>('li button')!.click();
    await env.stabiliser();
    env.supprimerAilleurs();
    await env.stabiliser();
    expect(env.page.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement?.textContent?.trim()).toBe('Ajouter un leurre');
  });

  it('given la liste, when je regarde une ligne, then le titre h3 contient le bouton et la ligne ne met pas de titre dans un bouton', async () => {
    const env = await afficher();
    expect(env.page.querySelector('li h3 button')?.textContent?.trim()).toBe('Shad');
    expect(env.page.querySelector('button h3, button p')).toBeNull();
  });
});
