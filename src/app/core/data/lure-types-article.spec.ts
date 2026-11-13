// US 105, décision A1 : chaque type de lure-types.json porte `article` (« un » ou « une »), exigé par son schéma.
import lureTypes from '../../../assets/data/lure-types.json';
import schema from '../../../../schemas/lure-types.schema.json';

describe('Contenu des types de leurres : article (US 105, A1)', () => {
  it('critère 3 : given lure-types.json, when on lit chaque type, then `article` vaut « un » ou « une »', () => {
    const sans = (lureTypes as { id: string; article?: unknown }[])
      .filter((t) => t.article !== 'un' && t.article !== 'une')
      .map((t) => t.id);
    expect(sans).toEqual([]);
  });

  it('critère 3 : given les types féminins du contenu, when on lit leur article, then ils disent « une »', () => {
    const articles = new Map(
      (lureTypes as { id: string; article?: string }[]).map((t) => [t.id, t.article]),
    );
    for (const id of [
      'creature',
      'cuillere-tournante',
      'cuillere-ondulante',
      'frog',
      'micro-cuillere',
    ]) {
      expect(articles.get(id), id).toBe('une');
    }
    for (const id of [
      'shad',
      'jig',
      'crankbait',
      'jerkbait-minnow',
      'lipless',
      'popper',
      'swimbait',
      'micro-crankbait',
      'insecte-surface',
    ]) {
      expect(articles.get(id), id).toBe('un');
    }
  });

  it('critère 3 : given le schéma des types de leurres, when on lit ses champs, then `article` est obligatoire et limité à « un » et « une »', () => {
    const item = (
      schema as { items: { required: string[]; properties: Record<string, { enum?: string[] }> } }
    ).items;
    expect(item.required).toContain('article');
    expect([...(item.properties['article']?.enum ?? [])].sort()).toEqual(['un', 'une']);
  });
});
