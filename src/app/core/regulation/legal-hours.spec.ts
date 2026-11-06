import { heuresLegales } from './legal-hours';

// US 64, PLAN §6 : la pêche est permise de ½ h avant le lever du soleil à ½ h après son coucher.
// Module de réglementation : TypeScript pur, il reçoit le soleil du jour (forme de `SoleilDuJour` d'AstroService) et rend deux instants.
describe('heuresLegales', () => {
  it('given un lever à 7 h 32 et un coucher à 18 h 01 (heure de Paris), when on calcule les heures légales, then elles vont de 7 h 02 à 18 h 31', () => {
    const lever = new Date('2026-11-06T06:32:00Z');
    const coucher = new Date('2026-11-06T17:01:00Z');

    const heures = heuresLegales({ lever, coucher });

    expect(heures?.debut.toISOString()).toBe('2026-11-06T06:02:00.000Z');
    expect(heures?.fin.toISOString()).toBe('2026-11-06T17:31:00.000Z');
  });

  it("given un lever et un coucher en heure d'été, when on calcule les heures légales, then l'écart reste d'une demi-heure avant le lever et après le coucher", () => {
    const lever = new Date('2026-07-15T03:55:00Z');
    const coucher = new Date('2026-07-15T19:47:00Z');

    const heures = heuresLegales({ lever, coucher });

    expect(heures?.debut.getTime()).toBe(lever.getTime() - 30 * 60_000);
    expect(heures?.fin.getTime()).toBe(coucher.getTime() + 30 * 60_000);
  });

  it('given un soleil qui ne se lève pas ou ne se couche pas, when on calcule les heures légales, then il n\'y en a pas (null), sans exception', () => {
    const jour = new Date('2026-06-21T10:00:00Z');

    expect(heuresLegales({ lever: null, coucher: jour })).toBeNull();
    expect(heuresLegales({ lever: jour, coucher: null })).toBeNull();
    expect(heuresLegales({ lever: null, coucher: null })).toBeNull();
  });
});
