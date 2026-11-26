/*
 * US 288 : ne pas proposer de photo de leurre quand le stockage n'est pas disponible (forfait Spark, pas de Cloud Storage).
 * Maquette : docs/maquettes/us-288-pas-de-photo-sans-stockage.html. PLAN §4, §7.
 *
 * Contrat : le formulaire (`[role="dialog"]`) de la Boîte lit `FEATURE_FLAGS.estActif('photosLeurres')`.
 *  - flag désactivé : ni « Photo (facultatif) », ni « Ajouter une photo », ni « Changer la photo » ; une photo déjà enregistrée
 *    reste affichée avec « Retirer la photo ». Enregistrer fonctionne sans photo (aucun envoi).
 *  - flag activé : parcours de l'US 102 inchangé (boite.page.photo.spec.ts).
 * Le flag est fourni par un double de FEATURE_FLAGS ; « par défaut » = aucun double, le vrai jeton (inerte hors production)
 * rend la valeur par défaut de FLAGS (désactivé, comme Remote Config injoignable).
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { SOURCE_PHOTO } from '../../core/data/photo-leurre';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { FEATURE_FLAGS, PortFeatureFlags } from '../../core/firebase/feature-flags';
import { BoitePage } from './boite.page';

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s     ]/g, '');
const attendre = () => new Promise<void>((r) => setTimeout(r));
const URL_PHOTO = 'https://stockage.test/users/u1/lures/existante.jpg';
const flags = (photosLeurres: boolean): PortFeatureFlags => ({ initialiser: async () => undefined, estActif: (nom) => nom === 'photosLeurres' && photosLeurres });

const SANS_PHOTO: DocumentLeurre = { id: 'a', enAttente: false, data: { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', createdAt: 1 } };
const AVEC_PHOTO: DocumentLeurre = { id: 'b', enAttente: false, data: { typeId: 'shad', tailleCm: 8, poidsG: 9, couleur: 'perche', createdAt: 2, photoUrl: URL_PHOTO } };

/** `flag` : true/false = double de FEATURE_FLAGS ; undefined = aucun double (valeur par défaut réelle). */
async function afficher(flag: boolean | undefined, initiaux: DocumentLeurre[] = []) {
  const ecritures: Record<string, unknown>[] = [];
  const modifications: Record<string, unknown>[] = [];
  const envois: Blob[] = [];
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => (ok([...initiaux]), () => undefined),
    ajouter: async (_u: string, data: Record<string, unknown>) => void ecritures.push(data),
    modifier: async (_u: string, _id: string, data: Record<string, unknown>) => void modifications.push(data),
    supprimer: async () => undefined,
    envoyerPhoto: async (_u: string, photo: Blob) => (envois.push(photo), 'https://stockage.test/n.jpg'),
    supprimerPhoto: async () => undefined,
  };
  const providers: unknown[] = [
    provideIonicAngular(),
    { provide: SOURCE_TACKLE_BOX, useValue: source },
    { provide: SOURCE_PHOTO, useValue: { enLigne: () => true, choisir: async () => new Blob([new Uint8Array(1024)], { type: 'image/jpeg' }) } },
    { provide: CatalogService, useValue: { typesDeLeurres: async () => [{ id: 'shad', nom: 'Shad' }] as TypeLeurre[] } },
  ];
  if (flag !== undefined) providers.push({ provide: FEATURE_FLAGS, useValue: flags(flag) });
  await TestBed.configureTestingModule({ imports: [BoitePage], providers: providers as never }).compileComponents();
  if (typeof URL.createObjectURL !== 'function') Object.assign(URL, { createObjectURL: () => 'blob:aperçu', revokeObjectURL: () => undefined });
  const fixture = TestBed.createComponent(BoitePage);
  const page = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await attendre();
    }
  };
  await stabiliser();
  return { page, stabiliser, ecritures, modifications, envois };
}
type Env = Awaited<ReturnType<typeof afficher>>;

const boutons = (racine: ParentNode) => [...racine.querySelectorAll<HTMLElement>('button, ion-button')];
const boutonDans = (racine: ParentNode, texte: string) => boutons(racine).find((b) => compact(b.textContent) === compact(texte));
const formulaire = (page: HTMLElement): HTMLElement => {
  const f = [...page.querySelectorAll<HTMLElement>('[role="dialog"]')].find((d) => d.querySelector('input, select'));
  if (!f) throw new Error('Le formulaire ([role="dialog"]) n\'est pas ouvert');
  return f;
};
async function cliquer(env: Env, b: HTMLElement | undefined, nom: string): Promise<void> {
  if (!b) throw new Error(`Aucun bouton « ${nom} »`);
  b.click();
  await env.stabiliser();
}
const ouvrirAjout = (env: Env) =>
  cliquer(env, boutons(env.page).find((x) => !x.closest('[role="dialog"]') && compact(x.textContent) === compact('Ajouter un leurre')), 'Ajouter un leurre');
/** Ouvre le formulaire de modification du leurre dont la ligne contient `texte` (ex. « 10 cm »). */
async function ouvrirModification(env: Env, id: 'a' | 'b'): Promise<void> {
  const lignes = [...env.page.querySelectorAll<HTMLElement>('li')];
  const ligne = lignes[id === 'a' ? 0 : lignes.length - 1];
  const cible = ligne.querySelector<HTMLElement>('button') ?? ligne;
  await cliquer(env, cible, 'ligne du leurre');
}
function saisir(page: HTMLElement, libelle: string, valeur: string): void {
  const f = formulaire(page);
  const c = [...f.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')].find((x) => {
    const parLabel = x.id ? f.querySelector(`label[for="${x.id}"]`) : null;
    return compact(x.getAttribute('aria-label') ?? parLabel?.textContent ?? x.closest('label')?.textContent ?? '').startsWith(compact(libelle));
  });
  if (!c) throw new Error(`Aucun champ « ${libelle} »`);
  c.value = valeur;
  c.dispatchEvent(new Event('input', { bubbles: true }));
  c.dispatchEvent(new Event('change', { bubbles: true }));
}
const aucuneActionPhoto = (page: HTMLElement) => {
  const f = formulaire(page);
  const texte = compact(f.textContent);
  expect(boutonDans(f, 'Ajouter une photo')).toBeUndefined();
  expect(boutonDans(f, 'Changer la photo')).toBeUndefined();
  expect(texte).not.toContain(compact('Photo (facultatif)'));
  expect(texte).not.toContain(compact('Ajouter une photo'));
};

