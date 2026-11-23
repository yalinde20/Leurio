/*
 * US 88 critère 5 : hors ligne, l'avis est écrit dans le cache local de Firestore et envoyé au retour du réseau (PLAN §4, §7).
 * CONTRAT : creerSourceFeedbackFirebase(injector) (source-feedback.ts) rend une SourceFeedback (voir feedback.service.ts) :
 *  - envoyer(feedback) crée un document dans la collection `feedback` avec exactement les champs reçus (addDoc ou setDoc) ;
 *  - envoyer ne se résout pas à l'accusé du serveur (absent hors ligne) : la promesse se résout même si l'écriture Firestore reste en attente ;
 *  - un refus du serveur n'est pas une erreur pour l'appelant (il est seulement journalisé).
 * Les modules firebase/* sont remplacés par des doubles : aucun réseau.
 */
import type { Injector } from '@angular/core';
import type { SourceFeedback } from '../data/feedback.service';

const { ecritures, mode } = vi.hoisted(() => ({
  ecritures: [] as { chemin: string; data: unknown }[],
  mode: { refus: false },
}));
const chemin = (...parties: unknown[]) => ({ path: parties.filter((p) => typeof p === 'string').join('/') });
// Écriture dont l'accusé du serveur ne vient jamais (hors ligne), ou qui est refusée.
const ecrire = (cible: { path: string }, data: unknown) => {
  ecritures.push({ chemin: cible.path, data });
  return mode.refus ? Promise.reject(new Error('permission-denied')) : new Promise<void>(() => undefined);
};
vi.mock('firebase/firestore', () => ({
  collection: (...a: unknown[]) => chemin(...a),
  doc: (...a: unknown[]) => chemin(...a),
  addDoc: (c: { path: string }, d: unknown) => ecrire(c, d),
  setDoc: (r: { path: string }, d: unknown) => ecrire(r, d),
}));

const DOCUMENT = { conseilId: 'shad:tiree', typeId: 'shad', techniqueId: 'tiree', utile: true, conditions: { tempEau: 12 }, date: '2026-11-09T12:00:00.000Z' };

describe('creerSourceFeedbackFirebase (US 88)', () => {
  let source: SourceFeedback;

  beforeEach(async () => {
    ecritures.length = 0;
    mode.refus = false;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { creerSourceFeedbackFirebase } = await import('./source-feedback');
    source = creerSourceFeedbackFirebase({ get: () => ({ auth: { authStateReady: async () => undefined, currentUser: { uid: 'u1' } }, db: {} }) } as unknown as Injector);
  });

  it("critère 2 : given un avis, when il est envoyé, then un document est créé dans la collection feedback avec exactement les champs de l'avis", async () => {
    await source.envoyer(DOCUMENT);

    expect(ecritures).toHaveLength(1);
    expect(ecritures[0].chemin.startsWith('feedback')).toBe(true);
    expect(ecritures[0].data).toEqual(DOCUMENT);
  });

  it("critère 5 : given je n'ai pas de réseau (l'accusé du serveur ne vient pas), when j'envoie un avis, then l'envoi se termine sans attendre le serveur", async () => {
    const resultat = await Promise.race([source.envoyer(DOCUMENT).then(() => 'termine'), new Promise((r) => setTimeout(() => r('bloque'), 200))]);

    expect(resultat).toBe('termine');
    expect(ecritures).toHaveLength(1);
  });

  describe('sans compte au moment du vote', () => {
    it("critère 5 : given aucun utilisateur n'est connecté, when j'envoie un avis, then l'envoi se termine, rien n'est écrit tant qu'un compte n'existe pas, puis un seul document est écrit à son arrivée", async () => {
      const observateurs: ((u: { uid: string } | null) => void)[] = [];
      const desabonner = vi.fn();
      const auth = { authStateReady: async () => undefined, currentUser: null as { uid: string } | null };
      vi.resetModules();
      vi.doMock('firebase/auth', () => ({
        onAuthStateChanged: (_a: unknown, rappel: (u: { uid: string } | null) => void) => {
          observateurs.push(rappel);
          return desabonner;
        },
      }));
      const { creerSourceFeedbackFirebase } = await import('./source-feedback');
      const sansCompte = creerSourceFeedbackFirebase({ get: () => ({ auth, db: {} }) } as unknown as Injector);

      await expect(sansCompte.envoyer(DOCUMENT)).resolves.toBeUndefined();
      observateurs.forEach((o) => o(null));
      await new Promise((r) => setTimeout(r, 20));
      expect(ecritures).toHaveLength(0);

      auth.currentUser = { uid: 'anonyme' };
      observateurs.forEach((o) => o({ uid: 'anonyme' }));
      observateurs.forEach((o) => o({ uid: 'anonyme' }));
      await new Promise((r) => setTimeout(r, 20));

      expect(ecritures).toHaveLength(1);
      expect(ecritures[0].data).toEqual(DOCUMENT);
      expect(desabonner).toHaveBeenCalled();
      vi.doUnmock('firebase/auth');
    });
  });

  it("critère 5 : given le serveur refuse l'écriture, when j'envoie un avis, then l'appelant ne reçoit pas d'erreur", async () => {
    mode.refus = true;

    await expect(source.envoyer(DOCUMENT)).resolves.toBeUndefined();
  });
});
