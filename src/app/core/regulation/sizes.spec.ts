import { libelleQuota, libelleTailleMinimale, quota, tailleMinimale } from './sizes';
import type { Espece } from '../data/catalog.types';
import species from '../../../assets/data/species.json';

// US 76, PLAN §6 et §7 : taille minimale lue sur la fiche espèce (jamais en dur) et quota national.
// Module de réglementation : TypeScript pur.
const especes = species as Espece[];
const sandre = especes.find((e) => e.code === 'SAN') as Espece;

const AUCUNE_TAILLE = 'pas de taille minimale nationale';

describe('tailleMinimale', () => {
  it('given une fiche espèce avec tailleMinCm 50 (le sandre), when on demande la taille minimale de cette espèce, then le service rend 50 cm', () => {
    const sandreTest: Espece = { ...sandre, tailleMinCm: 50 };

    expect(tailleMinimale(sandreTest)).toBe(50);
    expect(libelleTailleMinimale(sandreTest)).toBe('50 cm');
  });

  it('given une fiche espèce sans tailleMinCm (le sandre du contenu), when on demande sa taille minimale, then le service rend « pas de taille minimale nationale »', () => {
    expect(sandre.tailleMinCm).toBeNull();

    expect(tailleMinimale(sandre)).toBeNull();
    expect(libelleTailleMinimale(sandre)).toBe(AUCUNE_TAILLE);
  });

  it('given une fiche espèce dont tailleMinCm est null, when on demande sa taille minimale, then le service rend « pas de taille minimale nationale »', () => {
    const sansTaille = { tailleMinCm: null };

    expect(tailleMinimale(sansTaille)).toBeNull();
    expect(libelleTailleMinimale(sansTaille)).toBe(AUCUNE_TAILLE);
  });

  it('given une 8e espèce de test ajoutée au contenu avec tailleMinCm 30, when on demande sa taille minimale, then le service rend 30 cm, sans modification du code', () => {
    const huitieme: Espece = { ...sandre, code: 'TST', nom: 'Espèce de test', tailleMinCm: 30 };
    const contenu: Espece[] = [...especes, huitieme];

    const trouvee = contenu.find((e) => e.code === 'TST') as Espece;

    expect(contenu.length).toBe(especes.length + 1);
    expect(tailleMinimale(trouvee)).toBe(30);
    expect(libelleTailleMinimale(trouvee)).toBe('30 cm');
  });
});

describe('quota', () => {
  it('given un lieu de 2e catégorie, when on demande le quota, then le service rend 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum', () => {
    const q = quota(2);

    expect(q).toEqual({ carnassiersParJour: 3, brochetsParJour: 2 });
    expect(libelleQuota(q as NonNullable<typeof q>)).toBe(
      '3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum',
    );
  });

  it('given un lieu de 1re catégorie, when on demande le quota, then le service ne rend aucun quota', () => {
    expect(quota(1)).toBeNull();
  });
});
