// US 55 : estimer la température de l'eau depuis l'air (PLAN §4, §8.2).
// Contrat : temperature-eau.ts (TypeScript pur) exporte `estimerTempEau(moyenneAirC: number)` qui rend `{ tempEauC, source: 'estimation' }`,
// avec tempEauC = max(0, moyenne de l'air), et le type `SourceTempEau` ('capteur' | 'estimation' | 'saisie').
import { estimerTempEau, SourceTempEau } from './temperature-eau';

describe('estimerTempEau', () => {
  it("critère 0 : given une moyenne de l'air de 12,4 °C sur les derniers jours, when on estime la température de l'eau, then l'estimation vaut 12,4 °C avec la source « estimation »", () => {
    expect(estimerTempEau(12.4)).toEqual({ tempEauC: 12.4, source: 'estimation' });
  });

  it("critère 1 : given une moyenne de l'air de −3 °C, when on estime la température de l'eau, then l'estimation vaut 0 °C", () => {
    const resultat = estimerTempEau(-3);
    expect(resultat.tempEauC).toBe(0);
    expect(resultat.source).toBe('estimation');
  });

  it("critère 1 : given une moyenne de l'air de −0 °C, when on estime la température de l'eau, then l'estimation vaut 0 et non −0", () => {
    expect(Object.is(estimerTempEau(-0).tempEauC, 0)).toBe(true);
  });

  it("critère 1 : given une moyenne de l'air de 0 °C, when on estime la température de l'eau, then l'estimation vaut 0 °C", () => {
    expect(estimerTempEau(0)).toEqual({ tempEauC: 0, source: 'estimation' });
  });

  it('critère 0 : given la source rendue, when on la type, then elle est une SourceTempEau', () => {
    const source: SourceTempEau = estimerTempEau(10).source;
    expect(source).toBe('estimation');
  });
});
