/*
 * US 296 : la réglette du temps. Fonctions pures de `moment-format.ts` que la réglette utilise (PLAN §3, §6).
 *
 * Contrat des exports à ajouter à `moment-format.ts` (les fonctions existantes de l'US 82 ne sont pas utilisées ici) :
 *  - `PAS_PAR_JOUR` : nombre de pas d'une journée à Paris, par pas de 30 min : 48 (0 h, 0 h 30 … 23 h 30).
 *  - `momentDePas(jour, pas, maintenant)` : l'instant « jour choisi (aujourd'hui, demain, après-demain, comptés depuis le jour de Paris
 *    de `maintenant`), pas × 30 min après minuit », lu sur l'horloge MURALE de Paris (le jour du changement d'heure dure 23 h ou 25 h).
 *  - `libelleReglette(moment, maintenant)` : le libellé que la réglette affiche et que VoiceOver lit.
 *    `moment === null` = « Maintenant » : « Maintenant 14 h 20 » (l'heure de `maintenant`, à la minute).
 *    Sinon « <partie du jour> <heure> » : « Ce matin 7 h 30 », « Cet après-midi 15 h », « Ce soir 18 h 30 » pour aujourd'hui ;
 *    « Demain 7 h 30 » et « Après-demain 6 h » pour les autres jours. Les minutes à 0 ne s'écrivent pas (« 15 h », jamais « 15 h 00 »).
 *
 * Les exports sont lus par leur nom sur le module : tant qu'ils manquent, chaque test échoue sur eux (et non toute la compilation).
 */
import * as format from './moment-format';

type JourMoment = 'aujourdhui' | 'demain' | 'apres-demain';
interface FormatReglette {
  PAS_PAR_JOUR: number;
  momentDePas(jour: JourMoment, pas: number, maintenant: Date): Date;
  libelleReglette(moment: Date | null, maintenant: Date): string;
}
const f = format as unknown as FormatReglette;

// Lundi 9 novembre 2026, 14 h 20 à Paris (UTC+1).
const MAINTENANT = new Date('2026-11-09T13:20:00Z');

describe('moment-format : la réglette du temps (US 296)', () => {
  describe('momentDePas', () => {
    it('given une journée à Paris, when je compte ses pas, then elle en a 48 (par pas de 30 min)', () => {
      expect(f.PAS_PAR_JOUR).toBe(48);
    });

    it('given aujourd\'hui, when je prends le pas 37, then c\'est 18 h 30 à Paris (17:30Z en hiver)', () => {
      expect(f.momentDePas('aujourdhui', 37, MAINTENANT).toISOString()).toBe('2026-11-09T17:30:00.000Z');
    });

    it('given les trois jours, when je prends le pas 0 et le pas 47, then ce sont minuit et 23 h 30 de Paris', () => {
      expect(f.momentDePas('demain', 0, MAINTENANT).toISOString()).toBe('2026-11-09T23:00:00.000Z');
      expect(f.momentDePas('demain', 47, MAINTENANT).toISOString()).toBe('2026-11-10T22:30:00.000Z');
      expect(f.momentDePas('apres-demain', 12, MAINTENANT).toISOString()).toBe('2026-11-11T05:00:00.000Z');
    });

    it('given 23 h 30 à Paris, when je prends le pas 15 de demain, then le jour de Paris est utilisé, pas celui de UTC', () => {
      const tard = new Date('2026-11-09T22:30:00Z'); // 23 h 30 à Paris, 9 novembre
      expect(f.momentDePas('demain', 15, tard).toISOString()).toBe('2026-11-10T06:30:00.000Z'); // 7 h 30
    });

    it("given le passage à l'heure d'été (29 mars 2026, jour de 23 h), when je prends 7 h et 7 h 30, then l'heure de Paris est respectée", () => {
      const veille = new Date('2026-03-28T12:00:00Z');
      expect(f.momentDePas('demain', 14, veille).toISOString()).toBe('2026-03-29T05:00:00.000Z'); // 7 h CEST
      expect(f.momentDePas('demain', 15, veille).toISOString()).toBe('2026-03-29T05:30:00.000Z'); // 7 h 30 CEST
    });
  });

  describe('libelleReglette', () => {
    it('given « Maintenant », when je formate, then le libellé porte l\'heure à la minute', () => {
      expect(f.libelleReglette(null, MAINTENANT)).toBe('Maintenant 14 h 20');
    });

    it("given des moments d'aujourd'hui, when je formate, then le libellé dit ce matin, cet après-midi ou ce soir, avec l'heure", () => {
      const tot = new Date('2026-11-09T06:30:00Z'); // 7 h 30 (un matin, passé : le libellé ne juge pas de la validité)
      expect(f.libelleReglette(tot, new Date('2026-11-09T05:00:00Z'))).toBe('Ce matin 7 h 30');
      expect(f.libelleReglette(new Date('2026-11-09T14:00:00Z'), MAINTENANT)).toBe('Cet après-midi 15 h');
      expect(f.libelleReglette(new Date('2026-11-09T17:30:00Z'), MAINTENANT)).toBe('Ce soir 18 h 30');
      expect(f.libelleReglette(new Date('2026-11-09T20:00:00Z'), MAINTENANT)).toBe('Ce soir 21 h');
    });

    it('given des moments de demain et après-demain, when je formate, then le libellé porte le jour et l\'heure', () => {
      expect(f.libelleReglette(new Date('2026-11-10T06:30:00Z'), MAINTENANT)).toBe('Demain 7 h 30');
      expect(f.libelleReglette(new Date('2026-11-11T05:00:00Z'), MAINTENANT)).toBe('Après-demain 6 h');
    });

    it('given un moment à 15 h pile, when je formate, then les minutes à zéro ne s\'écrivent pas', () => {
      expect(f.libelleReglette(new Date('2026-11-09T14:00:00Z'), MAINTENANT)).not.toContain('15 h 00');
    });
  });
});
