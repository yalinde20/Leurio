/*
 * US 102 : ajouter une photo à un leurre (PLAN §2.3, §4, §7).
 *
 * Contrat supposé :
 *  - SourceTackleBox gagne :
 *      envoyerPhoto(uid: string, photo: Blob): Promise<string>   // envoie vers Storage et rend l'URL de téléchargement
 *      supprimerPhoto(url: string): Promise<void>                // supprime le fichier de Storage
 *  - SaisieLeurre gagne `photo?: Blob | null` : `undefined` = garder la photo actuelle, `Blob` = nouvelle photo à envoyer,
 *    `null` = retirer la photo.
 *  - Leurre gagne `photoUrl?: string` (lu dans le document quand c'est un texte non vide).
 *  - ajouter / modifier envoient la photo (compressée par le service ou la page : le test ne dépend pas de l'endroit,
 *    Le canvas n'existe pas dans jsdom et `vi.mock` est interdit sur les imports relatifs : les photos des tests pèsent 1 Ko, et
 *    `compresserPhoto` de ./photo-leurre doit rendre telle quelle une photo déjà sous le seuil, sans canvas) AVANT d'écrire
 *    le document avec `photoUrl`. Échec d'envoi : le service rejette et rien n'est écrit.
 *  - modifier avec `photo: null` retire `photoUrl` et supprime l'ancien fichier ; remplacer une photo supprime l'ancien fichier.
 *  - supprimer(id) supprime le document puis, si le leurre avait une photo, son fichier.
 */
import { TestBed } from '@angular/core/testing';
import { DocumentLeurre, SOURCE_TACKLE_BOX, TackleBoxService } from './tackle-box.service';

const attendre = () => new Promise<void>((r) => setTimeout(r));
const URL_ANCIENNE = 'https://stockage.test/users/u1/lures/ancienne.jpg';
const URL_NOUVELLE = 'https://stockage.test/users/u1/lures/nouvelle.jpg';

interface Options {
  initiaux?: DocumentLeurre[];
  echecEnvoi?: boolean;
}

function creer(uid: string | null, { initiaux = [], echecEnvoi = false }: Options = {}) {
  const journal: string[] = [];
  const ajouts: { uid: string; data: Record<string, unknown> }[] = [];
  const modifications: { uid: string; id: string; data: Record<string, unknown> }[] = [];
  const suppressionsDocs: string[] = [];
  const envois: { uid: string; photo: Blob }[] = [];
  const suppressionsPhotos: string[] = [];
  let docs = [...initiaux];
  let rappel: ((d: DocumentLeurre[]) => void) | null = null;
  const source = {
    uid: async () => uid,
    ecouter: (_u: string, surChangement: (d: DocumentLeurre[]) => void) => {
      rappel = surChangement;
      surChangement([...docs]);
      return () => (rappel = null);
    },
    ajouter: async (u: string, data: Record<string, unknown>) => {
      journal.push('ajouter');
      ajouts.push({ uid: u, data });
    },
    modifier: async (u: string, id: string, data: Record<string, unknown>) => {
      journal.push('modifier');
      modifications.push({ uid: u, id, data });
    },
    supprimer: async (_u: string, id: string) => {
      journal.push('supprimer');
      suppressionsDocs.push(id);
      docs = docs.filter((d) => d.id !== id);
      rappel?.([...docs]);
    },
    envoyerPhoto: async (u: string, photo: Blob) => {
      journal.push('envoyerPhoto');
      envois.push({ uid: u, photo });
      if (echecEnvoi) throw new Error('réseau');
      return URL_NOUVELLE;
    },
    supprimerPhoto: async (url: string) => {
      journal.push('supprimerPhoto');
      suppressionsPhotos.push(url);
    },
  };
  TestBed.configureTestingModule({ providers: [{ provide: SOURCE_TACKLE_BOX, useValue: source }] });
  const service = TestBed.inject(TackleBoxService);
  // Champ `photo` de l'US 102 : typé en `unknown` pour que le test compile avant l'implémentation et échoue à l'exécution.
  const api = service as unknown as {
    ajouter(saisie: Record<string, unknown>): Promise<void>;
    modifier(id: string, saisie: Record<string, unknown>): Promise<void>;
    supprimer(id: string): Promise<void>;
  };
  return { service, api, journal, ajouts, modifications, suppressionsDocs, envois, suppressionsPhotos };
}

