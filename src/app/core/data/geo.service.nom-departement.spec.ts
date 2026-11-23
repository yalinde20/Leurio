import { GeoService } from './geo.service';

describe('GeoService : nom d\'un département', () => {
  it('given un code de département, when on demande son nom, then le nom est rendu, et null si le code est inconnu', () => {
    const geo = new GeoService();
    expect(geo.nomDepartement('49')).toBe('Maine-et-Loire');
    expect(geo.nomDepartement('2A')).not.toBeNull();
    expect(geo.nomDepartement('99')).toBeNull();
  });
});
