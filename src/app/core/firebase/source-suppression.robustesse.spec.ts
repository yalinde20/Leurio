/*
 * US 98, revue : la suppression des données échoue plutôt que de laisser des documents orphelins (liste venue du cache) ou de rester bloquée (serveur muet).
 */
import type { Injector } from '@angular/core';
import type { SourceSuppression } from '../data/suppression-compte.service';
import { FEATURE_FLAGS } from './feature-flags';

const { journal, auth, deleteDoc, getDocs, etat } = vi.hoisted(() => {
  const journal: string[] = [];
  const etat = { cache: false, bloquer: false };
  return {
    journal,
    etat,
    auth: { authStateReady: async () => undefined, currentUser: { uid: 'u1', providerData: [], metadata: {} } },
    getDocs: vi.fn(async (c: { path: string }) => ({ metadata: { fromCache: etat.cache && c.path.endsWith('spots') }, docs: [{ ref: { path: `${c.path}/x` } }] })),
    deleteDoc: vi.fn((r: { path: string }) => {
      journal.push(`doc:${r.path}`);
      return etat.bloquer ? new Promise<void>(() => undefined) : Promise.resolve();
    }),
  };
});
const chemin = (...parties: unknown[]) => ({ path: parties.filter((p) => typeof p === 'string').join('/') });
vi.mock('firebase/firestore', () => ({ collection: (...a: unknown[]) => chemin(...a), doc: (...a: unknown[]) => chemin(...a), getDocs, deleteDoc }));
vi.mock('firebase/storage', () => ({
  ref: (...a: unknown[]) => chemin(...a),
  listAll: async () => ({ items: [{ path: 'photo' }], prefixes: [] }),
  deleteObject: async (r: { path: string }) => void journal.push(`photo:${r.path}`),
}));

describe('creerSourceSuppressionFirebase : robustesse de supprimerDonnees', () => {
  let source: SourceSuppression;

  beforeEach(async () => {
    journal.length = 0;
    etat.cache = false;
    etat.bloquer = false;
    const { creerSourceSuppressionFirebase } = await import('./source-suppression');
    source = creerSourceSuppressionFirebase({ get: (jeton: unknown) => (jeton === FEATURE_FLAGS ? { estActif: (nom: string) => nom === 'photosLeurres' } : { auth, db: {}, storage: {} }) } as unknown as Injector);
  });
  afterEach(() => vi.useRealTimers());

  it('given une liste de spots venue du cache, when je supprime les données, then l\'opération échoue sans rien supprimer', async () => {
    etat.cache = true;

    await expect(source.supprimerDonnees()).rejects.toMatchObject({ code: 'suppression/cache' });

    expect(journal).toEqual([]);
  });

  it('given un serveur qui ne répond pas à deleteDoc, when je supprime les données, then l\'opération échoue après 20 secondes', async () => {
    vi.useFakeTimers();
    etat.bloquer = true;
    const resultat = source.supprimerDonnees().then(
      () => 'ok',
      (e: { code?: string }) => e.code,
    );

    await vi.advanceTimersByTimeAsync(20_000);

    await expect(resultat).resolves.toBe('suppression/delai');
  });
});
