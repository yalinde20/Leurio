/*
 * US 4, critère 4 : « hors de France métropolitaine et des DOM ». Le formulaire d'ajout de spot accepte une position dans un DOM
 * (971 Guadeloupe, 972 Martinique, 973 Guyane, 974 La Réunion, 976 Mayotte) : GeoService.departement rend son code et
 * nomDepartement son nom (departements.json à étendre). Une position à l'étranger ou en mer reste HORS_FRANCE.
 */
import { GeoService, HORS_FRANCE } from './geo.service';

const geo = () => new GeoService();

describe('GeoService : départements d\'outre-mer (US 4)', () => {
  it.each([
    ['971', 'Guadeloupe', 16.25, -61.55],
    ['972', 'Martinique', 14.65, -61.0],
    ['973', 'Guyane', 4.0, -53.0],
    ['974', 'La Réunion', -21.1, 55.5],
    ['976', 'Mayotte', -12.8, 45.15],
  ])('given une position dans le DOM %s, when le département est détecté, then le code est rendu avec son nom (%s)', (code, nom, latitude, longitude) => {
    expect(geo().departement({ latitude, longitude })).toBe(code);
    expect(geo().nomDepartement(code)).toBe(nom);
  });

  it('given une position en Espagne ou en plein océan, when le département est détecté, then le lieu est hors de France', () => {
    expect(geo().departement({ latitude: 40.4, longitude: -3.7 })).toBe(HORS_FRANCE);
    expect(geo().departement({ latitude: 45.0, longitude: -12.0 })).toBe(HORS_FRANCE);
  });
});
