/*
 * US 17 : garder en cache les tuiles de carte autour des spots (PLAN §4, §10 phase 5).
 * Contrat choisi (à implémenter) :
 *  - TuilesService (nouveau, root, src/app/core/data/tuiles.service.ts) :
 *      mettreEnCacheAutour(lieu: Lieu): Promise<void>, ne rejette jamais.
 *  - Il télécharge, avec le `fetch` global, les tuiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (URL de TUILES, sans
 *    sous-domaine) du carré de 2 km autour du lieu : latitude ± 2/111°, longitude ± 2/(111·cos latitude)°, pour les zooms
 *    10 à 16 inclus, jamais 17 ou plus (politique d'usage d'OSM). Par zoom : toutes les tuiles de x(ouest) à x(est) et de
 *    y(nord) à y(sud), avec x = floor((lng + 180) / 360 · 2^z) et y = floor((1 − asinh(tan φ) / π) / 2 · 2^z).
 *  - Au plus 2 requêtes en vol à la fois.
 *  - Une tuile déjà dans le Cache Storage (`caches.match(url)` rend une réponse) n'est pas redemandée.
 *  - Hors ligne (`navigator.onLine` faux) : aucune requête. Un échec réseau n'est jamais propagé.
 * Doubles : `fetch` et `caches` globaux ; aucun appel réel.
 */
import { TestBed } from '@angular/core/testing';
import { TuilesService } from './tuiles.service';

const ANGERS = { latitude: 47.47, longitude: -0.55 };
const BASE = 'https://tile.openstreetmap.org/';

const tuileX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const tuileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** z);
};

/** Les URL attendues pour un lieu : carré de 2 km, zooms 10 à 16. */
function attendues(lieu: { latitude: number; longitude: number }): string[] {
  const dLat = 2 / 111;
  const dLng = 2 / (111 * Math.cos((lieu.latitude * Math.PI) / 180));
  const urls: string[] = [];
  for (let z = 10; z <= 16; z++) {
    const [x1, x2] = [tuileX(lieu.longitude - dLng, z), tuileX(lieu.longitude + dLng, z)];
    const [y1, y2] = [tuileY(lieu.latitude + dLat, z), tuileY(lieu.latitude - dLat, z)];
    for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) urls.push(`${BASE}${z}/${x}/${y}.png`);
  }
  return urls;
}

const urlDe = (entree: unknown) => (typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : (entree as Request).url);

function installer(enLigne = true, fetchDouble?: (url: string) => Promise<Response>) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(enLigne);
  const demandees: string[] = [];
  const fetchSpy = vi.fn(async (entree: unknown) => {
    const url = urlDe(entree);
    demandees.push(url);
    return fetchDouble ? fetchDouble(url) : new Response('png');
  });
  vi.stubGlobal('fetch', fetchSpy);
  return { service: TestBed.inject(TuilesService), demandees, fetchSpy };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TuilesService (US 17)', () => {
  it('given un lieu et du réseau, when on met en cache autour, then exactement les tuiles du carré de 2 km des zooms 10 à 16 sont demandées', async () => {
    const { service, demandees } = installer();

    await service.mettreEnCacheAutour(ANGERS);

    const attendus = attendues(ANGERS);
    expect(attendus.length).toBeGreaterThan(100);
    expect(attendus.length).toBeLessThan(200);
    expect([...demandees].sort()).toEqual([...attendus].sort());
  });

  it('given un lieu et du réseau, when on met en cache autour, then aucune tuile de zoom 17 ou plus n\'est demandée et toutes viennent d\'OpenStreetMap', async () => {
    const { service, demandees } = installer();

    await service.mettreEnCacheAutour({ latitude: 46, longitude: 2 });

    expect(demandees.length).toBeGreaterThan(0);
    const zooms = demandees.map((u) => Number(u.slice(BASE.length).split('/')[0]));
    expect(Math.max(...zooms)).toBe(16);
    expect(Math.min(...zooms)).toBe(10);
    expect(demandees.every((u) => u.startsWith(BASE) && u.endsWith('.png'))).toBe(true);
  });

  it('given des tuiles lentes, when on met en cache autour, then jamais plus de 2 requêtes ne sont en vol et toutes les tuiles finissent demandées', async () => {
    let enVol = 0;
    let max = 0;
    const { service, demandees } = installer(true, async () => {
      enVol++;
      max = Math.max(max, enVol);
      await new Promise((r) => setTimeout(r, 0));
      enVol--;
      return new Response('png');
    });

    await service.mettreEnCacheAutour(ANGERS);

    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(2);
    expect(demandees).toHaveLength(attendues(ANGERS).length);
  });

  it('given des tuiles déjà dans le cache du navigateur, when on met en cache autour, then elles ne sont pas redemandées', async () => {
    const deja = new Set(attendues(ANGERS).slice(0, 10));
    vi.stubGlobal('caches', { match: vi.fn(async (entree: unknown) => (deja.has(urlDe(entree)) ? new Response('png') : undefined)) });
    const { service, demandees } = installer();

    await service.mettreEnCacheAutour(ANGERS);

    expect(demandees.length).toBeGreaterThan(0);
    expect(demandees.some((u) => deja.has(u))).toBe(false);
    expect(demandees).toHaveLength(attendues(ANGERS).length - deja.size);
  });

  it('given l\'appareil en mode avion, when on met en cache autour, then aucune requête n\'est faite', async () => {
    const { service, fetchSpy } = installer(false);

    await service.mettreEnCacheAutour(ANGERS);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('given un réseau qui échoue, when on met en cache autour, then la promesse se résout sans erreur', async () => {
    const { service } = installer(true, async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(service.mettreEnCacheAutour(ANGERS)).resolves.toBeUndefined();
  });
});
