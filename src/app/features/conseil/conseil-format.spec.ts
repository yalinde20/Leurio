import type { Animation, Couleur, Espece, TypeLeurre } from '../../core/data/catalog.types';
import type { Conseil } from '../../core/engine/scorer';
import {
  AUCUNE_REGLE,
  detailDuConseil,
  formaterPoidsTete,
  formaterTaille,
  libelleTaille,
  lireTempSaisie,
  premierePhrase,
} from './conseil-format';

describe('premierePhrase', () => {
  it('given plusieurs phrases, when on extrait, then seule la première reste', () => {
    expect(premierePhrase('À 11,5 °C, elle est lente. Autre phrase.')).toBe(
      'À 11,5 °C, elle est lente.',
    );
  });
  it('given une seule phrase, when on extrait, then elle est rendue entière', () => {
    expect(premierePhrase('Une seule phrase.')).toBe('Une seule phrase.');
    expect(premierePhrase('Sans point final')).toBe('Sans point final');
  });
});

describe('taille du leurre', () => {
  it('given des cm, when on formate, then « Taille » et « 8 cm »', () => {
    expect(libelleTaille({ valeur: 8, unite: 'cm' })).toBe('Taille');
    expect(formaterTaille({ valeur: 8, unite: 'cm' })).toBe('8 cm');
  });
  it('given des grammes, when on formate, then « Poids » et « 10 g »', () => {
    expect(libelleTaille({ valeur: 10, unite: 'g' })).toBe('Poids');
    expect(formaterTaille({ valeur: 10, unite: 'g' })).toBe('10 g');
  });
});

describe('lireTempSaisie', () => {
  it.each([
    ['9', 9],
    ['12,5', 12.5],
    ['12.5', 12.5],
    [' 7 ', 7],
    ['0', 0],
    ['35', 35],
    ['-0', 0],
    ['+9', 9],
  ])('given « %s », then %s', (texte, attendu) => {
    expect(lireTempSaisie(texte)).toBe(attendu);
  });

  it.each([[''], ['   '], ['abc'], ['12abc'], ['1,2,3'], ['-0,5'], ['35,1'], ['42'], ['Infinity'], ['1e1'], ['0x10'], ['12.'], [',5']])(
    'given « %s », then null',
    (texte) => {
      expect(lireTempSaisie(texte)).toBeNull();
    },
  );
});

describe('formaterPoidsTete (US 86)', () => {
  it('given une gamme [5, 10], when on la formate, then « 5 à 10 g » avec une espace insécable avant l\'unité', () => {
    expect(formaterPoidsTete([5, 10])).toBe('5 à 10 g');
  });

  it('given une gamme décimale, when on la formate, then la virgule française est utilisée', () => {
    expect(formaterPoidsTete([1.5, 3.5])).toBe('1,5 à 3,5 g');
  });
});

describe('detailDuConseil (US 86)', () => {
  const contenu = {
    types: [
      { id: 'shad', nom: 'Shad', poidsTeteG: [5, 10] },
      { id: 'lipless', nom: 'Lipless' },
    ] as unknown as TypeLeurre[],
    animations: [{ id: 'tiree', nom: 'Tirée-relâchée' }] as unknown as Animation[],
    couleurs: [{ id: 'gardon', nom: 'Gardon' }] as Couleur[],
    especes: [{ code: 'SAN', nom: 'Sandre', postes: ['cassures', 'fond'] }] as unknown as Espece[],
  };
  const conseil: Conseil = {
    typeId: 'shad',
    techniqueId: 'tiree',
    especeCode: 'SAN',
    score: 1,
    pourquoi: ['Une phrase.', 'Une autre.'],
    couleur: 'gardon',
    taille: { valeur: 8, unite: 'cm' },
  };

  it('given un type avec poidsTeteG, when on compose le détail, then noms, poids de tête, postes et phrases sont renseignés', () => {
    expect(detailDuConseil(1, conseil, contenu)).toEqual({
      rang: 1,
      type: 'Shad',
      animationId: 'tiree',
      animation: 'Tirée-relâchée',
      espece: 'Sandre',
      couleur: 'Gardon',
      taille: { libelle: 'Taille', valeur: '8 cm' },
      poidsTete: '5 à 10 g',
      postes: 'cassures, fond',
      pourquoi: ['Une phrase.', 'Une autre.'],
    });
  });

  it('given un type sans poidsTeteG et aucune règle, when on compose le détail, then pas de poids de tête et la phrase par défaut', () => {
    const d = detailDuConseil(2, { ...conseil, typeId: 'lipless', pourquoi: [] }, contenu);
    expect(d.poidsTete).toBeNull();
    expect(d.pourquoi).toEqual([AUCUNE_REGLE]);
  });

  it('given une espèce absente du contenu, when on compose le détail, then ni espèce ni postes', () => {
    const d = detailDuConseil(1, { ...conseil, especeCode: 'XXX' }, contenu);
    expect(d.espece).toBeNull();
    expect(d.postes).toBeNull();
  });
});
