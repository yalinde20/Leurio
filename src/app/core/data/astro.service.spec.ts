// US 56 : lever, coucher du soleil et phase de la lune, calculés en local (PLAN §2, §4, §11).
// Contrat : astro.service.ts exporte `AstroService` (providedIn root) avec
//   soleil(lieu, jour): { lever: Date | null; coucher: Date | null }  (jour = un instant du jour civil français voulu)
//   lune(instant, lieu?): { phase: NomPhaseLune; fractionEclairee: number (0..1) }
// ainsi que `PHASES_LUNE` (les huit noms, dans l'ordre) et le type `NomPhaseLune`.
// Heures de référence (heure légale française) : éphéméride haute précision, cohérente avec l'IMCCE.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Lieu } from './weather-provider';
import { AstroService, PHASES_LUNE } from './astro.service';

const TOLERANCE_MIN = 2;

const HUIT_PHASES = [
  'Nouvelle lune',
  'Premier croissant',
  'Premier quartier',
  'Gibbeuse croissante',
  'Pleine lune',
  'Gibbeuse décroissante',
  'Dernier quartier',
  'Dernier croissant',
];

function minutesParis(date: Date | null): number {
  expect(date).not.toBeNull();
  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date as Date);
  const h = Number(parties.find((p) => p.type === 'hour')?.value);
  const m = Number(parties.find((p) => p.type === 'minute')?.value);
  return h * 60 + m;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function service(): AstroService {
  return TestBed.inject(AstroService);
}

describe('AstroService (soleil et lune)', () => {
  const cas: { nom: string; lieu: Lieu; jour: string; lever: string; coucher: string }[] = [
    { nom: 'Paris le 21/06/2025', lieu: { latitude: 48.8566, longitude: 2.3522 }, jour: '2025-06-21T12:00:00+02:00', lever: '05:47', coucher: '21:58' },
    { nom: 'Brest le 21/12/2025', lieu: { latitude: 48.3904, longitude: -4.4861 }, jour: '2025-12-21T12:00:00+01:00', lever: '09:07', coucher: '17:26' },
    { nom: 'Strasbourg le 30/03/2025 (passage à l\'heure d\'été)', lieu: { latitude: 48.5734, longitude: 7.7521 }, jour: '2025-03-30T12:00:00+02:00', lever: '07:11', coucher: '19:57' },
  ];

  for (const c of cas) {
    it(`critère 0 : given ${c.nom}, when on demande le lever et le coucher du soleil, then chaque heure légale française est à ${TOLERANCE_MIN} minutes au plus de l'éphéméride (${c.lever} / ${c.coucher})`, () => {
      const soleil = service().soleil(c.lieu, new Date(c.jour));
      expect(Math.abs(minutesParis(soleil.lever) - minutes(c.lever))).toBeLessThanOrEqual(TOLERANCE_MIN);
      expect(Math.abs(minutesParis(soleil.coucher) - minutes(c.coucher))).toBeLessThanOrEqual(TOLERANCE_MIN);
    });
  }

  it('critère 1 : given le 14/03/2025 à midi, à Paris, when on demande la phase de la lune, then « Pleine lune » et fraction éclairée > 95 %', () => {
    const lune = service().lune(new Date('2025-03-14T12:00:00+01:00'), { latitude: 48.8566, longitude: 2.3522 });
    expect(lune.phase).toBe('Pleine lune');
    expect(lune.fractionEclairee).toBeGreaterThan(0.95);
    expect(lune.fractionEclairee).toBeLessThanOrEqual(1);
  });

  it('critère 2 : given le 29/03/2025 à midi, à Paris, when on demande la phase de la lune, then « Nouvelle lune » et fraction éclairée < 5 %', () => {
    const lune = service().lune(new Date('2025-03-29T12:00:00+01:00'), { latitude: 48.8566, longitude: 2.3522 });
    expect(lune.phase).toBe('Nouvelle lune');
    expect(lune.fractionEclairee).toBeLessThan(0.05);
    expect(lune.fractionEclairee).toBeGreaterThanOrEqual(0);
  });

  it('critère 3 : given les huit phases attendues, when on lit PHASES_LUNE, then ce sont les huit noms, dans l\'ordre', () => {
    expect([...PHASES_LUNE]).toEqual(HUIT_PHASES);
  });

  it('critère 3 : given une date quelconque (toutes les 6 heures sur deux mois synodiques), when on demande la phase de la lune, then le nom est l\'un des huit', () => {
    const astro = service();
    const debut = new Date('2025-01-01T00:00:00Z').getTime();
    const pas = 6 * 3600 * 1000;
    const fin = debut + 60 * 24 * 3600 * 1000;
    const vues = new Set<string>();
    for (let t = debut; t <= fin; t += pas) {
      const lune = astro.lune(new Date(t));
      expect(HUIT_PHASES).toContain(lune.phase);
      expect(lune.fractionEclairee).toBeGreaterThanOrEqual(0);
      expect(lune.fractionEclairee).toBeLessThanOrEqual(1);
      vues.add(lune.phase);
    }
    expect(vues.size).toBe(8);
  });

  describe('sans réseau', () => {
    const originaux: Record<string, unknown> = {};
    const g = globalThis as unknown as Record<string, unknown>;

    afterEach(() => {
      g['fetch'] = originaux['fetch'];
      g['XMLHttpRequest'] = originaux['XMLHttpRequest'];
      if ('sendBeacon' in navigator) {
        (navigator as unknown as Record<string, unknown>)['sendBeacon'] = originaux['sendBeacon'];
      }
    });

    it('critère 4 : given tout accès réseau bloqué par un double, when on demande soleil et lune, then les résultats sont rendus et aucune requête réseau n\'est tentée', () => {
      const fetchEspion = vi.fn(() => {
        throw new Error('réseau interdit (fetch)');
      });
      const xhrEspion = vi.fn(() => {
        throw new Error('réseau interdit (XMLHttpRequest)');
      });
      const beaconEspion = vi.fn(() => {
        throw new Error('réseau interdit (sendBeacon)');
      });
      originaux['fetch'] = g['fetch'];
      originaux['XMLHttpRequest'] = g['XMLHttpRequest'];
      g['fetch'] = fetchEspion;
      g['XMLHttpRequest'] = xhrEspion;
      const aBeacon = 'sendBeacon' in navigator;
      if (aBeacon) {
        originaux['sendBeacon'] = (navigator as unknown as Record<string, unknown>)['sendBeacon'];
        (navigator as unknown as Record<string, unknown>)['sendBeacon'] = beaconEspion;
      }

      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      const http = TestBed.inject(HttpTestingController);
      const astro = TestBed.inject(AstroService);

      const soleil = astro.soleil({ latitude: 48.8566, longitude: 2.3522 }, new Date('2025-06-21T12:00:00+02:00'));
      const lune = astro.lune(new Date('2025-03-14T12:00:00+01:00'), { latitude: 48.8566, longitude: 2.3522 });

      expect(soleil.lever).toBeInstanceOf(Date);
      expect(soleil.coucher).toBeInstanceOf(Date);
      expect(lune.phase).toBeDefined();
      expect(lune.fractionEclairee).toBeDefined();
      expect(fetchEspion).not.toHaveBeenCalled();
      expect(xhrEspion).not.toHaveBeenCalled();
      expect(beaconEspion).not.toHaveBeenCalled();
      http.verify();
    });
  });
});
