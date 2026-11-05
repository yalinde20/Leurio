import { heureDemandee } from './weather-provider';

const MAINTENANT = new Date('2026-11-05T10:20:00Z');

describe('heureDemandee (fenêtre de prévision)', () => {
  it('given 7 h 29, when on arrondit, then l\'heure pleine précédente est retenue', () => {
    expect(heureDemandee(new Date('2026-11-06T07:29:59Z'), MAINTENANT)).toEqual({ heure: new Date('2026-11-06T07:00:00Z') });
  });

  it('given 7 h 30, when on arrondit, then l\'heure suivante est retenue', () => {
    expect(heureDemandee(new Date('2026-11-06T07:30:00Z'), MAINTENANT)).toEqual({ heure: new Date('2026-11-06T08:00:00Z') });
  });

  it('given exactement maintenant + 48 h, when on valide, then le moment est accepté', () => {
    expect(heureDemandee(new Date('2026-11-07T10:20:00Z'), MAINTENANT)).toEqual({ heure: new Date('2026-11-07T10:00:00Z') });
  });

  it('given maintenant + 48 h + 1 ms, when on valide, then il est refusé comme hors des 48 h', () => {
    expect(heureDemandee(new Date('2026-11-07T10:20:00.001Z'), MAINTENANT)).toEqual({
      disponible: false,
      refusee: true,
      motif: 'moment hors des 48 h à venir',
    });
  });

  it('given le début de l\'heure en cours, when on valide, then il est accepté', () => {
    expect(heureDemandee(new Date('2026-11-05T10:00:00Z'), MAINTENANT)).toEqual({ heure: new Date('2026-11-05T10:00:00Z') });
  });

  it('given 1 ms avant le début de l\'heure en cours, when on valide, then il est refusé comme déjà passé', () => {
    expect(heureDemandee(new Date('2026-11-05T09:59:59.999Z'), MAINTENANT)).toEqual({
      disponible: false,
      refusee: true,
      motif: 'moment déjà passé',
    });
  });
});
