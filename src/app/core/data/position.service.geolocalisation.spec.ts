import { TestBed } from '@angular/core/testing';
import { GEOLOCALISATION } from './position.service';

// Le plugin Capacitor tourne ici avec son implémentation web, qui s'appuie sur navigator : on remplace navigator par des doubles.
describe('GEOLOCALISATION', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("given le jeton par défaut, when on le lit, then l'objet n'a pas de ngOnDestroy (Angular le prendrait pour une méthode du plugin)", () => {
    expect('ngOnDestroy' in TestBed.inject(GEOLOCALISATION)).toBe(false);
  });

  it('given le jeton par défaut, when on appelle ses méthodes, then chacune délègue au plugin', async () => {
    const coords = { latitude: 47.47, longitude: -0.55, accuracy: 10 };
    const options = { timeout: 1234 };
    const getCurrentPosition = vi.fn((succes: (p: unknown) => void) =>
      succes({ coords, timestamp: 0 }),
    );
    const query = vi.fn().mockResolvedValue({ state: 'granted' });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition }, permissions: { query } });
    const geoloc = TestBed.inject(GEOLOCALISATION);

    expect((await geoloc.checkPermissions()).location).toBe('granted');
    expect(query).toHaveBeenCalled();
    expect((await geoloc.getCurrentPosition(options)).coords).toMatchObject(coords);
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining(options),
    );
    // Sur le web, le plugin n'implémente pas requestPermissions : c'est son refus qui revient.
    await expect(geoloc.requestPermissions?.()).rejects.toMatchObject({ code: 'UNIMPLEMENTED' });
  });
});
