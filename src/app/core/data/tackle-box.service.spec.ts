/*
 * US 99 : ma boîte à leurres (PLAN §2.3, §4, §7 : `users/{uid}/tackleBox`).
 *
 * Contrat que ces tests supposent (src/app/core/data/tackle-box.service.ts) :
 *  - `SOURCE_TACKLE_BOX` (InjectionToken<SourceTackleBox>, providedIn root, fabrique Firebase comme SOURCE_SPOTS) :
 *      uid(): Promise<string | null>
 *      ecouter(uid, surChangement: (docs: DocumentLeurre[]) => void, surErreur: (e: unknown) => void): () => void
 *        -> appelle `surChangement` avec TOUS les documents de `users/{uid}/tackleBox` à chaque changement (premier instantané compris,
 *           et changement de métadonnées : fin de synchronisation) ; rend la fonction de désabonnement.
 *      ajouter(uid, data: Record<string, unknown>): Promise<void>
 *        -> crée un document ; résout dès l'écriture LOCALE (n'attend pas l'accusé du serveur : hors ligne il ne vient pas).
 *    DocumentLeurre = { id: string; data: unknown; enAttente: boolean }   (enAttente = `metadata.hasPendingWrites`)
 *  - `TackleBoxService` (providedIn root) :
 *      leurres: Signal<Leurre[] | null>   // null tant que le premier instantané n'est pas arrivé ; sinon le plus récent d'abord (createdAt décroissant)
 *      ajouter(saisie: { typeId: string; tailleCm: number; poidsG: number; couleur: string; marque?: string }): Promise<void>
 *    Leurre = { id; typeId; tailleCm; poidsG; couleur; marque?: string; createdAt: number; enAttente: boolean }
 *  - Document écrit : { typeId, tailleCm, poidsG, couleur, marque, createdAt } ; couleur et marque rognées ; marque vaut '' si absente ;
 *    createdAt = Date.now() (nombre, ms). Les documents mal formés sont ignorés à la lecture.
 *  - Sans utilisateur connecté (uid null), `ajouter` rejette et n'écrit rien.
 */
import { TestBed } from '@angular/core/testing';
import { DocumentLeurre, SOURCE_TACKLE_BOX, TackleBoxService } from './tackle-box.service';

const attendre = () => new Promise<void>((r) => setTimeout(r));

function creer(uid: string | null, initiaux: DocumentLeurre[] = []) {
  const ecritures: { uid: string; data: Record<string, unknown> }[] = [];
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
      ecritures.push({ uid: u, data });
      docs = [...docs, { id: `n${docs.length}`, data, enAttente: true }];
      rappel?.([...docs]);
    },
  };
  TestBed.configureTestingModule({ providers: [{ provide: SOURCE_TACKLE_BOX, useValue: source }] });
  const service = TestBed.inject(TackleBoxService);
  return {
    service,
    ecritures,
    synchroniser: () => {
      docs = docs.map((d) => ({ ...d, enAttente: false }));
      rappel?.([...docs]);
    },
  };
}

const valide = { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', marque: 'Sakura', createdAt: 1700000000000 };

describe('TackleBoxService (US 99)', () => {
  it('given un utilisateur connecté, when j\'enregistre un leurre, then users/{uid}/tackleBox reçoit typeId, tailleCm, poidsG, couleur, marque et createdAt', async () => {
    const { service, ecritures } = creer('u1');
    const avant = Date.now();
    await service.ajouter({ typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: ' gardon ', marque: ' Sakura ' });
    expect(ecritures).toHaveLength(1);
    expect(ecritures[0].uid).toBe('u1');
    const { createdAt, ...reste } = ecritures[0].data;
    expect(reste).toEqual({ typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', marque: 'Sakura' });
    expect(typeof createdAt).toBe('number');
    expect(createdAt as number).toBeGreaterThanOrEqual(avant);
    expect(createdAt as number).toBeLessThanOrEqual(Date.now());
  });

  it('given une marque non renseignée, when j\'enregistre un leurre, then le document porte quand même le champ marque (chaîne vide)', async () => {
    const { service, ecritures } = creer('u1');
    await service.ajouter({ typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon' });
    expect(ecritures[0].data['marque']).toBe('');
  });

  it('given aucun utilisateur connecté, when j\'enregistre un leurre, then l\'ajout est refusé et rien n\'est écrit', async () => {
    const { service, ecritures } = creer(null);
    await expect(service.ajouter({ typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon' })).rejects.toBeDefined();
    expect(ecritures).toEqual([]);
  });

  it('given la boîte pas encore lue, when je lis la liste, then elle vaut null (chargement) puis la liste', async () => {
    const { service } = creer('u1', [{ id: 'a', data: valide, enAttente: false }]);
    expect(service.leurres()).toBeNull();
    await attendre();
    expect(service.leurres()).toEqual([{ id: 'a', ...valide, enAttente: false }]);
  });

  it('given plusieurs leurres, when je lis la liste, then le plus récent est en premier', async () => {
    const { service } = creer('u1', [
      { id: 'vieux', data: { ...valide, createdAt: 1000 }, enAttente: false },
      { id: 'recent', data: { ...valide, createdAt: 3000 }, enAttente: false },
      { id: 'milieu', data: { ...valide, createdAt: 2000 }, enAttente: false },
    ]);
    await attendre();
    expect(service.leurres()!.map((l) => l.id)).toEqual(['recent', 'milieu', 'vieux']);
  });

  it('given des documents mal formés, when je lis la liste, then ils sont ignorés', async () => {
    const { service } = creer('u1', [
      { id: 'a', data: { ...valide, typeId: '' }, enAttente: false },
      { id: 'b', data: { ...valide, tailleCm: '10' }, enAttente: false },
      { id: 'c', data: { ...valide, poidsG: undefined }, enAttente: false },
      { id: 'd', data: null, enAttente: false },
      { id: 'ok', data: valide, enAttente: false },
    ]);
    await attendre();
    expect(service.leurres()!.map((l) => l.id)).toEqual(['ok']);
  });

  it('given je n\'ai pas de réseau, when j\'enregistre un leurre, then il est tout de suite dans la liste, marqué en attente, et ne l\'est plus une fois synchronisé', async () => {
    const { service, synchroniser } = creer('u1', [{ id: 'a', data: { ...valide, createdAt: 1000 }, enAttente: false }]);
    await attendre();
    await service.ajouter({ typeId: 'jig', tailleCm: 8, poidsG: 14, couleur: 'noir' });
    const liste = service.leurres()!;
    expect(liste).toHaveLength(2);
    expect(liste[0]).toMatchObject({ typeId: 'jig', tailleCm: 8, poidsG: 14, couleur: 'noir', enAttente: true });
    expect(liste[1].enAttente).toBe(false);

    synchroniser();
    expect(service.leurres()!.every((l) => !l.enAttente)).toBe(true);
  });
});
