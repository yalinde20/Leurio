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
/** Version 2 : ajout du magasin de la sortie préparée (US 14) ; le magasin « conditions » est conservé. */
const VERSION_BASE = 2;
const MAGASIN = 'conditions';
/** Magasin de la sortie préparée, lu et écrit par `SortieService`. */
export const MAGASIN_SORTIE = 'sortie';
const CLE = 'dernieres';

/** Délai maximal d'une opération IndexedDB : certains Safari iOS laissent `open()` sans réponse. */
export const DELAI_INDEXED_DB_MS = 2000;

/** Rend la valeur de `operation`, ou `defaut` si elle ne répond pas dans le délai (ou rejette). */
export function avecDelai<T>(operation: Promise<T>, defaut: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const minuteur = setTimeout(() => resolve(defaut), DELAI_INDEXED_DB_MS);
    operation.then(
      (valeur) => {
        clearTimeout(minuteur);
        resolve(valeur);
      },
      () => {
        clearTimeout(minuteur);
        resolve(defaut);
      },
    );
  });
}

function estReleve(valeur: unknown): valeur is ReleveConditions {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const { conditions, obtenuesA } = valeur as Partial<Record<keyof ReleveConditions, unknown>>;
  return (
    typeof conditions === 'object' &&
    conditions !== null &&
    typeof obtenuesA === 'string' &&
    !Number.isNaN(new Date(obtenuesA).getTime())
  );
}

/**
 * Garde dans IndexedDB les dernières conditions obtenues, pour les reprendre quand la météo est en panne
 * (PLAN §4, « Si une API est en panne »). Une seule entrée, quel que soit le lieu, sans expiration.
 * Ne rejette jamais : sans IndexedDB ou en cas d'erreur, `lire` rend `null` et `ecrire` ne fait rien.
 */
@Injectable({ providedIn: 'root' })
export class ConditionsCache {
  private readonly indexedDb = inject(INDEXED_DB);

  lire(): Promise<ReleveConditions | null> {
    return avecDelai(this.lireSansDelai(), null);
  }

  ecrire(releve: ReleveConditions): Promise<void> {
    return avecDelai(this.ecrireSansDelai(releve), undefined);
  }

  private async lireSansDelai(): Promise<ReleveConditions | null> {
    try {
      const base = await this.ouvrir();
      if (!base) return null;
      return await new Promise<ReleveConditions | null>((resolve) => {
        try {
          const requete = base.transaction(MAGASIN, 'readonly').objectStore(MAGASIN).get(CLE);
          requete.onsuccess = () => {
            base.close();
            resolve(estReleve(requete.result) ? requete.result : null);
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

  private async ecrireSansDelai(releve: ReleveConditions): Promise<void> {
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

  private ouvrir(): Promise<IDBDatabase | null> {
    return ouvrirBase(this.indexedDb);
  }
}

/** Ouvre la base de l'app (mise à niveau comprise), ou rend `null` si elle est absente, bloquée ou en erreur. */
export function ouvrirBase(fabrique: IDBFactory | undefined): Promise<IDBDatabase | null> {
  if (!fabrique) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const requete = fabrique.open(BASE, VERSION_BASE);
      requete.onupgradeneeded = () => {
        const base = requete.result;
        for (const magasin of [MAGASIN, MAGASIN_SORTIE]) {
          if (!base.objectStoreNames.contains(magasin)) base.createObjectStore(magasin);
        }
      };
      requete.onsuccess = () => resolve(requete.result);
      requete.onerror = () => resolve(null);
      requete.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
