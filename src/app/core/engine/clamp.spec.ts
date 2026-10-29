import { clamp } from './clamp';

describe('clamp', () => {
  it('garde une valeur comprise dans l\'intervalle', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('ramène une valeur trop petite au minimum', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('ramène une valeur trop grande au maximum', () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });
});