describe('BoitePage : photo de leurre sans stockage (US 288)', () => {
  for (const [nom, flag] of [['désactivé (double)', false], ['par défaut (aucun double, Remote Config injoignable)', undefined]] as const) {
    it(`critère 1 : given le flag photosLeurres est ${nom}, when j'ouvre le formulaire d'ajout, then ni « Photo (facultatif) » ni « Ajouter une photo » ne sont affichés`, async () => {
      const env = await afficher(flag);
      await ouvrirAjout(env);
      aucuneActionPhoto(env.page);
    });
  }

  it('critère 1 : given le flag est désactivé, when je remplis le formulaire d\'ajout et touche « Enregistrer », then le leurre est enregistré sans photo et rien n\'est envoyé', async () => {
    const env = await afficher(false);
    await ouvrirAjout(env);
    aucuneActionPhoto(env.page);
    saisir(env.page, 'Type', 'shad');
    saisir(env.page, 'Taille (cm)', '10');
    saisir(env.page, 'Poids (g)', '12');
    saisir(env.page, 'Couleur', 'gardon');
    await env.stabiliser();
    await cliquer(env, boutonDans(formulaire(env.page), 'Enregistrer'), 'Enregistrer');
    expect(env.ecritures).toHaveLength(1);
    expect(env.ecritures[0]).toMatchObject({ typeId: 'shad', couleur: 'gardon' });
    expect(env.ecritures[0]['photoUrl'] ?? null).toBeNull();
    expect(env.envois).toEqual([]);
  });

  it('critère 2 : given le flag est désactivé et un leurre sans photo, when j\'ouvre son formulaire de modification, then aucune action pour ajouter ou remplacer une photo n\'est proposée, « Enregistrer » et « Supprimer » restent', async () => {
    const env = await afficher(false, [SANS_PHOTO]);
    await ouvrirModification(env, 'a');
    expect(compact(formulaire(env.page).textContent)).toContain(compact('Modifier le leurre'));
    aucuneActionPhoto(env.page);
    expect(boutonDans(formulaire(env.page), 'Enregistrer')).toBeTruthy();
    expect(boutonDans(formulaire(env.page), 'Supprimer')).toBeTruthy();
  });

  it('critère 2 : given le flag est par défaut (aucun double) et un leurre sans photo, when j\'ouvre son formulaire de modification, then aucune action photo n\'est proposée', async () => {
    const env = await afficher(undefined, [SANS_PHOTO]);
    await ouvrirModification(env, 'a');
    aucuneActionPhoto(env.page);
  });

  it('critère 2 (maquette, état 3) : given le flag est désactivé et un leurre avec photo, when j\'ouvre son formulaire, then la photo est affichée, « Changer la photo » est absent et « Retirer la photo » est présent', async () => {
    const env = await afficher(false, [AVEC_PHOTO]);
    await ouvrirModification(env, 'b');
    const f = formulaire(env.page);
    expect(f.querySelector('img[alt="Photo du leurre"]')?.getAttribute('src')).toBe(URL_PHOTO);
    expect(boutonDans(f, 'Changer la photo')).toBeUndefined();
    expect(boutonDans(f, 'Ajouter une photo')).toBeUndefined();
    expect(boutonDans(f, 'Retirer la photo')).toBeTruthy();
  });

  it('critère 3 : given le flag est activé, when j\'ouvre le formulaire d\'ajout, then « Photo (facultatif) » et « Ajouter une photo » sont affichés et touchés ils ouvrent le choix appareil photo / galerie', async () => {
    const env = await afficher(true);
    await ouvrirAjout(env);
    const f = formulaire(env.page);
    expect(compact(f.textContent)).toContain(compact('Photo (facultatif)'));
    await cliquer(env, boutonDans(f, 'Ajouter une photo'), 'Ajouter une photo');
    expect(boutonDans(document.body, 'Prendre une photo')).toBeTruthy();
    expect(boutonDans(document.body, 'Choisir dans la galerie')).toBeTruthy();
  });

  it('critère 3 : given le flag est activé, when j\'ouvre la modification d\'un leurre sans photo, then « Ajouter une photo » est affiché', async () => {
    const env = await afficher(true, [SANS_PHOTO]);
    await ouvrirModification(env, 'a');
    expect(boutonDans(formulaire(env.page), 'Ajouter une photo')).toBeTruthy();
  });

  it('critère 3 : given le flag est activé, when j\'ouvre la modification d\'un leurre avec photo, then l\'aperçu montre « Changer la photo » et « Retirer la photo »', async () => {
    const env = await afficher(true, [AVEC_PHOTO]);
    await ouvrirModification(env, 'b');
    const f = formulaire(env.page);
    expect(f.querySelector('img[alt="Photo du leurre"]')?.getAttribute('src')).toBe(URL_PHOTO);
    expect(boutonDans(f, 'Changer la photo')).toBeTruthy();
    expect(boutonDans(f, 'Retirer la photo')).toBeTruthy();
  });
});
