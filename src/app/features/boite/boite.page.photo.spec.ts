/*
 * US 102 : ajouter une photo à un leurre. Maquette : docs/maquettes/us-102-photo-leurre.html (référence de tous les textes).
 * Contrat du formulaire et de la liste : voir boite.page.ajout.spec.ts et boite.page.modification.spec.ts.
 *
 * Contrat ajouté par l'US 102 :
 *  - src/app/core/data/photo-leurre.ts exporte `OriginePhoto` ('camera' | 'galerie'), `AccesPhotoRefuse` (Error lancée quand
 *    l'utilisateur refuse l'accès), `SourcePhoto { choisir(origine): Promise<Blob | null>; enLigne(): boolean }` (null = annulé),
 *    le jeton `SOURCE_PHOTO` et `compresserPhoto(photo, maxOctets)`. Les tests fournissent un double de SOURCE_PHOTO.
 *    `vi.mock` est interdit sur les imports relatifs : les photos des tests pèsent 1 Ko et `compresserPhoto` doit rendre telle
 *    quelle une photo déjà sous le seuil (sans canvas, absent de jsdom).
 *  - SourceTackleBox gagne `envoyerPhoto(uid, photo): Promise<string>` (URL) et `supprimerPhoto(url): Promise<void>`.
 *  - Formulaire (`[role="dialog"]`) : sous « Marque (facultatif) », un `button` « Ajouter une photo ». Au toucher : une feuille
 *    (`[role="dialog"]` ou `[role="menu"]`) titrée « Photo du leurre » avec les `button` « Prendre une photo »,
 *    « Choisir dans la galerie » et « Annuler ». Photo choisie : une `img` alt « Photo du leurre » remplace le bouton, avec les
 *    `button` « Changer la photo » et « Retirer la photo ». Rien n'est envoyé avant « Enregistrer ». Pendant l'envoi, « Enregistrer »
 *    est désactivé et se lit « Envoi de la photo… ».
 *  - Liste : un leurre qui a `photoUrl` montre une `img` alt « Photo du leurre », `src` = photoUrl, dans son `li` ; sans photo, aucune `img`.
 *  - Messages `[role="alert"]` : « Accès à l'appareil photo refusé. », « Photo indisponible hors ligne : ajoute-la plus tard. »,
 *    « Impossible d'envoyer la photo. Réessaie. » (le formulaire reste ouvert, rien n'est écrit).
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { AccesPhotoRefuse, OriginePhoto, SOURCE_PHOTO } from '../../core/data/photo-leurre';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { FEATURE_FLAGS } from '../../core/firebase/feature-flags';
import { BoitePage } from './boite.page';

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'jig', nom: 'Jig à jupe' },
] as TypeLeurre[];

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s     ]/g, '');
const attendre = () => new Promise<void>((r) => setTimeout(r));
const URL_ANCIENNE = 'https://stockage.test/users/u1/lures/ancienne.jpg';
const URL_NOUVELLE = 'https://stockage.test/users/u1/lures/nouvelle.jpg';

interface Options {
  initiaux?: DocumentLeurre[];
  enLigne?: boolean;
  choix?: 'photo' | 'annule' | 'refuse';
  echecEnvoi?: boolean;
  /** Si fourni, l'envoi attend cette promesse (pour observer l'état « Envoi de la photo… »). */
  envoiBloque?: Promise<void>;
}

