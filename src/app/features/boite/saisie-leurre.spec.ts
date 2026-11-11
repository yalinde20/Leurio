import { erreurNombre, erreurTexte, nombrePositif } from './saisie-leurre';

describe('saisie d\'un leurre (US 99)', () => {
  it.each([['10', 10], ['12,5', 12.5], [' 12.5 ', 12.5], ['.5', 0.5], ['7.', 7]])('lit « %s » comme %d', (texte, attendu) => {
    expect(nombrePositif(texte)).toBe(attendu);
  });

  it.each(['', 'abc', '0', '0,0', '-3', '1e3', '1,2,3', '12 g'])('refuse « %s »', (texte) => {
    expect(nombrePositif(texte)).toBeNull();
  });

  it('distingue un nombre vide d\'un nombre invalide', () => {
    expect(erreurNombre('  ')).toBe('Champ obligatoire');
    expect(erreurNombre('abc')).toBe('Entre un nombre supérieur à 0.');
    expect(erreurNombre('3')).toBeNull();
  });

  it('exige un texte non vide', () => {
    expect(erreurTexte('  ')).toBe('Champ obligatoire');
    expect(erreurTexte('gardon')).toBeNull();
  });
});
