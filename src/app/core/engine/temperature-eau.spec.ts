// US 55 : estimer la température de l'eau depuis l'air (PLAN §4, §8.2).
// Contrat : temperature-eau.ts (TypeScript pur) exporte `estimerTempEau(moyenneAirC: number)` qui rend `{ tempEauC, source: 'estimation' }`,
// avec tempEauC = max(0, moyenne de l'air), et le type `SourceTempEau` ('capteur' | 'estimation' | 'saisie').
import { DUREE_MAX_SAISIE_H, estimerTempEau, saisieRecente, SourceTempEau } from './temperature-eau';

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

// US 61 : une saisie au thermomètre ne vaut que si elle a moins de 6 h (PLAN §8.2).
// Contrat : temperature-eau.ts exporte `DUREE_MAX_SAISIE_H = 6` et
// `saisieRecente(saisie | undefined, moment: Date): boolean`, vrai ssi valeurC est fini, mesureeA est une date valide
// et 0 ≤ moment − mesureeA < 6 h.
describe('saisieRecente', () => {
  const MOMENT = new Date('2026-11-06T10:00:00Z');
  const saisieA = (iso: string, valeurC = 14.5) => ({ valeurC, mesureeA: new Date(iso) });

  it('critère 0 : given la durée maximale d\'une saisie, when on la lit, then elle vaut 6 heures', () => {
    expect(DUREE_MAX_SAISIE_H).toBe(6);
  });

  it('critère 0 : given une saisie vieille de 5 h 59 min, when on teste sa fraîcheur, then elle est récente', () => {
    expect(saisieRecente(saisieA('2026-11-06T04:01:00Z'), MOMENT)).toBe(true);
  });

  it('critère 2 : given une saisie vieille d\'exactement 6 h, when on teste sa fraîcheur, then elle n\'est pas récente', () => {
    expect(saisieRecente(saisieA('2026-11-06T04:00:00Z'), MOMENT)).toBe(false);
  });

  it('critère 1 : given une saisie vieille de 7 h, when on teste sa fraîcheur, then elle n\'est pas récente', () => {
    expect(saisieRecente(saisieA('2026-11-06T03:00:00Z'), MOMENT)).toBe(false);
  });

  it('critère 0 : given une saisie faite à l\'instant même, when on teste sa fraîcheur, then elle est récente', () => {
    expect(saisieRecente(saisieA('2026-11-06T10:00:00Z'), MOMENT)).toBe(true);
  });

  it('critère 2 : given une saisie datée après le moment demandé, when on teste sa fraîcheur, then elle n\'est pas récente', () => {
    expect(saisieRecente(saisieA('2026-11-06T10:00:01Z'), MOMENT)).toBe(false);
  });

  it('critère 2 : given une valeur NaN, when on teste sa fraîcheur, then elle n\'est pas récente', () => {
    expect(saisieRecente(saisieA('2026-11-06T08:00:00Z', Number.NaN), MOMENT)).toBe(false);
  });

  it('critère 2 : given une date de saisie invalide, when on teste sa fraîcheur, then elle n\'est pas récente', () => {
    expect(saisieRecente({ valeurC: 14.5, mesureeA: new Date('pas une date') }, MOMENT)).toBe(false);
  });

  it('critère 2 : given aucune saisie, when on teste sa fraîcheur, then elle n\'est pas récente', () => {
    expect(saisieRecente(undefined, MOMENT)).toBe(false);
  });
});
