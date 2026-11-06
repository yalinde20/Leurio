import { Injectable, InjectionToken, inject } from '@angular/core';
import { Conditions } from '../engine/conditions';

/** Dernier relevé de conditions obtenu avec succès, tel que gardé en local (PLAN §4). */
export interface ReleveConditions {
  conditions: Conditions;
  pressionHpa: number | null;
  /** Date et heure d'obtention, en ISO 8601. */
  obtenuesA: string;
}

/** IndexedDB du navigateur ; `undefined` quand il n'existe pas. Remplaçable dans les tests. */
export const INDEXED_DB = new InjectionToken<IDBFactory | undefined>('INDEXED_DB', {
  providedIn: 'root',
  factory: () => globalThis.indexedDB,
});

const BASE = 'leurio';
const MAGASIN = 'conditions';
const CLE = 'dernieres';

/**
 * Garde dans IndexedDB les dernières conditions obtenues, pour les reprendre quand Open-Meteo est en panne
 * (PLAN §4, « Si une API est en panne »). Une seule entrée, quel que soit le lieu, sans expiration.
 * Ne rejette jamais : sans IndexedDB ou en cas d'erreur, `lire` rend `null` et `ecrire` ne fait rien.
 */
@Injectable({ providedIn: 'root' })
export class ConditionsCache {
  private readonly indexedDb = inject(INDEXED_DB);

  async lire(): Promise<ReleveConditions | null> {
    try {
      const base = await this.ouvrir();
      if (!base) return null;
      return await new Promise<ReleveConditions | null>((resolve) => {
        try {
          const requete = base.transaction(MAGASIN, 'readonly').objectStore(MAGASIN).get(CLE);
          requete.onsuccess = () => {
            base.close();
            resolve((requete.result as ReleveConditions | undefined) ?? null);
          };
          requete.onerror = () => {
            base.close();
            resolve(null);
          };
        } catch {
          base.close();
          resolve(null);
        }
      });
    } catch {
      return null;
    }
  }

  async ecrire(releve: ReleveConditions): Promise<void> {
    try {
      const base = await this.ouvrir();
      if (!base) return;
      await new Promise<void>((resolve) => {
        try {
          const transaction = base.transaction(MAGASIN, 'readwrite');
          transaction.oncomplete = () => {
            base.close();
            resolve();
          };
          transaction.onerror = transaction.onabort = () => {
            base.close();
            resolve();
          };
          transaction.objectStore(MAGASIN).put(releve, CLE);
        } catch {
          base.close();
          resolve();
        }
      });
    } catch {
      // Le cache est un confort : une erreur ne bloque jamais le conseil.
    }
  }

  /** Ouvre la base, ou rend `null` si elle est absente, bloquée ou en erreur. */
  private ouvrir(): Promise<IDBDatabase | null> {
    const fabrique = this.indexedDb;
    if (!fabrique) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const requete = fabrique.open(BASE, 1);
        requete.onupgradeneeded = () => requete.result.createObjectStore(MAGASIN);
        requete.onsuccess = () => resolve(requete.result);
        requete.onerror = () => resolve(null);
        requete.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
}
