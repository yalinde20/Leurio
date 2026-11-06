// US 58 : cas limites du calcul de département (trous, frontières, grandes villes).
import { TestBed } from '@angular/core/testing';
import { GeoService, HORS_FRANCE } from './geo.service';

function departement(latitude: number, longitude: number): string {
  return TestBed.inject(GeoService).departement({ latitude, longitude });
}

describe('GeoService : cas limites', () => {
  it.each([
    ['Paris', 48.8566, 2.3522, '75'],
    ['Vincennes', 48.847, 2.439, '94'],
    ['Marseille', 43.2965, 5.3698, '13'],
    ['Strasbourg', 48.5734, 7.7521, '67'],
    ['Lille', 50.6292, 3.0573, '59'],
  ])('given %s, when on demande le département, then le service rend « %s »', (_nom, lat, lon, attendu) => {
    expect(departement(lat, lon)).toBe(attendu);
  });

  it('given un point à environ 200 m au large de la côte, when on demande le département, then il est rattaché au département côtier', () => {
    // Extrémité ouest de l'île d'Ouessant (29), 0,003° plus à l'ouest.
    expect(departement(48.4723, -5.1066)).toBe('29');
  });

  it('given un point à plus d’un kilomètre au large, when on demande le département, then le service rend « hors France »', () => {
    expect(departement(48.4723, -5.1236)).toBe(HORS_FRANCE);
  });

  it('given un lieu de l’autre côté de la frontière suisse, when on demande le département, then le service rend « hors France »', () => {
    expect(departement(46.2044, 6.1432)).not.toBe('74'); // Genève
    expect(departement(46.2044, 6.1432)).toBe(HORS_FRANCE);
  });

  it('given des coordonnées dans les territoires d’outre-mer, when on demande le département, then le service rend « hors France »', () => {
    expect(departement(14.6, -61.0)).toBe(HORS_FRANCE);
  });
});