const base = { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', marque: 'Sakura' };
const valide = { ...base, createdAt: 1700000000000 };
const sansPhoto = (): DocumentLeurre[] => [{ id: 'a', data: valide, enAttente: false }];
const avecPhoto = (): DocumentLeurre[] => [{ id: 'a', data: { ...valide, photoUrl: URL_ANCIENNE }, enAttente: false }];
const photo = () => new Blob([new Uint8Array(1024)], { type: 'image/jpeg' });

describe('TackleBoxService : photo d\'un leurre (US 102)', () => {
  it('critère 2 : given une photo choisie, when j\'ajoute le leurre, then la photo est envoyée pour cet utilisateur avant l\'écriture et le document contient photoUrl', async () => {
    const t = creer('u1');
    await t.api.ajouter({ ...base, photo: photo() });
    expect(t.envois).toHaveLength(1);
    expect(t.envois[0].uid).toBe('u1');
    expect(t.envois[0].photo).toBeInstanceOf(Blob);
    expect(t.ajouts).toHaveLength(1);
    expect(t.ajouts[0].data['photoUrl']).toBe(URL_NOUVELLE);
    expect(t.journal).toEqual(['envoyerPhoto', 'ajouter']);
  });

  it('critère 2 : given aucune photo, when j\'ajoute le leurre, then rien n\'est envoyé et le document n\'a pas de photoUrl', async () => {
    const t = creer('u1');
    await t.api.ajouter({ ...base });
    expect(t.envois).toEqual([]);
    expect(t.ajouts).toHaveLength(1);
    expect(t.ajouts[0].data['photoUrl'] ?? '').toBe('');
  });

  it('critère 2 : given l\'envoi de la photo échoue, when j\'ajoute le leurre, then l\'ajout est rejeté et rien n\'est écrit', async () => {
    const t = creer('u1', { echecEnvoi: true });
    await expect(t.api.ajouter({ ...base, photo: photo() })).rejects.toThrow();
    expect(t.ajouts).toEqual([]);
    expect(t.journal).toEqual(['envoyerPhoto']);
  });

  it('critère 2 : given l\'envoi de la photo échoue, when je modifie le leurre, then la modification est rejetée, rien n\'est écrit et l\'ancienne photo est conservée', async () => {
    const t = creer('u1', { initiaux: avecPhoto(), echecEnvoi: true });
    await expect(t.api.modifier('a', { ...base, photo: photo() })).rejects.toThrow();
    expect(t.modifications).toEqual([]);
    expect(t.suppressionsPhotos).toEqual([]);
  });

  it('critère 2 : given un leurre sans photo, when j\'en choisis une en le modifiant, then elle est envoyée et le document reçoit photoUrl', async () => {
    const t = creer('u1', { initiaux: sansPhoto() });
    await t.api.modifier('a', { ...base, photo: photo() });
    expect(t.envois).toHaveLength(1);
    expect(t.modifications).toHaveLength(1);
    expect(t.modifications[0].data['photoUrl']).toBe(URL_NOUVELLE);
    expect(t.suppressionsPhotos).toEqual([]);
    expect(t.journal).toEqual(['envoyerPhoto', 'modifier']);
  });

  it('critère 5 : given un leurre avec photo, when je la remplace, then la nouvelle photo est enregistrée et l\'ancien fichier est supprimé du stockage', async () => {
    const t = creer('u1', { initiaux: avecPhoto() });
    await t.api.modifier('a', { ...base, photo: photo() });
    expect(t.modifications[0].data['photoUrl']).toBe(URL_NOUVELLE);
    expect(t.suppressionsPhotos).toEqual([URL_ANCIENNE]);
  });

  it('critère 5 : given un leurre avec photo, when je retire la photo (photo: null), then photoUrl n\'est plus écrit avec l\'ancienne URL et l\'ancien fichier est supprimé', async () => {
    const t = creer('u1', { initiaux: avecPhoto() });
    await t.api.modifier('a', { ...base, photo: null });
    expect(t.envois).toEqual([]);
    expect(t.modifications).toHaveLength(1);
    expect(t.modifications[0].data).toHaveProperty('photoUrl');
    expect(t.modifications[0].data['photoUrl']).not.toBe(URL_ANCIENNE);
    expect(t.suppressionsPhotos).toEqual([URL_ANCIENNE]);
  });

  it('critère 5 : given un leurre avec photo, when je le modifie sans toucher à la photo, then photoUrl n\'est pas écrit et le fichier reste', async () => {
    const t = creer('u1', { initiaux: avecPhoto() });
    await t.api.modifier('a', { ...base, tailleCm: 12 });
    expect(t.envois).toEqual([]);
    expect(t.modifications).toHaveLength(1);
    expect(t.modifications[0].data).not.toHaveProperty('photoUrl');
    expect(t.suppressionsPhotos).toEqual([]);
  });

  it('critère 5 : given un leurre avec photo, when je le supprime, then son document est supprimé et sa photo aussi du stockage', async () => {
    const t = creer('u1', { initiaux: avecPhoto() });
    await attendre();
    await t.api.supprimer('a');
    expect(t.suppressionsDocs).toEqual(['a']);
    expect(t.suppressionsPhotos).toEqual([URL_ANCIENNE]);
  });

  it('critère 5 : given un leurre sans photo, when je le supprime, then aucune suppression de fichier n\'est demandée', async () => {
    const t = creer('u1', { initiaux: sansPhoto() });
    await attendre();
    await t.api.supprimer('a');
    expect(t.suppressionsDocs).toEqual(['a']);
    expect(t.suppressionsPhotos).toEqual([]);
  });

  it('critère 2 : given un document avec photoUrl, when je lis la liste, then le leurre porte photoUrl ; sans photoUrl ou avec une valeur vide ou non texte, il n\'en a pas', async () => {
    const t = creer('u1', {
      initiaux: [
        { id: 'avec', data: { ...valide, createdAt: 4, photoUrl: URL_ANCIENNE }, enAttente: false },
        { id: 'sans', data: { ...valide, createdAt: 3 }, enAttente: false },
        { id: 'vide', data: { ...valide, createdAt: 2, photoUrl: '' }, enAttente: false },
        { id: 'faux', data: { ...valide, createdAt: 1, photoUrl: 42 }, enAttente: false },
      ],
    });
    await attendre();
    const l = t.service.leurres()! as unknown as (Record<string, unknown> & { id: string })[];
    expect(l.map((x) => x.id)).toEqual(['avec', 'sans', 'vide', 'faux']);
    expect(l[0]['photoUrl']).toBe(URL_ANCIENNE);
    expect(l[1]['photoUrl']).toBeUndefined();
    expect(l[2]['photoUrl']).toBeUndefined();
    expect(l[3]['photoUrl']).toBeUndefined();
  });

  it('given aucun utilisateur connecté, when j\'ajoute un leurre avec photo, then rien n\'est envoyé ni écrit', async () => {
    const t = creer(null);
    await expect(t.api.ajouter({ ...base, photo: photo() })).rejects.toThrow();
    expect(t.envois).toEqual([]);
    expect(t.ajouts).toEqual([]);
  });
});
