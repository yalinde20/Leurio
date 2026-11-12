import { famillesDesTypes } from './boite.page';

describe('famillesDesTypes', () => {
  it('given des types, when on dérive les familles, then elles sont distinctes, dans l\'ordre de première apparition', () => {
    const types = [{ famille: 'Souples' }, { famille: 'Durs' }, { famille: 'Souples' }, { famille: 'À jupe' }];
    expect(famillesDesTypes(types)).toEqual(['Souples', 'Durs', 'À jupe']);
  });

  it('given aucun type, when on dérive les familles, then la liste est vide', () => {
    expect(famillesDesTypes([])).toEqual([]);
  });
});
