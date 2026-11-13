/*
 * US 103 : voir le kit de départ conseillé. Maquette : docs/maquettes/us-103-kit-de-depart.html.
 *
 * Contrat du DOM (neutre sur les balises autres que ceux-ci) :
 *  - Onglet Boîte : un `button` « Kit de départ conseillé », à l'état vide comme avec des leurres, distinct de « Ajouter un leurre ».
 *  - Au toucher : un `[role="dialog"][aria-modal="true"]` (plein écran) avec un titre « Kit de départ conseillé » et un `button` « Fermer ».
 *    « Fermer » ou Échap ferment la feuille et rendent le focus au bouton d'ouverture.
 *  - Contenu : « Les leurres à acheter en premier, dans l’ordre. », puis « N sur T dans ta boîte » (T = taille du kit du contenu),
 *    puis un `li` par leurre du kit, dans l'ordre du contenu : « 1. », nom du type (repli : le typeId), la `raison`.
 *    Un leurre possédé (la boîte contient un leurre du même typeId, quelle que soit la taille) porte « Déjà dans ta boîte » (coche décorative).
 *  - Chargement : « Chargement du kit… ». Kit illisible : `[role="alert"]` « Impossible d'afficher le kit de départ. Réessaie plus tard. ».
 *    Types illisibles : les typeId à la place des noms, sans erreur.
 * Doubles : SOURCE_TACKLE_BOX (aucun appel Firebase) et CatalogService.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, ElementKit, TypeLeurre } from '../../core/data/catalog.service';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { BoitePage } from './boite.page';

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'cuiller', nom: 'Cuillère tournante' },
  { id: 'jig', nom: 'Jig à jupe' },
  { id: 'ver', nom: 'Ver souple finesse' },
  { id: 'minnow', nom: 'Minnow (jerkbait)' },
  { id: 'stick', nom: 'Stickbait' },
  { id: 'popper', nom: 'Popper' },
] as TypeLeurre[];

const element = (typeId: string, raison: string): ElementKit => ({ typeId, raison, sources: ['source'], dateVerif: '2026-11-04' }) as ElementKit;
const KIT5: ElementKit[] = [
  element('shad', 'Raison du shad.'),
  element('cuiller', 'Raison de la cuillère.'),
  element('ver', 'Raison du ver.'),
  element('minnow', 'Raison du minnow.'),
  element('stick', 'Raison du stickbait.'),
];

const doc = (id: string, typeId: string, tailleCm = 10): DocumentLeurre => ({
  id,
  data: { typeId, tailleCm, poidsG: 12, couleur: 'gardon', createdAt: 1700000000000 },
  enAttente: false,
});

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s  ]/g, '');
const attendre = () => new Promise<void>((r) => setTimeout(r));

interface Options {
  boite?: DocumentLeurre[];
  kit?: ElementKit[] | 'illisible' | 'attente';
  types?: TypeLeurre[] | 'illisible';
}

async function afficher({ boite = [], kit = KIT5, types = TYPES }: Options = {}) {
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => {
      ok([...boite]);
      return () => undefined;
    },
  };
  const catalogue = {
    typesDeLeurres: async () => (types === 'illisible' ? Promise.reject(new Error('types')) : types),
    kitDeDepart: () => (kit === 'illisible' ? Promise.reject(new Error('kit')) : kit === 'attente' ? new Promise<ElementKit[]>(() => undefined) : Promise.resolve(kit)),
  };
  await TestBed.configureTestingModule({
    imports: [BoitePage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: source },
      { provide: CatalogService, useValue: catalogue },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(BoitePage);
  document.body.appendChild(fixture.nativeElement);
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

const boutons = (racine: ParentNode) => [...racine.querySelectorAll<HTMLElement>('button, ion-button')];
const dialogue = (page: HTMLElement) => page.querySelector<HTMLElement>('[role="dialog"]');
const bouton = (racine: ParentNode, texte: string) => boutons(racine).find((b) => compact(b.textContent) === compact(texte));
const boutonKit = (page: HTMLElement) => {
  const b = boutons(page).find((x) => !x.closest('[role="dialog"]') && compact(x.textContent) === compact('Kit de départ conseillé'));
  if (!b) throw new Error('Aucun bouton « Kit de départ conseillé » hors de la feuille');
  return b;
};

async function ouvrirKit(env: Env): Promise<HTMLElement> {
  boutonKit(env.page).click();
  await env.stabiliser();
  const d = dialogue(env.page);
  if (!d) throw new Error('La feuille du kit ([role="dialog"]) n\'est pas ouverte');
  return d;
}

const lignes = (d: HTMLElement) => [...d.querySelectorAll<HTMLElement>('li')];
const texte = (e: Element) => (e.textContent ?? '').replace(/\s+/g, ' ').trim();
const possedes = (d: HTMLElement) => lignes(d).filter((l) => compact(l.textContent).includes(compact('Déjà dans ta boîte')));

describe('US 103 : kit de départ conseillé', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it('critère 1 : given l\'onglet « Boîte » affiché, when je touche « Kit de départ conseillé », then les 5 leurres du kit s\'affichent dans l\'ordre du contenu, avec leur nom et leur raison', async () => {
    const env = await afficher({ boite: [doc('a', 'jig')] });
    expect(dialogue(env.page)).toBeNull();
    const d = await ouvrirKit(env);
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(compact(d.textContent)).toContain(compact('Kit de départ conseillé'));
    const l = lignes(d);
    expect(l).toHaveLength(5);
    const attendus = [
      ['1.', 'Shad', 'Raison du shad.'],
      ['2.', 'Cuillère tournante', 'Raison de la cuillère.'],
      ['3.', 'Ver souple finesse', 'Raison du ver.'],
      ['4.', 'Minnow (jerkbait)', 'Raison du minnow.'],
      ['5.', 'Stickbait', 'Raison du stickbait.'],
    ];
    attendus.forEach((parties, i) => {
      for (const p of parties) expect(compact(l[i].textContent), `ligne ${i + 1}`).toContain(compact(p));
    });
    expect(compact(d.textContent)).toContain(compact('Les leurres à acheter en premier, dans l’ordre.'));
  });

  it('critère 1 : given la boîte vide, when je la regarde, then « Kit de départ conseillé » est proposé aussi à côté de « Ajouter un leurre »', async () => {
    const env = await afficher({ boite: [] });
    expect(env.page.textContent).toContain('Ta boîte est vide.');
    expect(boutonKit(env.page)).toBeTruthy();
    const d = await ouvrirKit(env);
    expect(lignes(d)).toHaveLength(5);
  });

  it('critère 1 : given la boîte avec des leurres, when je la regarde, then « Kit de départ conseillé » suit « Ajouter un leurre »', async () => {
    const env = await afficher({ boite: [doc('a', 'jig')] });
    const tous = boutons(env.page).map((b) => compact(b.textContent));
    const i = tous.indexOf(compact('Ajouter un leurre'));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(tous[i + 1]).toBe(compact('Kit de départ conseillé'));
  });

  it('critère 2 : given ma boîte contient un Shad et une cuillère de tailles différentes, when j\'ouvre le kit, then ces deux leurres portent « Déjà dans ta boîte » et pas les trois autres', async () => {
    const env = await afficher({ boite: [doc('a', 'shad', 25), doc('b', 'cuiller', 3), doc('c', 'jig')] });
    const d = await ouvrirKit(env);
    const l = lignes(d);
    expect(l).toHaveLength(5);
    expect(possedes(d)).toEqual([l[0], l[1]]);
    expect(compact(d.textContent)).toContain(compact('2 sur 5 dans ta boîte'));
  });

  it('critère 2 : given deux Shad dans la boîte, when j\'ouvre le kit, then le Shad du kit porte la mention une seule fois', async () => {
    const env = await afficher({ boite: [doc('a', 'shad', 7), doc('b', 'shad', 12)] });
    const d = await ouvrirKit(env);
    expect(possedes(d)).toHaveLength(1);
    expect(compact(lignes(d)[0].textContent).split(compact('Déjà dans ta boîte'))).toHaveLength(2);
    expect(compact(d.textContent)).toContain(compact('1 sur 5 dans ta boîte'));
  });

  it('critère 2 : given un leurre possédé, when je lis la mention, then la coche est décorative (aria-hidden) et le texte accessible est « Déjà dans ta boîte »', async () => {
    const env = await afficher({ boite: [doc('a', 'shad')] });
    const d = await ouvrirKit(env);
    const ligne = lignes(d)[0];
    const decoratifs = [...ligne.querySelectorAll('[aria-hidden="true"]')].map((e) => e.textContent ?? '');
    expect(decoratifs.some((t) => t.includes('✓'))).toBe(true);
    const visibleAuxLecteurs = [...ligne.querySelectorAll('*')].filter((e) => !e.closest('[aria-hidden="true"]') && e.children.length === 0).map(texte);
    expect(visibleAuxLecteurs).toContain('Déjà dans ta boîte');
  });

  it('critère 3 : given ma boîte est vide, when j\'ouvre le kit, then aucun leurre ne porte « Déjà dans ta boîte » et le bilan dit « 0 sur 5 dans ta boîte »', async () => {
    const env = await afficher({ boite: [] });
    const d = await ouvrirKit(env);
    expect(lignes(d)).toHaveLength(5);
    expect(compact(d.textContent)).not.toContain(compact('Déjà dans ta boîte'));
    expect(compact(d.textContent)).toContain(compact('0 sur 5 dans ta boîte'));
  });

  it('critère 4 : given un kit de contenu différent (3 leurres d\'autres types), when j\'ouvre le kit, then la liste est celle du contenu et le bilan suit « N sur 3 »', async () => {
    const kit = [element('jig', 'Raison du jig.'), element('popper', 'Raison du popper.'), element('shad', 'Raison du shad bis.')];
    const env = await afficher({ kit, boite: [doc('a', 'popper'), doc('b', 'stick')] });
    const d = await ouvrirKit(env);
    const l = lignes(d);
    expect(l).toHaveLength(3);
    expect(compact(l[0].textContent)).toContain(compact('1.Jig à jupe'));
    expect(compact(l[1].textContent)).toContain(compact('2.Popper'));
    expect(compact(l[2].textContent)).toContain(compact('3.Shad'));
    expect(compact(l[2].textContent)).toContain(compact('Raison du shad bis.'));
    expect(possedes(d)).toEqual([l[1]]);
    expect(compact(d.textContent)).toContain(compact('1 sur 3 dans ta boîte'));
    expect(compact(d.textContent)).not.toContain('Cuillère');
  });

  it('critère 4 : given un kit de contenu de 6 leurres, when j\'ouvre le kit, then 6 leurres s\'affichent, numérotés de 1 à 6', async () => {
    const kit = [...KIT5, element('popper', 'Raison du popper.')];
    const env = await afficher({ kit });
    const d = await ouvrirKit(env);
    expect(lignes(d)).toHaveLength(6);
    expect(compact(lignes(d)[5].textContent)).toContain(compact('6.Popper'));
    expect(compact(d.textContent)).toContain(compact('0 sur 6 dans ta boîte'));
  });

  it('given le contenu ne connaît pas un type du kit, when j\'ouvre le kit, then l\'identifiant du type est affiché à la place du nom', async () => {
    const env = await afficher({ kit: [element('type-inconnu', 'Raison inconnue.')] });
    const d = await ouvrirKit(env);
    expect(compact(lignes(d)[0].textContent)).toContain(compact('1.type-inconnu'));
  });

  it('given les types de leurres illisibles, when j\'ouvre le kit, then les identifiants s\'affichent sans message d\'erreur', async () => {
    const env = await afficher({ types: 'illisible' });
    const d = await ouvrirKit(env);
    expect(lignes(d)).toHaveLength(5);
    expect(compact(lignes(d)[0].textContent)).toContain(compact('1.shad'));
    expect(d.querySelector('[role="alert"]')).toBeNull();
  });

  it('given le kit en cours de lecture, when j\'ouvre le kit, then « Chargement du kit… » s\'affiche', async () => {
    const env = await afficher({ kit: 'attente' });
    const d = await ouvrirKit(env);
    expect(compact(d.textContent)).toContain(compact('Chargement du kit…'));
    expect(lignes(d)).toHaveLength(0);
  });

  it('given le kit illisible, when j\'ouvre le kit, then une alerte « Impossible d\'afficher le kit de départ. Réessaie plus tard. » s\'affiche et la feuille reste fermable', async () => {
    const env = await afficher({ kit: 'illisible' });
    const d = await ouvrirKit(env);
    const alerte = d.querySelector('[role="alert"]');
    expect(alerte && texte(alerte)).toBe('Impossible d\'afficher le kit de départ. Réessaie plus tard.');
    expect(lignes(d)).toHaveLength(0);
    expect(bouton(d, 'Fermer')).toBeTruthy();
  });

  it('given la feuille du kit ouverte, when je touche « Fermer », then elle se ferme et le focus revient sur « Kit de départ conseillé »', async () => {
    const env = await afficher({ boite: [doc('a', 'shad')] });
    const ouverture = boutonKit(env.page);
    ouverture.focus();
    const d = await ouvrirKit(env);
    bouton(d, 'Fermer')!.click();
    await env.stabiliser();
    expect(dialogue(env.page)).toBeNull();
    expect(document.activeElement).toBe(ouverture);
  });

  it('given la feuille du kit ouverte, when j\'appuie sur Échap, then elle se ferme et le focus revient sur « Kit de départ conseillé »', async () => {
    const env = await afficher({ boite: [] });
    const ouverture = boutonKit(env.page);
    ouverture.focus();
    const d = await ouvrirKit(env);
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await env.stabiliser();
    expect(dialogue(env.page)).toBeNull();
    expect(document.activeElement).toBe(ouverture);
  });
});
