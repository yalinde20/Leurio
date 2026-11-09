import { jourEtHeure, libelleMoment, mentionMoment, momentDe, momentValide, motDuJour } from './moment-format';

// Lundi 9 novembre 2026, 14 h à Paris (UTC+1).
const MAINTENANT = new Date('2026-11-09T13:00:00Z');

describe('moment-format (US 82)', () => {
  describe('momentDe', () => {
    it('given demain 7 h en hiver, when je calcule le moment, then il vaut 06:00Z', () => {
      expect(momentDe('demain', 7, MAINTENANT).toISOString()).toBe('2026-11-10T06:00:00.000Z');
    });

    it("given aujourd'hui et après-demain, when je calcule le moment, then le jour est celui de Paris", () => {
      expect(momentDe('aujourdhui', 8, MAINTENANT).toISOString()).toBe('2026-11-09T07:00:00.000Z');
      expect(momentDe('apres-demain', 6, MAINTENANT).toISOString()).toBe('2026-11-11T05:00:00.000Z');
    });

    it('given 23 h 30 à Paris, when je calcule demain 7 h, then le jour de Paris est utilisé, pas celui de UTC', () => {
      const tard = new Date('2026-11-09T22:30:00Z'); // 23 h 30 à Paris, 9 novembre
      expect(momentDe('aujourdhui', 23, tard).toISOString()).toBe('2026-11-09T22:00:00.000Z');
      expect(momentDe('demain', 7, tard).toISOString()).toBe('2026-11-10T06:00:00.000Z');
    });

    it("given le passage à l'heure d'été (29 mars 2026), when je calcule le moment, then l'heure de Paris est respectée", () => {
      const veille = new Date('2026-03-28T12:00:00Z');
      expect(momentDe('aujourdhui', 20, veille).toISOString()).toBe('2026-03-28T19:00:00.000Z');
      expect(momentDe('demain', 7, veille).toISOString()).toBe('2026-03-29T05:00:00.000Z');
    });

    it("given le passage à l'heure d'hiver (25 octobre 2026), when je calcule le moment, then l'heure de Paris est respectée", () => {
      const veille = new Date('2026-10-24T12:00:00Z');
      expect(momentDe('demain', 1, veille).toISOString()).toBe('2026-10-24T23:00:00.000Z');
      expect(momentDe('apres-demain', 7, veille).toISOString()).toBe('2026-10-26T06:00:00.000Z');
    });
  });

  describe('momentValide', () => {
    it('given un moment passé ou égal à maintenant, then il est refusé', () => {
      expect(momentValide(new Date('2026-11-09T07:00:00Z'), MAINTENANT)).toBe(false);
      expect(momentValide(MAINTENANT, MAINTENANT)).toBe(false);
    });

    it('given un moment futur dans les 48 h, then il est accepté, bornes comprises', () => {
      expect(momentValide(new Date('2026-11-09T14:00:00Z'), MAINTENANT)).toBe(true);
      expect(momentValide(new Date('2026-11-11T13:00:00Z'), MAINTENANT)).toBe(true);
    });

    it('given un moment à plus de 48 h, then il est refusé', () => {
      expect(momentValide(new Date('2026-11-11T22:00:00Z'), MAINTENANT)).toBe(false);
    });
  });

  describe('libellés', () => {
    it('given des moments, when je les formate, then le libellé a une majuscule et la mention des minuscules', () => {
      const demain7h = new Date('2026-11-10T06:00:00Z');
      const apresDemain6h = new Date('2026-11-11T05:00:00Z');
      expect(libelleMoment(demain7h, MAINTENANT)).toBe('Demain 7 h');
      expect(mentionMoment(demain7h, MAINTENANT)).toBe('demain 7 h');
      expect(libelleMoment(apresDemain6h, MAINTENANT)).toBe('Après-demain 6 h');
      expect(mentionMoment(apresDemain6h, MAINTENANT)).toBe('après-demain 6 h');
      expect(libelleMoment(new Date('2026-11-09T17:00:00Z'), MAINTENANT)).toBe("Aujourd'hui 18 h");
      expect(libelleMoment(new Date('2026-11-09T23:00:00Z'), MAINTENANT)).toBe('Demain 0 h');
    });

    it('given un moment, when je cherche son jour, then motDuJour et jourEtHeure suivent le jour de Paris', () => {
      expect(motDuJour(MAINTENANT, MAINTENANT)).toBe("aujourd'hui");
      expect(motDuJour(new Date('2026-11-10T21:00:00Z'), MAINTENANT)).toBe('demain');
      expect(jourEtHeure(new Date('2026-11-11T05:00:00Z'), MAINTENANT)).toEqual({ jour: 'apres-demain', heure: 6 });
      expect(jourEtHeure(new Date('2026-11-12T12:00:00Z'), MAINTENANT)).toBeNull();
    });
  });
});
