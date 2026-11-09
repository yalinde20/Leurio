import { formaterTaille, libelleTaille, lireTempSaisie, premierePhrase } from './conseil-format';

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
