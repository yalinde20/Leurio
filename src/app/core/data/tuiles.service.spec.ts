/*
 * US 17 : garder en cache les tuiles de carte autour des spots (PLAN §4, §10 phase 5).
 * Contrat :
 *  - TuilesService (nouveau, root, src/app/core/data/tuiles.service.ts) :
 *      mettreEnCacheAutour(lieu: Lieu): Promise<void>, ne rejette jamais.
 *  - Il télécharge, avec le `fetch` global, les tuiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (URL de TUILES, sans
 *    sous-domaine) du carré de ± 2 km autour du lieu (4 km de large) : latitude ± 2/111°, longitude ± 2/(111·cos latitude)°, pour les zooms
 *    10 à 16 inclus, jamais 17 ou plus (politique d'usage d'OSM). Par zoom : toutes les tuiles de x(ouest) à x(est) et de
 *    y(nord) à y(sud), avec x = floor((lng + 180) / 360 · 2^z) et y = floor((1 − asinh(tan φ) / π) / 2 · 2^z).
 *  - Une seule file pour toute l'app : au plus 2 requêtes en vol, quel que soit le nombre d'appels ; une tuile en attente ou
 *    en vol n'est demandée qu'une fois.
 *  - Chaque tuile passe par `fetch` : le service worker (groupe `tuiles-osm`) répond depuis son cache quand elle est fraîche et
 *    la redemande quand elle est périmée (décision du propriétaire après revue).
 *  - Hors ligne (`navigator.onLine` faux) ou sans service worker qui contrôle la page : aucune requête. Un échec réseau n'est
 *    jamais propagé.
 * Doubles : `fetch`, `caches` et `navigator.serviceWorker` ; aucun appel réel.
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

function installer(enLigne = true, fetchDouble?: (url: string) => Promise<Response>, serviceWorker = true) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(enLigne);
  // Un service worker contrôle la page (sans lui, personne ne garderait les tuiles : voir le dernier test).
  vi.stubGlobal('navigator', Object.create(navigator, { serviceWorker: { value: serviceWorker ? { controller: {} } : undefined } }));
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

  it('given des tuiles déjà gardées par le navigateur, when on met en cache autour, then chacune est quand même demandée, le service worker décidant de répondre sans réseau ou de la rafraîchir', async () => {
    vi.stubGlobal('caches', { match: vi.fn(async () => new Response('png')) });
    const { service, demandees } = installer();

    await service.mettreEnCacheAutour(ANGERS);

    expect([...demandees].sort()).toEqual([...attendues(ANGERS)].sort());
  });

  it('given un lieu connu, when on met en cache autour, then la tuile de zoom 16 qui le contient (calculée à part) est demandée', async () => {
    const { service, demandees } = installer();

    await service.mettreEnCacheAutour(ANGERS);

    expect(demandees).toContain(`${BASE}16/32667/22924.png`);
  });

  it('given deux appels en même temps sur le même lieu, when ils se terminent, then jamais plus de 2 requêtes ne sont en vol et chaque tuile n\'est demandée qu\'une fois', async () => {
    let enVol = 0;
    let max = 0;
    const { service, demandees } = installer(true, async () => {
      enVol++;
      max = Math.max(max, enVol);
      await new Promise((r) => setTimeout(r, 0));
      enVol--;
      return new Response('png');
    });

    await Promise.all([service.mettreEnCacheAutour(ANGERS), service.mettreEnCacheAutour(ANGERS)]);

    expect(max).toBe(2);
    expect(demandees).toHaveLength(attendues(ANGERS).length);
    expect(new Set(demandees).size).toBe(demandees.length);
  });

  it('given deux appels sur deux lieux différents, when ils se terminent, then jamais plus de 2 requêtes ne sont en vol en tout', async () => {
    let enVol = 0;
    let max = 0;
    const { service } = installer(true, async () => {
      enVol++;
      max = Math.max(max, enVol);
      await new Promise((r) => setTimeout(r, 0));
      enVol--;
      return new Response('png');
    });

    await Promise.all([service.mettreEnCacheAutour(ANGERS), service.mettreEnCacheAutour({ latitude: 46, longitude: 2 })]);

    expect(max).toBe(2);
  });

  it('given une tuile demandée, when on met de nouveau en cache autour après la fin, then elle est redemandée (le service worker la rafraîchit si elle est périmée)', async () => {
    const { service, demandees } = installer();

    await service.mettreEnCacheAutour(ANGERS);
    await service.mettreEnCacheAutour(ANGERS);

    expect(demandees).toHaveLength(2 * attendues(ANGERS).length);
  });

  it('given aucun service worker qui contrôle la page, when on met en cache autour, then aucune requête n\'est faite', async () => {
    const { service, fetchSpy } = installer(true, undefined, false);

    await service.mettreEnCacheAutour(ANGERS);

    expect(fetchSpy).not.toHaveBeenCalled();
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
