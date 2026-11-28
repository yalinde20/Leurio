import { ReleveActuel } from '../../core/data/conditions.service';
import { Conditions } from '../../core/engine/conditions';
import {
  formaterCiel,
  formaterDebit,
  formaterHeure,
  formaterHeuresLegales,
  formaterMeteo,
  formaterPression,
  formaterSourceTempEau,
  formaterTempEau,
  formaterVent,
} from './conditions-format';

const base: Conditions = {
  tempEau: 11.5,
  sourceTempEau: 'capteur',
  debitTendance: 'normal',
  pressionTendance48h: null,
  nuages: null,
  vent: null,
  moment: 'jour',
  saison: 'automne',
  categorie: null,
  departement: '49',
  niveau: 'debutant',
};
const releve = (c: Partial<Conditions>, r: Partial<ReleveActuel> = {}): ReleveActuel => ({
  conditions: { ...base, ...c },
  pressionHpa: null,
  moinsPrecis: false,
  ...r,
});

describe('conditions-format', () => {
  it('formate les heures de Paris sans zéro initial', () => {
    expect(formaterHeure(new Date('2026-11-06T06:02:00Z'))).toBe('7 h 02');
    expect(formaterHeure(new Date('2026-07-15T22:05:00Z'))).toBe('0 h 05');
    expect(
      formaterHeuresLegales(new Date('2026-11-06T06:02:00Z'), new Date('2026-11-06T17:31:00Z')),
    ).toBe('7 h 02 – 18 h 31');
  });

  it('formate la température avec la virgule française, ou « Inconnue »', () => {
    expect(formaterTempEau(11.5)).toBe('11,5 °C');
    expect(formaterTempEau(9)).toBe('9 °C');
    expect(formaterTempEau(null)).toBe('Inconnue');
  });

  it("formate la source de l'eau selon son origine", () => {
    expect(
      formaterSourceTempEau(
        releve({}, { stationEau: { nom: 'La Maine à Angers', distanceKm: 4 } }),
      ),
    ).toBe("Station Hub'Eau La Maine à Angers, à 4 km");
    expect(formaterSourceTempEau(releve({ sourceTempEau: 'estimation' }))).toBe(
      "Estimée depuis l'air des derniers jours",
    );
    expect(
      formaterSourceTempEau(
        releve({ sourceTempEau: 'saisie' }, { saisieA: new Date('2026-11-06T06:30:00Z') }),
      ),
    ).toBe('Mesurée au thermomètre à 7 h 30');
    expect(formaterSourceTempEau(releve({ tempEau: null, sourceTempEau: null }))).toBeNull();
  });

  it('formate le débit, y compris quand il manque', () => {
    expect(formaterDebit(releve({ debitTendance: 'crue' }))).toBe('En crue');
    expect(formaterDebit(releve({ debitTendance: 'étiage' }))).toBe("À l'étiage");
    expect(
      formaterDebit(releve({ debitTendance: 'inconnu' }, { debitAbsent: 'aucune station' })),
    ).toBe('Pas de station proche');
    expect(
      formaterDebit(releve({ debitTendance: 'inconnu' }, { debitAbsent: "Hub'Eau indisponible" })),
    ).toBe('Indisponible');
    expect(formaterDebit(releve({ debitTendance: 'inconnu' }))).toBe('Indisponible');
  });

  it('formate la pression avec un vrai signe moins, un plus, ou sans tendance', () => {
    expect(formaterPression(1012, -8)).toBe('1012 hPa (−8 hPa en 48 h)');
    expect(formaterPression(1015, 2)).toBe('1015 hPa (+2 hPa en 48 h)');
    expect(formaterPression(1015, 0)).toBe('1015 hPa (0 hPa en 48 h)');
    expect(formaterPression(1015, null)).toBe('1015 hPa');
    expect(formaterPression(null, -8)).toBe('Indisponible');
  });

  it("arrondit pression, tendance et vent à l'entier, et le signe suit l'arrondi", () => {
    expect(formaterPression(1012.4, -8.3)).toBe('1012 hPa (\u22128 hPa en 48 h)');
    expect(formaterPression(1012, -0.04)).toBe('1012 hPa (0 hPa en 48 h)');
    expect(formaterPression(1012, 0.4)).toBe('1012 hPa (0 hPa en 48 h)');
    expect(formaterVent(12.6)).toBe('13 km/h');
  });

  it('formate ciel et vent, ou « Indisponible »', () => {
    expect(formaterCiel(80)).toBe('80 % de nuages');
    expect(formaterVent(12)).toBe('12 km/h');
    expect(formaterCiel(null)).toBe('Indisponible');
    expect(formaterVent(null)).toBe('Indisponible');
  });
});

describe('formaterMeteo (US 295)', () => {
  it.each([
    [10, 12, 'Dégagé, vent 12 km/h'],
    [40, 12, 'Peu nuageux, vent 12 km/h'],
    [70, 6.4, 'Nuageux, vent 6 km/h'],
    [95, 30, 'Couvert, vent 30 km/h'],
  ])('given %s %% de nuages et un vent de %s km/h, then « %s »', (nuages, vent, attendu) => {
    expect(formaterMeteo(nuages, vent)).toBe(attendu);
  });

  it('given un ciel inconnu, then la ligne ne garde que le vent', () => {
    expect(formaterMeteo(null, 12)).toBe('Vent 12 km/h');
  });

  it('given un vent inconnu, then la ligne le dit', () => {
    expect(formaterMeteo(70, null)).toBe('Nuageux, vent indisponible');
    expect(formaterMeteo(null, null)).toBe('Vent indisponible');
  });
});
