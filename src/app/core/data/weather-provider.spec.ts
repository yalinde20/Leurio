import { heureDemandee, tendancePression48h } from './weather-provider';

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

  it('given une date invalide, when on valide, then la météo est indisponible, sans exception', () => {
    expect(heureDemandee(new Date(''), MAINTENANT)).toStrictEqual({ disponible: false });
  });
});

describe('tendancePression48h (écart sur 48 h)', () => {
  it('given 1020 puis 1012 hPa, when on calcule, then l\'écart vaut -8', () => {
    expect(tendancePression48h(1012, 1020)).toStrictEqual({ disponible: true, ecartHpa: -8 });
  });

  it('given 1008 puis 1013 hPa, when on calcule, then l\'écart vaut +5', () => {
    expect(tendancePression48h(1013, 1008)).toStrictEqual({ disponible: true, ecartHpa: 5 });
  });

  it('given 1008,1 puis 1013,2 hPa, when on calcule, then il est arrondi à 0,1 hPa', () => {
    expect(tendancePression48h(1013.2, 1008.1)).toStrictEqual({ disponible: true, ecartHpa: 5.1 });
  });

  it('given deux pressions égales, when on calcule, then l\'écart vaut 0 et non -0', () => {
    expect(tendancePression48h(1000, 1000.01)).toStrictEqual({ disponible: true, ecartHpa: 0 });
  });

  it.each([[undefined], [null], ['1020'], [NaN], [Infinity]])(
    'given une pression 48 h avant valant %s, when on calcule, then la tendance est indisponible',
    (valeur) => {
      expect(tendancePression48h(1012, valeur)).toStrictEqual({ disponible: false });
    },
  );
});
