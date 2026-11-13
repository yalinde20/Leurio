/*
 * US 101 : modifier ou supprimer un leurre de ma boîte. Maquette : docs/maquettes/us-101-modifier-supprimer-leurre.html.
 * Contrat du formulaire et de la liste de l'US 99 : voir boite.page.ajout.spec.ts. Contrat du service : voir
 * src/app/core/data/tackle-box.service.modification.spec.ts.
 *
 * Contrat du DOM ajouté par l'US 101 :
 *  - Chaque `li` de la liste contient un `button` (touchable, ≥ 48 px, chevron ›) ; le toucher ouvre le formulaire de l'US 99
 *    (`[role="dialog"]`) titré « Modifier le leurre », prérempli (Type, Taille (cm), Poids (g), Couleur, Marque (facultatif)),
 *    avec les boutons « Annuler », « Enregistrer » et « Supprimer » (ce dernier dans le dialogue). Les libellés du bouton
 *    ne contiennent pas « Ajouter un leurre ».
 *  - « Supprimer » ouvre un `[role="alertdialog"]` (n'importe où dans le document) contenant « Supprimer ce leurre ? » et deux
 *    `button` : « Annuler » (ferme la confirmation, le formulaire reste ouvert) et « Supprimer » (ferme tout, le leurre part).
 *  - Échec d'écriture : le formulaire reste ouvert avec « Impossible d'enregistrer le leurre. Réessaie. » ou
 *    « Impossible de supprimer le leurre. Réessaie. » dans un `[role="alert"]`.
 * Doubles : SOURCE_TACKLE_BOX (modifier(uid, id, data) fusionne data dans le document ; supprimer(uid, id) le retire) et CatalogService.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { BoitePage } from './boite.page';

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'jig', nom: 'Jig à jupe' },
  { id: 'cuiller', nom: 'Cuillère tournante' },
] as TypeLeurre[];

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');
const attendre = () => new Promise<void>((r) => setTimeout(r));

interface Options {
  initiaux?: DocumentLeurre[];
  hors_ligne?: boolean;
  echec?: 'modifier' | 'supprimer';
}

async function afficher({ initiaux = [], hors_ligne = false, echec }: Options = {}) {
  const modifications: { id: string; data: Record<string, unknown> }[] = [];
  const suppressions: string[] = [];
  let docs: DocumentLeurre[] = [...initiaux];
  let rappel: ((d: DocumentLeurre[]) => void) | null = null;
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => {
      rappel = ok;
      ok([...docs]);
      return () => undefined;
    },
    ajouter: async () => undefined,
    modifier: async (_u: string, id: string, data: Record<string, unknown>) => {
      if (echec === 'modifier') throw new Error('refusé');
      modifications.push({ id, data });
      docs = docs.map((d) => (d.id === id ? { ...d, data: { ...(d.data as object), ...data }, enAttente: hors_ligne } : d));
      rappel?.([...docs]);
    },
    supprimer: async (_u: string, id: string) => {
      if (echec === 'supprimer') throw new Error('refusé');
      suppressions.push(id);
      docs = docs.filter((d) => d.id !== id);
      rappel?.([...docs]);
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
    modifications,
    suppressions,
    synchroniser: () => {
      docs = docs.map((d) => ({ ...d, enAttente: false }));
      rappel?.([...docs]);
    },
  };
}
type Env = Awaited<ReturnType<typeof afficher>>;

const boutons = (racine: ParentNode) => [...racine.querySelectorAll<HTMLElement>('button, ion-button')];
const dialogue = (page: HTMLElement) => page.querySelector<HTMLElement>('[role="dialog"]');
const lignes = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('li')];
const confirmation = () => document.querySelector<HTMLElement>('[role="alertdialog"]');

function formulaire(page: HTMLElement): HTMLElement {
  const d = dialogue(page);
  if (!d) throw new Error('Le formulaire ([role="dialog"]) n\'est pas ouvert');
  return d;
}

/** Boutons du formulaire, hors confirmation éventuelle imbriquée. */
const boutonForm = (page: HTMLElement, texte: string) =>
  boutons(formulaire(page)).find((b) => !b.closest('[role="alertdialog"]') && compact(b.textContent) === compact(texte));