async function afficher({ initiaux = [], enLigne = true, choix = 'photo', echecEnvoi = false, envoiBloque }: Options = {}) {
  const ecritures: Record<string, unknown>[] = [];
  const modifications: { id: string; data: Record<string, unknown> }[] = [];
  const envois: { uid: string; photo: Blob }[] = [];
  const suppressionsPhotos: string[] = [];
  const origines: OriginePhoto[] = [];
  let docs: DocumentLeurre[] = [...initiaux];
  let rappel: ((d: DocumentLeurre[]) => void) | null = null;
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => {
      rappel = ok;
      ok([...docs]);
      return () => undefined;
    },
    ajouter: async (_u: string, data: Record<string, unknown>) => {
      ecritures.push(data);
      docs = [...docs, { id: `n${docs.length}`, data, enAttente: false }];
      rappel?.([...docs]);
    },
    modifier: async (_u: string, id: string, data: Record<string, unknown>) => {
      modifications.push({ id, data });
      docs = docs.map((d) => (d.id === id ? { ...d, data: { ...(d.data as object), ...data } } : d));
      rappel?.([...docs]);
    },
    supprimer: async () => undefined,
    envoyerPhoto: async (uid: string, photo: Blob) => {
      envois.push({ uid, photo });
      await envoiBloque;
      if (echecEnvoi) throw new Error('réseau');
      return URL_NOUVELLE;
    },
    supprimerPhoto: async (url: string) => {
      suppressionsPhotos.push(url);
    },
  };
  const sourcePhoto = {
    enLigne: () => enLigne,
    choisir: async (origine: OriginePhoto): Promise<Blob | null> => {
      origines.push(origine);
      if (choix === 'refuse') throw new AccesPhotoRefuse();
      if (choix === 'annule') return null;
      return new Blob([new Uint8Array(1024)], { type: 'image/jpeg' });
    },
  };
  await TestBed.configureTestingModule({
    imports: [BoitePage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: source },
      { provide: SOURCE_PHOTO, useValue: sourcePhoto },
      { provide: CatalogService, useValue: { typesDeLeurres: async () => TYPES } },
      { provide: FEATURE_FLAGS, useValue: { initialiser: async () => undefined, estActif: (n: string) => n === 'photosLeurres' } },
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
  return { page: fixture.nativeElement as HTMLElement, stabiliser, ecritures, modifications, envois, suppressionsPhotos, origines };
}
type Env = Awaited<ReturnType<typeof afficher>>;

const boutons = (racine: ParentNode) => [...racine.querySelectorAll<HTMLElement>('button, ion-button')];
const lignes = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('li')];

/** Le formulaire : le `[role="dialog"]` qui contient le champ « Couleur » (la feuille de choix de photo n'en contient pas). */
function formulaire(page: HTMLElement): HTMLElement {
  const f = [...page.querySelectorAll<HTMLElement>('[role="dialog"]')].find((d) => d.querySelector('input, select'));
  if (!f) throw new Error('Le formulaire ([role="dialog"]) n\'est pas ouvert');
  return f;
}
const boutonDans = (racine: ParentNode, texte: string) => boutons(racine).find((b) => compact(b.textContent) === compact(texte));
const boutonForm = (page: HTMLElement, texte: string) => boutonDans(formulaire(page), texte);

/** La feuille de choix : un `[role="dialog"]` ou `[role="menu"]` (n'importe où dans le document) qui propose « Prendre une photo ». */
const feuille = () =>
  [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="menu"]')].find((e) => boutonDans(e, 'Prendre une photo') && !e.querySelector('input, select')) ?? null;

