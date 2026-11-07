// US 72 : pénalité de difficulté selon le niveau (PLAN §8.3).
import { Conditions } from '../conditions';
import { Animation, Espece, TypeLeurre } from '../../data/catalog.types';
import { regleDifficulte } from './difficulte';

const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };
const sandre = { code: 'SAN', nom: 'Sandre', ...FICHE } as unknown as Espece;
const type = { id: 'shad', nom: 'shad', ...FICHE } as unknown as TypeLeurre;
const animation = (difficulte: 1 | 2 | 3) => ({ id: 'a', difficulte, ...FICHE }) as unknown as Animation;
const evaluer = (niveau: Conditions['niveau'], difficulte: 1 | 2 | 3) =>
  regleDifficulte({ conditions: { niveau } as Conditions, espece: sandre, type, animation: animation(difficulte), couleurs: [] });

describe('regleDifficulte', () => {
  it.each([
    ['debutant', 1],
    ['intermediaire', 1],
    ['intermediaire', 2],
  ] as const)('given un niveau %s et une difficulté %d, when on évalue la règle, then elle se tait', (niveau, difficulte) => {
    expect(evaluer(niveau, difficulte)).toBeNull();
  });

  it.each([
    ['debutant', 2, 1],
    ['debutant', 3, 2],
    ['intermediaire', 3, 1],
  ] as const)('given un niveau %s et une difficulté %d, when on évalue la règle, then elle pénalise de %d point(s)', (niveau, difficulte, points) => {
    expect(evaluer(niveau, difficulte)).toEqual({
      facteur: 'penaliteDifficulte',
      points,
      phrase: 'Animation exigeante pour ton niveau.',
    });
  });
});
