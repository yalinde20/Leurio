/*
 * US 100 : filtrer ma boîte par famille de leurres. Maquette : docs/maquettes/us-100-filtrer-par-famille.html.
 *
 * Contrat du DOM : sous « Ajouter un leurre », un `[role="radiogroup"]` libellé « Famille » (aria-label ou aria-labelledby) contient
 * des `[role="radio"]` (ou `input[type=radio]`) : « Toutes » puis chaque `famille` distincte du contenu, dans l'ordre de première
 * apparition. L'option choisie porte `aria-checked="true"` (ou `checked`). Famille sans leurre : le filtre reste et le texte
 * « Aucun leurre de cette famille. » remplace la liste. Boîte vide ou contenu illisible : pas de filtre.
 * Doubles : SOURCE_TACKLE_BOX (aucun appel Firebase) et CatalogService.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { BoitePage } from './boite.page';

const TYPES = [
  { id: 'shad', nom: 'Shad', famille: 'Souples' },
  { id: 'ver-finesse', nom: 'Ver finesse', famille: 'Souples' },
  { id: 'crankbait', nom: 'Crankbait', famille: 'Durs' },
  { id: 'popper', nom: 'Popper', famille: 'Surface' },
  { id: 'jig', nom: 'Jig à jupe', famille: 'À jupe' },
] as unknown as TypeLeurre[];

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s  ]/g, '');
const attendre = () => new Promise<void>((r) => setTimeout(r));
const doc = (id: string, typeId: string, createdAt: number): DocumentLeurre => ({
  id,
  enAttente: false,
  data: { typeId, tailleCm: 10, poidsG: 12, couleur: 'gardon', marque: '', createdAt },
});
const BOITE = [doc('a', 'shad', 5), doc('b', 'crankbait', 4), doc('c', 'ver-finesse', 3), doc('d', 'popper', 2)];

async function afficher(initiaux: DocumentLeurre[] = BOITE, typesLisibles = true) {
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => {
      ok([...initiaux]);
      return () => undefined;
    },
    ajouter: async () => undefined,
  };
  await TestBed.configureTestingModule({
    imports: [BoitePage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: source },
      {
        provide: CatalogService,
        useValue: { typesDeLeurres: async () => (typesLisibles ? TYPES : Promise.reject(new Error('illisible'))) },
      },
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
  return { page: fixture.nativeElement as HTMLElement, stabiliser };
}
type Env = Awaited<ReturnType<typeof afficher>>;

const groupe = (page: HTMLElement) => page.querySelector<HTMLElement>('[role="radiogroup"]');
const options = (page: HTMLElement) =>
  [...(groupe(page)?.querySelectorAll<HTMLElement>('[role="radio"], input[type="radio"]') ?? [])];
const libelle = (o: HTMLElement) =>
  compact(o.getAttribute('aria-label') ?? (o.closest('label') ?? o).textContent);
const coche = (o: HTMLElement) =>
  o.getAttribute('aria-checked') === 'true' || (o instanceof HTMLInputElement && o.checked);
const option = (page: HTMLElement, nom: string) => {
  const o = options(page).find((x) => libelle(x) === compact(nom));
  if (!o) throw new Error(`Aucune option « ${nom} » dans le filtre « Famille »`);
  return o;
};
async function choisir(env: Env, nom: string) {
  option(env.page, nom).click();
  await env.stabiliser();
}
const noms = (page: HTMLElement) => [...page.querySelectorAll('li h3')].map((h) => h.textContent?.trim());

describe('BoitePage : filtrer par famille (US 100)', () => {
  it('given ma boîte contient des leurres, when j\'ouvre l\'onglet « Boîte », then un filtre « Famille » propose « Toutes » et chaque famille du contenu, « Toutes » étant sélectionné', async () => {
    const env = await afficher();
    const g = groupe(env.page);
    expect(g).not.toBeNull();
    expect(compact(g!.getAttribute('aria-label') ?? env.page.querySelector(`#${CSS.escape(g!.getAttribute('aria-labelledby') ?? 'x')}`)?.textContent)).toBe('Famille');
    expect(options(env.page).map(libelle)).toEqual(['Toutes', 'Souples', 'Durs', 'Surface', 'Àjupe'].map(compact));
    expect(options(env.page).filter(coche).map(libelle)).toEqual(['Toutes']);
    expect(noms(env.page)).toEqual(['Shad', 'Crankbait', 'Ver finesse', 'Popper']);
  });

  it('given le filtre est affiché, when je choisis une famille, then seuls les leurres de cette famille sont listés', async () => {
    const env = await afficher();
    await choisir(env, 'Souples');
    expect(noms(env.page)).toEqual(['Shad', 'Ver finesse']);
    expect(options(env.page).filter(coche).map(libelle)).toEqual(['Souples']);
  });

  it('given je choisis une famille dont je n\'ai aucun leurre, when la liste se met à jour, then le message « Aucun leurre de cette famille. » s\'affiche et le filtre reste', async () => {
    const env = await afficher();
    await choisir(env, 'À jupe');
    expect(compact(env.page.textContent)).toContain(compact('Aucun leurre de cette famille.'));
    expect(noms(env.page)).toEqual([]);
    expect(options(env.page).length).toBe(5);
  });

  it('given une famille est sélectionnée, when je choisis « Toutes », then tous mes leurres sont listés', async () => {
    const env = await afficher();
    await choisir(env, 'Durs');
    expect(noms(env.page)).toEqual(['Crankbait']);
    await choisir(env, 'Toutes');
    expect(noms(env.page)).toEqual(['Shad', 'Crankbait', 'Ver finesse', 'Popper']);
    expect(compact(env.page.textContent)).not.toContain(compact('Aucun leurre de cette famille.'));
  });

  it('given ma boîte est vide, when j\'ouvre l\'onglet « Boîte », then aucun filtre n\'est affiché', async () => {
    const env = await afficher([]);
    expect(groupe(env.page)).toBeNull();
    expect(compact(env.page.textContent)).toContain(compact('Ta boîte est vide.'));
  });

  it('given le contenu des types est illisible, when j\'ouvre l\'onglet « Boîte », then le filtre est masqué et la liste est affichée comme avant', async () => {
    const env = await afficher(BOITE, false);
    expect(groupe(env.page)).toBeNull();
    expect(noms(env.page)).toEqual(['shad', 'crankbait', 'ver-finesse', 'popper']);
  });
});
