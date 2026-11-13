import { collecterSources, morceauxDeSource } from './sources-contenu';

describe('collecterSources', () => {
  it('trouve les sources partout, sans doublon, dans l\'ordre du fichier', () => {
    const contenu = [{ sources: ['a', 'b'], x: { y: [{ sources: ['c', 'a'] }] } }, { sources: ['d'] }];
    expect(collecterSources(contenu)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignore les sources vides ou qui ne sont pas du texte, et un contenu sans source', () => {
    expect(collecterSources({ sources: ['', ' ', 3, null, 'ok'] })).toEqual(['ok']);
    expect(collecterSources([{ nom: 'x' }])).toEqual([]);
    expect(collecterSources(null)).toEqual([]);
  });
});

describe('morceauxDeSource', () => {
  it('garde un texte sans adresse tel quel', () => {
    expect(morceauxDeSource('Décision du propriétaire')).toEqual([{ texte: 'Décision du propriétaire' }]);
  });

  it('isole une adresse au milieu d\'une phrase', () => {
    expect(morceauxDeSource('Guide https://a.test/x (2026)')).toEqual([
      { texte: 'Guide ' },
      { texte: 'https://a.test/x', url: 'https://a.test/x' },
      { texte: ' (2026)' },
    ]);
  });

  it('laisse la ponctuation finale hors de l\'adresse et ne perd aucun caractère', () => {
    const source = 'Voir (https://a.test/x), puis https://b.test.';
    const morceaux = morceauxDeSource(source);
    expect(morceaux.filter((m) => m.url).map((m) => m.url)).toEqual(['https://a.test/x', 'https://b.test']);
    expect(morceaux.map((m) => m.texte).join('')).toBe(source);
  });
});
