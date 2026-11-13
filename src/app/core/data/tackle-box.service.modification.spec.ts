/*
 * US 101 : modifier ou supprimer un leurre (PLAN §2.3, §4, §7).
 *
 * Contrat supposé (src/app/core/data/tackle-box.service.ts) :
 *  - SourceTackleBox gagne :
 *      modifier(uid, id, data: Record<string, unknown>): Promise<void>   // met à jour les champs donnés ; résout à l'écriture LOCALE
 *      supprimer(uid, id): Promise<void>                                  // supprime le document ; résout à l'écriture LOCALE
 *  - TackleBoxService gagne :
 *      modifier(id: string, saisie: SaisieLeurre): Promise<void>   // écrit typeId, tailleCm, poidsG, couleur, marque (rognées, '' si absente), jamais createdAt
 *      supprimer(id: string): Promise<void>
 *    Sans utilisateur connecté (uid null), les deux rejettent et n'écrivent rien.
 */
import { TestBed } from '@angular/core/testing';
import { DocumentLeurre, SOURCE_TACKLE_BOX, TackleBoxService } from './tackle-box.service';

const attendre = () => new Promise<void>((r) => setTimeout(r));

interface Modification { uid: string; id: string; data: Record<string, unknown> }

function creer(uid: string | null, initiaux: DocumentLeurre[] = []) {
  const modifications: Modification[] = [];
  const suppressions: { uid: string; id: string }[] = [];
  let docs = [...initiaux];
  let rappel: ((d: DocumentLeurre[]) => void) | null = null;
  const source = {
    uid: async () => uid,
    ecouter: (_u: string, surChangement: (d: DocumentLeurre[]) => void) => {
      rappel = surChangement;
      surChangement([...docs]);
      return () => (rappel = null);
    },
    ajouter: async () => undefined,
    modifier: async (u: string, id: string, data: Record<string, unknown>) => {
      modifications.push({ uid: u, id, data });
      docs = docs.map((d) => (d.id === id ? { id, data: { ...(d.data as object), ...data }, enAttente: true } : d));
      rappel?.([...docs]);
    },
    supprimer: async (u: string, id: string) => {
      suppressions.push({ uid: u, id });
      docs = docs.filter((d) => d.id !== id);
      rappel?.([...docs]);
    },
  };
  TestBed.configureTestingModule({ providers: [{ provide: SOURCE_TACKLE_BOX, useValue: source }] });
  const service = TestBed.inject(TackleBoxService);
  // Méthodes de l'US 101 : typées en `unknown` pour que le test compile avant l'implémentation et échoue à l'exécution.
  const api = service as unknown as {
    modifier(id: string, saisie: Record<string, unknown>): Promise<void>;
    supprimer(id: string): Promise<void>;
  };
  return { service, api, modifications, suppressions };
}

const valide = { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', marque: 'Sakura', createdAt: 1700000000000 };
const initial = (): DocumentLeurre[] => [{ id: 'a', data: valide, enAttente: false }];

describe('TackleBoxService : modifier et supprimer (US 101)', () => {
  it('given un utilisateur connecté, when je modifie un leurre, then le document reçoit typeId, tailleCm, poidsG, couleur et marque rognées, sans toucher à createdAt', async () => {
    const { api, modifications } = creer('u1', initial());
    await api.modifier('a', { typeId: 'jig', tailleCm: 12, poidsG: 14, couleur: ' noir ', marque: ' Sakura ' });
    expect(modifications).toHaveLength(1);
    expect(modifications[0].uid).toBe('u1');
    expect(modifications[0].id).toBe('a');
    expect(modifications[0].data).toEqual({ typeId: 'jig', tailleCm: 12, poidsG: 14, couleur: 'noir', marque: 'Sakura' });
    expect(modifications[0].data).not.toHaveProperty('createdAt');
  });

  it('given une marque effacée, when je modifie un leurre, then le document porte la marque vide', async () => {
    const { api, modifications } = creer('u1', initial());
    await api.modifier('a', { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon' });
    expect(modifications[0].data['marque']).toBe('');
  });

  it('given un leurre modifié, when je lis la liste, then la nouvelle taille y est, createdAt est inchangé, et le leurre est en attente jusqu\'à la synchronisation', async () => {
    const { service, api } = creer('u1', initial());
    await attendre();
    await api.modifier('a', { typeId: 'shad', tailleCm: 12, poidsG: 12, couleur: 'gardon', marque: 'Sakura' });
    const [l] = service.leurres()!;
    expect(l).toMatchObject({ id: 'a', tailleCm: 12, createdAt: 1700000000000, enAttente: true });
  });

  it('given aucun utilisateur connecté, when je modifie un leurre, then la modification est refusée et rien n\'est écrit', async () => {
    const { api, modifications } = creer(null, initial());
    await expect(api.modifier('a', { typeId: 'shad', tailleCm: 12, poidsG: 12, couleur: 'gardon' })).rejects.toBeDefined();
    expect(modifications).toEqual([]);
  });

  it('given un utilisateur connecté, when je supprime un leurre, then le document users/{uid}/tackleBox/{id} est supprimé et le leurre quitte la liste', async () => {
    const { service, api, suppressions } = creer('u1', initial());
    await attendre();
    await api.supprimer('a');
    expect(suppressions).toEqual([{ uid: 'u1', id: 'a' }]);
    expect(service.leurres()).toEqual([]);
  });

  it('given aucun utilisateur connecté, when je supprime un leurre, then la suppression est refusée et rien n\'est supprimé', async () => {
    const { api, suppressions } = creer(null, initial());
    await expect(api.supprimer('a')).rejects.toBeDefined();
    expect(suppressions).toEqual([]);
  });
});