const boutonConfirmation = (texte: string) => {
  const c = confirmation();
  if (!c) throw new Error('Aucune confirmation ([role="alertdialog"]) affichée');
  const b = boutons(c).find((x) => compact(x.textContent) === compact(texte));
  if (!b) throw new Error(`Aucun bouton « ${texte} » dans la confirmation`);
  return b;
};

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
  c.value = valeur;
  c.dispatchEvent(new Event('input', { bubbles: true }));
  c.dispatchEvent(new Event('change', { bubbles: true }));
}

const doc = (id: string, createdAt: number, extra: Record<string, unknown> = {}, enAttente = false): DocumentLeurre => ({
  id,
  enAttente,
  data: { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', marque: 'Sakura', createdAt, ...extra },
});
const DEUX = () => [
  doc('recent', 2000),
  doc('vieux', 1000, { typeId: 'cuiller', tailleCm: 4, poidsG: 5, couleur: 'argent', marque: '' }),
];

async function toucherLigne(env: Env, index: number): Promise<void> {
  const ligne = lignes(env.page)[index];
  const cible = ligne?.querySelector<HTMLElement>('button');
  if (!cible) throw new Error(`La ligne ${index} n'a pas de bouton à toucher`);
  cible.click();
  await env.stabiliser();
}
async function cliquer(env: Env, b: HTMLElement | undefined, nom: string): Promise<void> {
  if (!b) throw new Error(`Aucun bouton « ${nom} »`);
  b.click();
  await env.stabiliser();
}

afterEach(() => document.querySelectorAll('ion-alert').forEach((a) => a.remove()));

describe('BoitePage : modifier ou supprimer un leurre (US 101)', () => {
  it('given ma boîte contient un leurre, when je le touche dans la liste, then le formulaire s\'ouvre prérempli avec ses valeurs, avec les boutons « Enregistrer » et « Supprimer »', async () => {
    const env = await afficher({ initiaux: DEUX() });
    await toucherLigne(env, 0);

    expect(compact(formulaire(env.page).textContent)).toContain(compact('Modifier le leurre'));
    const type = controle<HTMLSelectElement>(env.page, 'Type');
    expect(type.options[type.selectedIndex].textContent!.trim()).toBe('Shad');
    expect(controle(env.page, 'Taille (cm)').value.replace(',', '.')).toBe('10');
    expect(controle(env.page, 'Poids (g)').value.replace(',', '.')).toBe('12');
    expect(controle(env.page, 'Couleur').value).toBe('gardon');
    expect(controle(env.page, 'Marque (facultatif)').value).toBe('Sakura');
    expect(boutonForm(env.page, 'Enregistrer')).toBeTruthy();
    expect(boutonForm(env.page, 'Supprimer')).toBeTruthy();
    expect(boutonForm(env.page, 'Annuler')).toBeTruthy();
  });

  it('given un leurre touché, when le formulaire s\'ouvre, then c\'est celui de ce leurre et non d\'un autre', async () => {
    const env = await afficher({ initiaux: DEUX() });
    await toucherLigne(env, 1);
    const type = controle<HTMLSelectElement>(env.page, 'Type');
    expect(type.options[type.selectedIndex].textContent!.trim()).toBe('Cuillère tournante');
    expect(controle(env.page, 'Couleur').value).toBe('argent');
    expect(controle(env.page, 'Marque (facultatif)').value).toBe('');
  });

  it('given le formulaire d\'un leurre est ouvert, when je change sa taille et je touche « Enregistrer », then la liste montre la nouvelle taille, à la même place, et le document du leurre est mis à jour', async () => {
    const env = await afficher({ initiaux: DEUX() });
    await toucherLigne(env, 0);
    saisir(env.page, 'Taille (cm)', '12');
    await env.stabiliser();
    await cliquer(env, boutonForm(env.page, 'Enregistrer'), 'Enregistrer');

    expect(env.modifications).toHaveLength(1);
    expect(env.modifications[0].id).toBe('recent');
    expect(env.modifications[0].data).toEqual({ typeId: 'shad', tailleCm: 12, poidsG: 12, couleur: 'gardon', marque: 'Sakura' });
    expect(dialogue(env.page)).toBeNull();
    const l = lignes(env.page);
    expect(l).toHaveLength(2);
    expect(compact(l[0].textContent)).toContain(compact('12 cm · 12 g · gardon'));
    expect(compact(l[0].textContent)).toContain(compact('Shad'));
    expect(compact(l[1].textContent)).toContain(compact('Cuillère tournante'));
  });

  it('given le formulaire d\'un leurre est ouvert, when je saisis une taille à 0 et je touche « Enregistrer », then rien n\'est modifié et « Entre un nombre supérieur à 0. » s\'affiche (mêmes règles que l\'ajout)', async () => {
    const env = await afficher({ initiaux: DEUX() });
    await toucherLigne(env, 0);
    saisir(env.page, 'Taille (cm)', '0');
    await env.stabiliser();
    await cliquer(env, boutonForm(env.page, 'Enregistrer'), 'Enregistrer');
    expect(env.modifications).toEqual([]);
    expect(dialogue(env.page)).not.toBeNull();
    expect(compact(formulaire(env.page).textContent)).toContain(compact('Entre un nombre supérieur à 0.'));
  });

  it('given le formulaire d\'un leurre est ouvert, when je touche « Annuler », then il se ferme et rien n\'est modifié', async () => {
    const env = await afficher({ initiaux: DEUX() });
    await toucherLigne(env, 0);
    saisir(env.page, 'Taille (cm)', '99');
    await env.stabiliser();
    await cliquer(env, boutonForm(env.page, 'Annuler'), 'Annuler');
    expect(dialogue(env.page)).toBeNull();
    expect(env.modifications).toEqual([]);
    expect(compact(lignes(env.page)[0].textContent)).toContain(compact('10 cm'));
  });

  it('given le formulaire d\'un leurre est ouvert, when je touche « Supprimer », then une confirmation « Supprimer ce leurre ? » propose « Supprimer » et « Annuler », et rien n\'est encore supprimé', async () => {
    const env = await afficher({ initiaux: DEUX() });
    await toucherLigne(env, 0);
    await cliquer(env, boutonForm(env.page, 'Supprimer'), 'Supprimer');

    expect(confirmation()).not.toBeNull();
    expect(compact(confirmation()!.textContent)).toContain(compact('Supprimer ce leurre ?'));
    expect(boutonConfirmation('Supprimer')).toBeTruthy();
    expect(boutonConfirmation('Annuler')).toBeTruthy();
    expect(env.suppressions).toEqual([]);
    expect(lignes(env.page)).toHaveLength(2);
  });

  it('given la confirmation est affichée, when je touche « Supprimer », then le leurre disparaît de la liste, son document est supprimé et le formulaire se ferme', async () => {
    const env = await afficher({ initiaux: DEUX() });
    await toucherLigne(env, 0);
    await cliquer(env, boutonForm(env.page, 'Supprimer'), 'Supprimer');
    await cliquer(env, boutonConfirmation('Supprimer'), 'Supprimer (confirmation)');

    expect(env.suppressions).toEqual(['recent']);
    expect(dialogue(env.page)).toBeNull();
    const l = lignes(env.page);
    expect(l).toHaveLength(1);
    expect(compact(l[0].textContent)).toContain(compact('Cuillère tournante'));
  });

  it('given la confirmation est affichée sur le dernier leurre, when je touche « Supprimer », then « Ta boîte est vide. » s\'affiche', async () => {
    const env = await afficher({ initiaux: [doc('seul', 1000)] });
    await toucherLigne(env, 0);
    await cliquer(env, boutonForm(env.page, 'Supprimer'), 'Supprimer');
    await cliquer(env, boutonConfirmation('Supprimer'), 'Supprimer (confirmation)');
    expect(env.suppressions).toEqual(['seul']);
    expect(compact(env.page.textContent)).toContain(compact('Ta boîte est vide.'));
  });

  it('given la confirmation est affichée, when je touche « Annuler », then le leurre reste dans la liste, rien n\'est supprimé et le formulaire reste ouvert', async () => {
    const env = await afficher({ initiaux: DEUX() });
    await toucherLigne(env, 0);
    await cliquer(env, boutonForm(env.page, 'Supprimer'), 'Supprimer');
    await cliquer(env, boutonConfirmation('Annuler'), 'Annuler (confirmation)');

    expect(env.suppressions).toEqual([]);
    expect(confirmation()).toBeNull();
    expect(dialogue(env.page)).not.toBeNull();
    expect(lignes(env.page)).toHaveLength(2);
    expect(compact(lignes(env.page)[0].textContent)).toContain(compact('Shad'));
  });

  it('given je n\'ai pas de réseau, when je modifie un leurre, then la liste change tout de suite avec « Pas encore synchronisé : il le sera au retour du réseau. », mention qui disparaît au retour du réseau', async () => {
    const mention = compact('Pas encore synchronisé : il le sera au retour du réseau.');
    const env = await afficher({ initiaux: DEUX(), hors_ligne: true });
    await toucherLigne(env, 0);
    saisir(env.page, 'Taille (cm)', '12');
    await env.stabiliser();
    await cliquer(env, boutonForm(env.page, 'Enregistrer'), 'Enregistrer');

    const l = lignes(env.page);
    expect(compact(l[0].textContent)).toContain(compact('12 cm · 12 g · gardon'));
    expect(compact(l[0].textContent)).toContain(mention);
    expect(compact(l[1].textContent)).not.toContain(mention);
    expect(env.modifications).toHaveLength(1);

    env.synchroniser();
    await env.stabiliser();
    expect(compact(env.page.textContent)).not.toContain(mention);
    expect(compact(lignes(env.page)[0].textContent)).toContain(compact('12 cm'));
  });

  it('given je n\'ai pas de réseau, when je supprime un leurre, then il disparaît tout de suite de la liste et la suppression est envoyée à la source pour être synchronisée au retour du réseau', async () => {
    const env = await afficher({ initiaux: DEUX(), hors_ligne: true });
    await toucherLigne(env, 1);
    await cliquer(env, boutonForm(env.page, 'Supprimer'), 'Supprimer');
    await cliquer(env, boutonConfirmation('Supprimer'), 'Supprimer (confirmation)');

    expect(env.suppressions).toEqual(['vieux']);
    expect(lignes(env.page)).toHaveLength(1);
    expect(compact(env.page.textContent)).not.toContain(compact('Cuillère tournante'));
  });

  it('given l\'écriture est refusée, when j\'enregistre une modification, then le formulaire reste ouvert avec « Impossible d\'enregistrer le leurre. Réessaie. »', async () => {
    const env = await afficher({ initiaux: DEUX(), echec: 'modifier' });
    await toucherLigne(env, 0);
    saisir(env.page, 'Taille (cm)', '12');
    await env.stabiliser();
    await cliquer(env, boutonForm(env.page, 'Enregistrer'), 'Enregistrer');
    expect(dialogue(env.page)).not.toBeNull();
    const alertes = [...formulaire(env.page).querySelectorAll('[role="alert"]')].map((a) => compact(a.textContent));
    expect(alertes).toContain(compact('Impossible d\'enregistrer le leurre. Réessaie.'));
  });

  it('given la suppression est refusée, when je confirme « Supprimer », then le leurre reste et « Impossible de supprimer le leurre. Réessaie. » s\'affiche', async () => {
    const env = await afficher({ initiaux: DEUX(), echec: 'supprimer' });
    await toucherLigne(env, 0);
    await cliquer(env, boutonForm(env.page, 'Supprimer'), 'Supprimer');
    await cliquer(env, boutonConfirmation('Supprimer'), 'Supprimer (confirmation)');
    expect(lignes(env.page)).toHaveLength(2);
    expect(compact(document.body.textContent)).toContain(compact('Impossible de supprimer le leurre. Réessaie.'));
  });
});