function controle(page: HTMLElement, libelle: string): HTMLInputElement | HTMLSelectElement {
  const f = formulaire(page);
  const trouve = [...f.querySelectorAll<HTMLElement>('input, select')].find((c) => {
    const parLabel = c.id ? f.querySelector(`label[for="${c.id}"]`) : null;
    const texte = c.getAttribute('aria-label') ?? parLabel?.textContent ?? c.closest('label')?.textContent ?? '';
    return compact(texte).startsWith(compact(libelle));
  });
  if (!trouve) throw new Error(`Aucun champ libellé « ${libelle} » dans le formulaire`);
  return trouve as HTMLInputElement | HTMLSelectElement;
}
function saisir(page: HTMLElement, libelle: string, valeur: string): void {
  const c = controle(page, libelle);
  c.value = valeur;
  c.dispatchEvent(new Event('input', { bubbles: true }));
  c.dispatchEvent(new Event('change', { bubbles: true }));
}
async function cliquer(env: Env, b: HTMLElement | undefined, nom: string): Promise<void> {
  if (!b) throw new Error(`Aucun bouton « ${nom} »`);
  b.click();
  await env.stabiliser();
}
async function ouvrirAjout(env: Env): Promise<void> {
  const b = boutons(env.page).find((x) => !x.closest('[role="dialog"]') && compact(x.textContent) === compact('Ajouter un leurre'));
  await cliquer(env, b, 'Ajouter un leurre');
}
async function remplir(env: Env): Promise<void> {
  saisir(env.page, 'Type', 'shad');
  saisir(env.page, 'Taille (cm)', '10');
  saisir(env.page, 'Poids (g)', '12');
  saisir(env.page, 'Couleur', 'gardon');
  await env.stabiliser();
}
/** Ouvre le choix puis touche l'option donnée. */
async function choisirPhoto(env: Env, option: 'Prendre une photo' | 'Choisir dans la galerie'): Promise<void> {
  await cliquer(env, boutonForm(env.page, 'Ajouter une photo'), 'Ajouter une photo');
  const f = feuille();
  if (!f) throw new Error('La feuille « Photo du leurre » ne s\'affiche pas');
  await cliquer(env, boutonDans(f, option), option);
}
const alertes = (page: HTMLElement) => [...page.querySelectorAll('[role="alert"]')].map((a) => compact(a.textContent));
const apercu = (page: HTMLElement) => formulaire(page).querySelector<HTMLImageElement>('img[alt="Photo du leurre"]');
const doc = (id: string, createdAt: number, extra: Record<string, unknown> = {}): DocumentLeurre => ({
  id,
  enAttente: false,
  data: { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', marque: 'Sakura', createdAt, ...extra },
});

beforeEach(() => {
  // jsdom ne fournit pas les URL d'objet : l'aperçu en a besoin.
  if (typeof URL.createObjectURL !== 'function') {
    Object.assign(URL, { createObjectURL: () => 'blob:aperçu', revokeObjectURL: () => undefined });
  }
});
afterEach(() => document.querySelectorAll('ion-alert, ion-action-sheet').forEach((a) => a.remove()));

describe('BoitePage : photo d\'un leurre (US 102)', () => {
  it('critère 1 : given le formulaire d\'un leurre est ouvert, when je touche « Ajouter une photo », then je peux prendre une photo ou en choisir une dans la galerie (ou annuler)', async () => {
    const env = await afficher();
    await ouvrirAjout(env);
    expect(compact(formulaire(env.page).textContent)).toContain(compact('Photo (facultatif)'));
    expect(feuille()).toBeNull();

    await cliquer(env, boutonForm(env.page, 'Ajouter une photo'), 'Ajouter une photo');
    const f = feuille();
    expect(f).not.toBeNull();
    expect(compact(f!.textContent)).toContain(compact('Photo du leurre'));
    expect(boutonDans(f!, 'Prendre une photo')).toBeTruthy();
    expect(boutonDans(f!, 'Choisir dans la galerie')).toBeTruthy();
    expect(boutonDans(f!, 'Annuler')).toBeTruthy();
  });

  it('critère 1 : given la feuille de choix est ouverte, when je touche « Prendre une photo », then l\'appareil photo est demandé et un aperçu avec « Changer la photo » et « Retirer la photo » remplace le bouton', async () => {
    const env = await afficher();
    await ouvrirAjout(env);
    await choisirPhoto(env, 'Prendre une photo');
    expect(env.origines).toEqual(['camera']);
    expect(apercu(env.page)).not.toBeNull();
    expect(boutonForm(env.page, 'Changer la photo')).toBeTruthy();
    expect(boutonForm(env.page, 'Retirer la photo')).toBeTruthy();
    expect(boutonForm(env.page, 'Ajouter une photo')).toBeUndefined();
    expect(env.envois).toEqual([]);
  });

  it('critère 1 : given la feuille de choix est ouverte, when je touche « Choisir dans la galerie », then la galerie est demandée et l\'aperçu s\'affiche', async () => {
    const env = await afficher();
    await ouvrirAjout(env);
    await choisirPhoto(env, 'Choisir dans la galerie');
    expect(env.origines).toEqual(['galerie']);
    expect(apercu(env.page)).not.toBeNull();
    expect(env.envois).toEqual([]);
  });

  it('critère 1 : given la feuille de choix est ouverte, when je touche « Annuler », then elle se ferme sans photo ni envoi', async () => {
    const env = await afficher();
    await ouvrirAjout(env);
    await cliquer(env, boutonForm(env.page, 'Ajouter une photo'), 'Ajouter une photo');
    await cliquer(env, boutonDans(feuille()!, 'Annuler'), 'Annuler (feuille)');
    expect(feuille()).toBeNull();
    expect(env.origines).toEqual([]);
    expect(apercu(env.page)).toBeNull();
    expect(boutonForm(env.page, 'Ajouter une photo')).toBeTruthy();
  });

  it('critère 1 : given une photo choisie, when je touche « Retirer la photo », then le bouton « Ajouter une photo » revient', async () => {
    const env = await afficher();
    await ouvrirAjout(env);
    await choisirPhoto(env, 'Choisir dans la galerie');
    await cliquer(env, boutonForm(env.page, 'Retirer la photo'), 'Retirer la photo');
    expect(apercu(env.page)).toBeNull();
    expect(boutonForm(env.page, 'Ajouter une photo')).toBeTruthy();
  });

  it('critère 2 : given j\'ai choisi une photo et enregistré le leurre, when la liste s\'affiche, then la photo apparaît en vignette sur le leurre et son document contient photoUrl', async () => {
    const env = await afficher();
    await ouvrirAjout(env);
    await remplir(env);
    await choisirPhoto(env, 'Choisir dans la galerie');
    expect(env.envois).toEqual([]);
    await cliquer(env, boutonForm(env.page, 'Enregistrer'), 'Enregistrer');

    expect(env.envois).toHaveLength(1);
    expect(env.envois[0].uid).toBe('u1');
    expect(env.ecritures).toHaveLength(1);
    expect(env.ecritures[0]['photoUrl']).toBe(URL_NOUVELLE);
    const l = lignes(env.page);
    expect(l).toHaveLength(1);
    const vignette = l[0].querySelector<HTMLImageElement>('img[alt="Photo du leurre"]');
    expect(vignette).not.toBeNull();
    expect(vignette!.getAttribute('src')).toBe(URL_NOUVELLE);
  });

  it('critère 2 : given un leurre sans photo et un autre avec, when la liste s\'affiche, then seul celui qui a photoUrl montre une vignette', async () => {
    const env = await afficher({ initiaux: [doc('avec', 2000, { photoUrl: URL_ANCIENNE }), doc('sans', 1000)] });
    const l = lignes(env.page);
    expect(l).toHaveLength(2);
    expect(l[0].querySelector('img')?.getAttribute('src')).toBe(URL_ANCIENNE);
    expect(l[0].querySelector('img')?.getAttribute('alt')).toBe('Photo du leurre');
    expect(l[1].querySelector('img')).toBeNull();
  });

  it('critère 2 : given j\'enregistre un leurre avec une photo, when l\'envoi est en cours, then « Enregistrer » est désactivé et se lit « Envoi de la photo… », puis le leurre est écrit', async () => {
    let debloquer!: () => void;
    const envoiBloque = new Promise<void>((r) => (debloquer = r));
    const env = await afficher({ envoiBloque });
    await ouvrirAjout(env);
    await remplir(env);
    await choisirPhoto(env, 'Prendre une photo');
    await cliquer(env, boutonForm(env.page, 'Enregistrer'), 'Enregistrer');

    const envoi = boutonForm(env.page, 'Envoi de la photo…') as HTMLButtonElement | undefined;
    expect(envoi).toBeTruthy();
    expect(envoi!.disabled || envoi!.getAttribute('aria-disabled') === 'true').toBe(true);
    expect(env.ecritures).toEqual([]);

    debloquer();
    await env.stabiliser();
    expect(env.ecritures).toHaveLength(1);
    expect(env.ecritures[0]['photoUrl']).toBe(URL_NOUVELLE);
  });

  it('critère 2 : given l\'envoi de la photo échoue, when j\'enregistre, then le formulaire reste ouvert avec la photo et « Impossible d\'envoyer la photo. Réessaie. », et rien n\'est écrit', async () => {
    const env = await afficher({ echecEnvoi: true });
    await ouvrirAjout(env);
    await remplir(env);
    await choisirPhoto(env, 'Choisir dans la galerie');
    await cliquer(env, boutonForm(env.page, 'Enregistrer'), 'Enregistrer');

    expect(env.ecritures).toEqual([]);
    expect(alertes(env.page)).toContain(compact('Impossible d\'envoyer la photo. Réessaie.'));
    expect(apercu(env.page)).not.toBeNull();
    expect(boutonForm(env.page, 'Enregistrer')).toBeTruthy();
  });

  it('critère 2 : given un leurre avec photo, when j\'ouvre son formulaire, then la photo actuelle s\'affiche avec « Changer la photo » et « Retirer la photo »', async () => {
    const env = await afficher({ initiaux: [doc('a', 1000, { photoUrl: URL_ANCIENNE })] });
    await cliquer(env, lignes(env.page)[0].querySelector<HTMLElement>('button')!, 'ligne');
    expect(apercu(env.page)?.getAttribute('src')).toBe(URL_ANCIENNE);
    expect(boutonForm(env.page, 'Changer la photo')).toBeTruthy();
    expect(boutonForm(env.page, 'Retirer la photo')).toBeTruthy();
    expect(boutonForm(env.page, 'Ajouter une photo')).toBeUndefined();
  });

  it('critère 5 : given un leurre avec photo, when je retire la photo et j\'enregistre, then l\'ancien fichier est supprimé du stockage et la liste n\'a plus de vignette', async () => {
    const env = await afficher({ initiaux: [doc('a', 1000, { photoUrl: URL_ANCIENNE })] });
    await cliquer(env, lignes(env.page)[0].querySelector<HTMLElement>('button')!, 'ligne');
    await cliquer(env, boutonForm(env.page, 'Retirer la photo'), 'Retirer la photo');
    await cliquer(env, boutonForm(env.page, 'Enregistrer'), 'Enregistrer');

    expect(env.suppressionsPhotos).toEqual([URL_ANCIENNE]);
    expect(env.modifications).toHaveLength(1);
    expect(env.modifications[0].data['photoUrl']).not.toBe(URL_ANCIENNE);
    expect(lignes(env.page)[0].querySelector('img')).toBeNull();
  });

  it('critère 4 : given j\'ai refusé l\'accès à l\'appareil photo, when je touche « Ajouter une photo » puis « Prendre une photo », then « Accès à l\'appareil photo refusé. » s\'affiche et je peux enregistrer le leurre sans photo', async () => {
    const env = await afficher({ choix: 'refuse' });
    await ouvrirAjout(env);
    await remplir(env);
    await choisirPhoto(env, 'Prendre une photo');

    expect(env.origines).toEqual(['camera']);
    expect(alertes(env.page)).toContain(compact('Accès à l\'appareil photo refusé.'));
    expect(apercu(env.page)).toBeNull();
    expect(boutonForm(env.page, 'Ajouter une photo')).toBeTruthy();

    await cliquer(env, boutonForm(env.page, 'Enregistrer'), 'Enregistrer');
    expect(env.envois).toEqual([]);
    expect(env.ecritures).toHaveLength(1);
    expect(env.ecritures[0]['photoUrl'] ?? '').toBe('');
    expect(lignes(env.page)).toHaveLength(1);
    expect(lignes(env.page)[0].querySelector('img')).toBeNull();
  });

  it('given je suis hors ligne, when je touche « Ajouter une photo », then « Photo indisponible hors ligne : ajoute-la plus tard. » remplace le choix et le leurre reste enregistrable', async () => {
    const env = await afficher({ enLigne: false });
    await ouvrirAjout(env);
    await remplir(env);
    await cliquer(env, boutonForm(env.page, 'Ajouter une photo'), 'Ajouter une photo');

    expect(alertes(env.page)).toContain(compact('Photo indisponible hors ligne : ajoute-la plus tard.'));
    expect(feuille()).toBeNull();
    expect(env.origines).toEqual([]);

    await cliquer(env, boutonForm(env.page, 'Enregistrer'), 'Enregistrer');
    expect(env.envois).toEqual([]);
    expect(env.ecritures).toHaveLength(1);
  });
});
