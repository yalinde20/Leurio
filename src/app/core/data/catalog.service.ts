import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Animation, ElementKit, Espece, Federation, TypeLeurre } from './catalog.types';

export type * from './catalog.types';

/** Expose à l'app le contenu embarqué (assets/data/*.json), chargé une seule fois par fichier. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Promise<unknown>>();

  especes(): Promise<Espece[]> {
    return this.charger<Espece>('species');
  }

  typesDeLeurres(): Promise<TypeLeurre[]> {
    return this.charger<TypeLeurre>('lure-types');
  }

  animations(): Promise<Animation[]> {
    return this.charger<Animation>('techniques');
  }

  kitDeDepart(): Promise<ElementKit[]> {
    return this.charger<ElementKit>('starter-kit');
  }

  /** URL de la fédération du département, ou `undefined` si elle n'est pas dans le contenu. */
  async urlFederation(departement: string): Promise<string | undefined> {
    const federations = await this.charger<Federation>('federations');
    return federations.find((f) => f.departement === departement)?.url;
  }

  private charger<T>(fichier: string): Promise<T[]> {
    let promesse = this.cache.get(fichier);
    if (!promesse) {
      promesse = firstValueFrom(this.http.get<T[]>(`assets/data/${fichier}.json`));
      // Une erreur n'est pas mise en cache : le prochain appel réessaie.
      promesse.catch(() => this.cache.delete(fichier));
      this.cache.set(fichier, promesse);
    }
    return promesse as Promise<T[]>;
  }
}
