import { describe, expect, it } from 'vitest';
import type { TypeLeurre } from '../data/catalog.types';
import type { Leurre } from '../data/tackle-box.service';
import { trouverDansLaBoite } from './matcher';

const shad = { id: 'shad', nom: 'Shad', especes: ['SAN'], zoneNage: 'mi-eau', interditFermetureBrochet: false, tailleCm: [7, 12], sources: ['test'], dateVerif: '2026-11-13' } as TypeLeurre;

describe('matcher : leurre complet de la boîte', () => {
  it('given des leurres du service de la boîte, when le matcher les rend, then le leurre rendu garde tous ses champs (photo comprise)', () => {
    const leurre: Leurre = { id: 'a', typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', photoUrl: 'https://exemple.test/a.jpg', createdAt: 1, enAttente: false };
    const [resultat] = trouverDansLaBoite([{ typeId: 'shad', couleur: 'naturel', taille: { valeur: 10, unite: 'cm' } }], [leurre], [shad]);
    expect(resultat.statut).toBe('dans-ta-boite');
    if (resultat.statut === 'il-te-manque') return;
    // Typé `Leurre` sans conversion : l'interface peut afficher la photo du leurre conseillé.
    const photo: string | undefined = resultat.leurre.photoUrl;
    expect(photo).toBe('https://exemple.test/a.jpg');
    expect(resultat.leurre).toBe(leurre);
  });
});
