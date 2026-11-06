// US 60 : saison météorologique d'un instant, mois pris en heure de Paris (PLAN §8.1).
// Contrat : conditions.ts (TypeScript pur) exporte `saisonDe(instant: Date): Saison`.
import { saisonDe } from './conditions';

describe('saisonDe', () => {
  it('critère 2 : given le 15 janvier, when on demande la saison, then elle vaut « hiver »', () => {
    expect(saisonDe(new Date('2027-01-15T12:00:00Z'))).toBe('hiver');
  });

  it('critère 2 : given le 15 juillet, when on demande la saison, then elle vaut « été »', () => {
    expect(saisonDe(new Date('2027-07-15T12:00:00Z'))).toBe('été');
  });

  it('critère 2 : given le 15 avril et le 15 octobre, when on demande la saison, then elle vaut « printemps » puis « automne »', () => {
    expect(saisonDe(new Date('2027-04-15T12:00:00Z'))).toBe('printemps');
    expect(saisonDe(new Date('2027-10-15T12:00:00Z'))).toBe('automne');
  });

  it('critère 2 : given les mois de décembre à février, when on demande la saison, then elle vaut « hiver »', () => {
    for (const iso of ['2026-12-10T12:00:00Z', '2027-01-10T12:00:00Z', '2027-02-10T12:00:00Z']) {
      expect(saisonDe(new Date(iso))).toBe('hiver');
    }
  });

  it('critère 2 : given les limites de saison à midi, when on demande la saison, then mars, juin, septembre et décembre ouvrent printemps, été, automne et hiver', () => {
    expect(saisonDe(new Date('2027-03-01T12:00:00Z'))).toBe('printemps');
    expect(saisonDe(new Date('2027-05-31T12:00:00Z'))).toBe('printemps');
    expect(saisonDe(new Date('2027-06-01T12:00:00Z'))).toBe('été');
    expect(saisonDe(new Date('2027-08-31T12:00:00Z'))).toBe('été');
    expect(saisonDe(new Date('2027-09-01T12:00:00Z'))).toBe('automne');
    expect(saisonDe(new Date('2027-11-30T12:00:00Z'))).toBe('automne');
    expect(saisonDe(new Date('2027-12-01T12:00:00Z'))).toBe('hiver');
  });

  it('critère 2 : given le 30 novembre 23 h 30 UTC, déjà le 1er décembre à Paris, when on demande la saison, then elle vaut « hiver »', () => {
    expect(saisonDe(new Date('2026-11-30T23:30:00Z'))).toBe('hiver');
  });

  it('critère 2 : given le 31 mai 22 h 30 UTC, déjà le 1er juin à Paris, when on demande la saison, then elle vaut « été »', () => {
    expect(saisonDe(new Date('2027-05-31T22:30:00Z'))).toBe('été');
  });

  it('critère 2 : given le 31 août 22 h 30 UTC, déjà le 1er septembre à Paris, when on demande la saison, then elle vaut « automne »', () => {
    expect(saisonDe(new Date('2027-08-31T22:30:00Z'))).toBe('automne');
  });

  it('critère 2 : given le 28 février 23 h 30 UTC, déjà le 1er mars à Paris, when on demande la saison, then elle vaut « printemps »', () => {
    expect(saisonDe(new Date('2027-02-28T23:30:00Z'))).toBe('printemps');
  });
});
