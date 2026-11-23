/*
 * US 4, décision du propriétaire : les spots sont limités à la France métropolitaine. Les départements d'outre-mer
 * (971 Guadeloupe, 972 Martinique, 973 Guyane, 974 La Réunion, 976 Mayotte) ne sont pas reconnus : le formulaire d'ajout de spot
 * refuse alors la position (« Département introuvable : place le spot en France »). Une position à l'étranger ou en mer l'est aussi.
 */
import { GeoService, HORS_FRANCE } from './geo.service';

const geo = () => new GeoService();

describe('GeoService : départements d\'outre-mer (US 4)', () => {
  it.each([
    ['971', 'en Guadeloupe', 16.25, -61.55],
    ['972', 'en Martinique', 14.65, -61.0],
    ['973', 'en Guyane', 4.0, -53.0],
    ['974', 'à La Réunion', -21.1, 55.5],
    ['976', 'à Mayotte', -12.8, 45.15],
  ])('given des coordonnées %s (DOM) %s, when on demande le département, then le service rend « hors France » (décision du propriétaire, US 4)', (code, _lieu, latitude, longitude) => {
    expect(geo().departement({ latitude, longitude })).toBe(HORS_FRANCE);
    expect(geo().nomDepartement(code)).toBeNull();
  });

  it('given une position en Espagne ou en plein océan, when le département est détecté, then le lieu est hors de France', () => {
    expect(geo().departement({ latitude: 40.4, longitude: -3.7 })).toBe(HORS_FRANCE);
    expect(geo().departement({ latitude: 45.0, longitude: -12.0 })).toBe(HORS_FRANCE);
  });
});
