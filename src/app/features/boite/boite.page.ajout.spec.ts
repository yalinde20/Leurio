/*
 * US 99 : ajouter un leurre à ma boîte et voir la liste. Maquette : docs/maquettes/us-99-ajouter-un-leurre.html.
 * Contrat du service et de la source : voir src/app/core/data/tackle-box.service.spec.ts.
 *
 * Contrat du DOM (neutre sur les balises autres que ceux-ci) :
 *  - Chargement (premier instantané pas encore arrivé) : « Chargement de ta boîte… ». Boîte vide : « Ta boîte est vide. » et un
 *    `button` (ou `ion-button`) « Ajouter un leurre ». Sinon, ce bouton reste en haut de la liste.
 *  - La liste : des `li` (un par leurre, le plus récent d'abord) qui portent le nom du type (CatalogService.typesDeLeurres(), par `id`),
 *    la ligne « 10 cm · 12 g · gardon », la marque si elle existe, et « Pas encore synchronisé : il le sera au retour du réseau. »
 *    seulement si `enAttente`.
 *  - Au toucher du bouton : un élément `[role="dialog"]` (dans la page, plein écran, comme les feuilles des US 83/87) contenant un titre
 *    « Ajouter un leurre », un `button` « Annuler » et un `button` « Enregistrer ». Contrôles trouvés par leur libellé (`aria-label`,
 *    `label[for]` ou `label` englobant) : « Type » (`select` : une `option` par type du contenu, dans l'ordre, plus éventuellement une
 *    option d'invite à `value` vide), « Taille (cm) », « Poids (g) », « Couleur », « Marque (facultatif) » (`input`).
 *    Les tests fixent `value` puis émettent `input` et `change`. La virgule décimale est acceptée (« 12,5 »).
 *  - Erreur : un `[role="alert"]` sous le champ, désigné par `aria-describedby` du contrôle : « Champ obligatoire » (champ vide) ou
 *    « Entre un nombre supérieur à 0. » (taille ou poids non numérique ou ≤ 0). Rien n'est enregistré, la feuille reste ouverte.
 *  - Succès : la feuille se ferme et le leurre apparaît dans la liste. « Annuler » ferme sans rien enregistrer.
 * Doubles : SOURCE_TACKLE_BOX (aucun appel Firebase) et CatalogService.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import typesReels from '../../../assets/data/lure-types.json';
import { BoitePage } from './boite.page';

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'jig', nom: 'Jig à jupe' },
  { id: 'cuiller', nom: 'Cuillère tournante' },
] as TypeLeurre[];

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');
const attendre = () => new Promise<void>((r) => setTimeout(r));

interface Options {
  initiaux?: DocumentLeurre[] | 'attente';
  types?: TypeLeurre[];
  hors_ligne?: boolean;
}

async function afficher({ initiaux = [], types = TYPES, hors_ligne = false }: Options = {}) {
  const ecritures: Record<string, unknown>[] = [];
  let docs: DocumentLeurre[] = initiaux === 'attente' ? [] : [...initiaux];
  let rappel: ((d: DocumentLeurre[]) => void) | null = null;
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => {
      rappel = ok;
      if (initiaux !== 'attente') ok([...docs]);
      return () => undefined;
    },
    ajouter: async (_u: string, data: Record<string, unknown>) => {
      ecritures.push(data);
      docs = [...docs, { id: `n${docs.length}`, data, enAttente: hors_ligne }];
      rappel?.([...docs]);
    },
  };
  await TestBed.configureTestingModule({
    imports: [BoitePage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: source },
      { provide: CatalogService, useValue: { typesDeLeurres: async () => types } },
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
  return {
    page: fixture.nativeElement as HTMLElement,
    stabiliser,
    ecritures,
    premierInstantane: () => rappel?.([...docs]),
    synchroniser: () => {
      docs = docs.map((d) => ({ ...d, enAttente: false }));
      rappel?.([...docs]);
    },
  };
}
type Env = Awaited<ReturnType<typeof afficher>>;

const boutons = (racine: ParentNode) => [...racine.querySelectorAll<HTMLElement>('button, ion-button')];
const dialogue = (page: HTMLElement) => page.querySelector<HTMLElement>('[role="dialog"]');
const bouton = (racine: ParentNode, texte: string) => boutons(racine).find((b) => compact(b.textContent) === compact(texte));
const boutonAjout = (page: HTMLElement) => {
  const b = boutons(page).find((x) => !x.closest('[role="dialog"]') && compact(x.textContent) === compact('Ajouter un leurre'));
  if (!b) throw new Error('Aucun bouton « Ajouter un leurre » hors du formulaire');
  return b;
};

function formulaire(page: HTMLElement): HTMLElement {
  const d = dialogue(page);
  if (!d) throw new Error('Le formulaire ([role="dialog"]) n\'est pas ouvert');
  return d;
}

function controle<T extends HTMLElement = HTMLInputElement>(page: HTMLElement, libelle: string): T {
  const f = formulaire(page);
  const trouve = [...f.querySelectorAll<HTMLElement>('input, select')].find((c) => {
    const parLabel = c.id ? f.querySelector(`label[for="${c.id}"]`) : null;
    const texte = c.getAttribute('aria-label') ?? parLabel?.textContent ?? c.closest('label')?.textContent ?? '';
    return compact(texte).startsWith(compact(libelle));
  });
  if (!trouve) throw new Error(`Aucun champ libellé « ${libelle} » dans le formulaire`);
  return trouve as T;
}

function saisir(page: HTMLElement, libelle: string, valeur: string): void {
  const c = controle<HTMLInputElement | HTMLSelectElement>(page, libelle);
  if (c instanceof HTMLSelectElement) {
    const option = [...c.options].find((o) => compact(o.textContent) === compact(valeur));
    if (!option) throw new Error(`Aucune option « ${valeur} » dans « ${libelle} »`);
    c.value = option.value;
  } else {
    c.value = valeur;
  }
  c.dispatchEvent(new Event('input', { bubbles: true }));
  c.dispatchEvent(new Event('change', { bubbles: true }));
}

async function ouvrir(env: Env): Promise<void> {
  boutonAjout(env.page).click();
  await env.stabiliser();
}

async function remplir(env: Env, v: Partial<Record<'Type' | 'Taille (cm)' | 'Poids (g)' | 'Couleur' | 'Marque (facultatif)', string>>) {
  for (const [libelle, valeur] of Object.entries(v)) saisir(env.page, libelle, valeur);
  await env.stabiliser();
}

async function enregistrer(env: Env): Promise<void> {
  const b = bouton(formulaire(env.page), 'Enregistrer');
  if (!b) throw new Error('Aucun bouton « Enregistrer »');
  b.click();
  await env.stabiliser();
}

const alertes = (page: HTMLElement) => [...formulaire(page).querySelectorAll<HTMLElement>('[role="alert"]')];
function alerteDe(page: HTMLElement, libelle: string): string | undefined {
  const id = controle(page, libelle).getAttribute('aria-describedby');
  return id ? formulaire(page).querySelector(`#${CSS.escape(id)}`)?.textContent?.trim() : undefined;
}

const SHAD_10_12 = { Type: 'Shad', 'Taille (cm)': '10', 'Poids (g)': '12', Couleur: 'gardon' } as const;
const doc = (id: string, createdAt: number, extra: Record<string, unknown> = {}, enAttente = false): DocumentLeurre => ({
  id,
  enAttente,
  data: { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', marque: '', createdAt, ...extra },
});
const lignes = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('li')];

describe('BoitePage : ajouter un leurre (US 99)', () => {
  it('given le premier instantané n\'est pas arrivé, when j\'ouvre l\'onglet « Boîte », then « Chargement de ta boîte… » s\'affiche à la place de l\'état vide', async () => {
    const env = await afficher({ initiaux: 'attente' });
    expect(compact(env.page.textContent)).toContain(compact('Chargement de ta boîte…'));
    expect(compact(env.page.textContent)).not.toContain(compact('Ta boîte est vide.'));
  });

  it('given ma boîte est vide, when j\'ouvre l\'onglet « Boîte », then le message « Ta boîte est vide. » et le bouton « Ajouter un leurre » s\'affichent', async () => {
    const env = await afficher();
    expect(compact(env.page.textContent)).toContain(compact('Ta boîte est vide.'));
    expect(compact(env.page.textContent)).not.toContain(compact('Chargement de ta boîte'));
    expect(boutonAjout(env.page)).toBeTruthy();
    expect(dialogue(env.page)).toBeNull();
  });

  it('given je touche « Ajouter un leurre », when le formulaire s\'ouvre, then il propose « Type », « Taille (cm) », « Poids (g) », « Couleur », « Marque (facultatif) » et le bouton « Enregistrer »', async () => {
    const env = await afficher();
    await ouvrir(env);
    expect(compact(formulaire(env.page).textContent)).toContain(compact('Ajouter un leurre'));
    expect(controle(env.page, 'Type').tagName).toBe('SELECT');
    for (const l of ['Taille (cm)', 'Poids (g)', 'Couleur', 'Marque (facultatif)']) expect(controle(env.page, l).tagName).toBe('INPUT');
    expect(bouton(formulaire(env.page), 'Enregistrer')).toBeTruthy();
    expect(bouton(formulaire(env.page), 'Annuler')).toBeTruthy();
  });

  it('given le formulaire ouvert, when je touche « Annuler », then il se ferme et rien n\'est enregistré', async () => {
    const env = await afficher();
    await ouvrir(env);
    await remplir(env, SHAD_10_12);
    bouton(formulaire(env.page), 'Annuler')!.click();
    await env.stabiliser();
    expect(dialogue(env.page)).toBeNull();
    expect(env.ecritures).toEqual([]);
  });

  it('given un type est ajouté au contenu, when j\'ouvre le champ « Type », then il apparaît dans la liste sans modification du code', async () => {
    const env = await afficher({ types: [...TYPES, { id: 'nouveau', nom: 'Type tout neuf' } as TypeLeurre] });
    await ouvrir(env);
    const noms = [...controle<HTMLSelectElement>(env.page, 'Type').options].filter((o) => o.value !== '').map((o) => o.textContent!.trim());
    expect(noms).toEqual(['Shad', 'Jig à jupe', 'Cuillère tournante', 'Type tout neuf']);
  });

  it('given le contenu réel lure-types.json, when j\'ouvre le champ « Type », then il propose le nom de chaque type, dans l\'ordre du contenu', async () => {
    const env = await afficher({ types: typesReels as unknown as TypeLeurre[] });
    await ouvrir(env);
    const noms = [...controle<HTMLSelectElement>(env.page, 'Type').options].filter((o) => o.value !== '').map((o) => o.textContent!.trim());
    expect(noms).toEqual((typesReels as { nom: string }[]).map((t) => t.nom));
  });

  it('given le formulaire rempli avec un type, 10 cm, 12 g et la couleur gardon, when je touche « Enregistrer », then le leurre apparaît dans la liste avec son type, sa taille, son poids, sa couleur et sa marque, et il est écrit dans la boîte', async () => {
    const env = await afficher();
    await ouvrir(env);
    await remplir(env, { ...SHAD_10_12, 'Marque (facultatif)': 'Sakura' });
    await enregistrer(env);

    expect(env.ecritures).toHaveLength(1);
    expect(env.ecritures[0]).toMatchObject({ typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', marque: 'Sakura' });
    expect(typeof env.ecritures[0]['createdAt']).toBe('number');
    expect(dialogue(env.page)).toBeNull();
    const [leurre] = lignes(env.page);
    expect(compact(leurre.textContent)).toContain(compact('Shad'));
    expect(compact(leurre.textContent)).toContain(compact('10 cm · 12 g · gardon'));
    expect(compact(leurre.textContent)).toContain(compact('Sakura'));
    expect(compact(env.page.textContent)).not.toContain(compact('Ta boîte est vide.'));
  });

  it('given une taille avec virgule décimale, when j\'enregistre, then le nombre est lu avec la virgule (12,5 = 12.5)', async () => {
    const env = await afficher();
    await ouvrir(env);
    await remplir(env, { ...SHAD_10_12, 'Taille (cm)': '12,5' });
    await enregistrer(env);
    expect(env.ecritures[0]['tailleCm']).toBe(12.5);
  });

  it('given deux leurres, when je regarde la liste, then le plus récent est en premier, sans marque il n\'y a pas de ligne de marque, et le bouton « Ajouter un leurre » reste au-dessus de la liste', async () => {
    const env = await afficher({
      initiaux: [doc('vieux', 1000, { typeId: 'cuiller', tailleCm: 4, poidsG: 5, couleur: 'argent' }), doc('recent', 2000, { marque: 'Sakura' })],
    });
    const l = lignes(env.page);
    expect(l).toHaveLength(2);
    expect(compact(l[0].textContent)).toContain(compact('Shad'));
    expect(compact(l[0].textContent)).toContain(compact('Sakura'));
    expect(compact(l[1].textContent)).toBe(compact('Cuillère tournante4 cm · 5 g · argent'));
    const ajout = boutonAjout(env.page);
    expect(ajout.compareDocumentPosition(l[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('given le type, la taille, le poids ou la couleur est vide, when je touche « Enregistrer », then le leurre n\'est pas enregistré et « Champ obligatoire » s\'affiche sous chaque champ vide', async () => {
    const env = await afficher();
    await ouvrir(env);
    await enregistrer(env);
    expect(env.ecritures).toEqual([]);
    expect(dialogue(env.page)).not.toBeNull();
    for (const l of ['Type', 'Taille (cm)', 'Poids (g)', 'Couleur']) expect(alerteDe(env.page, l), l).toBe('Champ obligatoire');
    expect(alerteDe(env.page, 'Marque (facultatif)')).toBeUndefined();
    expect(alertes(env.page)).toHaveLength(4);
  });

  it('given seule la couleur est vide, when je touche « Enregistrer », then seul le champ « Couleur » affiche « Champ obligatoire » et rien n\'est enregistré', async () => {
    const env = await afficher();
    await ouvrir(env);
    await remplir(env, { ...SHAD_10_12, Couleur: '   ' });
    await enregistrer(env);
    expect(env.ecritures).toEqual([]);
    expect(alertes(env.page).map((a) => a.textContent!.trim())).toEqual(['Champ obligatoire']);
    expect(alerteDe(env.page, 'Couleur')).toBe('Champ obligatoire');
  });

  it('given la taille ou le poids n\'est pas un nombre supérieur à 0, when je touche « Enregistrer », then le leurre n\'est pas enregistré et « Entre un nombre supérieur à 0. » s\'affiche sous le champ', async () => {
    const env = await afficher();
    await ouvrir(env);
    await remplir(env, { ...SHAD_10_12, 'Taille (cm)': '0', 'Poids (g)': 'abc' });
    await enregistrer(env);
    expect(env.ecritures).toEqual([]);
    expect(alerteDe(env.page, 'Taille (cm)')).toBe('Entre un nombre supérieur à 0.');
    expect(alerteDe(env.page, 'Poids (g)')).toBe('Entre un nombre supérieur à 0.');
    expect(alerteDe(env.page, 'Couleur')).toBeUndefined();
  });

  it('given un poids négatif et une taille valide, when je touche « Enregistrer », then seul le poids affiche « Entre un nombre supérieur à 0. »', async () => {
    const env = await afficher();
    await ouvrir(env);
    await remplir(env, { ...SHAD_10_12, 'Poids (g)': '-3' });
    await enregistrer(env);
    expect(env.ecritures).toEqual([]);
    expect(alertes(env.page).map((a) => a.textContent!.trim())).toEqual(['Entre un nombre supérieur à 0.']);
    expect(alerteDe(env.page, 'Poids (g)')).toBe('Entre un nombre supérieur à 0.');
  });

  it('given je n\'ai pas de réseau, when j\'enregistre un leurre, then il apparaît tout de suite dans la liste avec « Pas encore synchronisé : il le sera au retour du réseau. », mention qui disparaît une fois synchronisé', async () => {
    const mention = compact('Pas encore synchronisé : il le sera au retour du réseau.');
    const env = await afficher({ initiaux: [doc('ancien', 1000)], hors_ligne: true });
    expect(compact(env.page.textContent)).not.toContain(mention);
    await ouvrir(env);
    await remplir(env, { ...SHAD_10_12, Type: 'Jig à jupe', Couleur: 'noir' });
    await enregistrer(env);

    const l = lignes(env.page);
    expect(l).toHaveLength(2);
    expect(compact(l[0].textContent)).toContain(compact('Jig à jupe'));
    expect(compact(l[0].textContent)).toContain(mention);
    expect(compact(l[1].textContent)).not.toContain(mention);

    env.synchroniser();
    await env.stabiliser();
    expect(compact(env.page.textContent)).not.toContain(mention);
    expect(lignes(env.page)).toHaveLength(2);
  });
});
