import { Injectable } from '@angular/core';

/** Un spot enregistré, réduit à ce dont le conseil a besoin (PLAN §7 : `users/{uid}/spots`). */
export interface SpotEnregistre {
  id: string;
  nom: string;
  lat: number;
  lng: number;
  categorie: 1 | 2;
  departement: string;
}

/** STUB (US 87, tests d'acceptation) : l'implémentation vient avec la story. */
@Injectable({ providedIn: 'root' })
export class SpotsService {
  async mesSpots(): Promise<SpotEnregistre[]> {
    throw new Error('SpotsService.mesSpots : pas encore implémenté (US 87)');
  }
}
