// US 77 : heures légales de pêche, vérifiées contre l'éphéméride de référence (PLAN §4, §6, §11).
// Contrat : legal-hours.ts exporte `heuresLegales(soleil)` (US 64) et
//   dansHeuresLegales(moment: Date, heures: HeuresLegales): boolean  (bornes incluses).
// Référence : IMCCE, service web Miriade RTS (https://ssp.imcce.fr/webservices/miriade/api/rts.php),
// corps Sun, altitude 35 m, heures en UT, relevé le 2026-11-08. Constantes fixes : aucun appel réseau.
// AstroService n'a pas de dépendance : il est instancié directement (pas de TestBed dans core/regulation, lint).
import { AstroService } from '../data/astro.service';
import { Lieu } from '../data/weather-provider';
import { HeuresLegales, dansHeuresLegales, heuresLegales } from './legal-hours';

// Miriade donne le lever et le coucher du centre du soleil, à la minute ; l'app suit la convention usuelle
// du bord supérieur (suncalc), soit 1 à 2,5 min d'écart. Décision du propriétaire (US 77, option a) :
// on garde le bord supérieur et la tolérance passe de 2 à 3 minutes.
const TOLERANCE_MS = 3 * 60_000;
const MINUTE = 60_000;

interface CasReference {
  nom: string;
  lieu: Lieu;
  /** Un instant à midi (heure de Paris) du jour voulu. */
  jour: string;
  /** Lever et coucher IMCCE, en UT, puis heures légales attendues (UT). */
  lever: string;
  coucher: string;
  debut: string;
  fin: string;
}

const CAS: CasReference[] = [
  { nom: 'Paris le 21/06/2026', lieu: { latitude: 48.8566, longitude: 2.3522 }, jour: '2026-06-21T12:00:00+02:00', lever: '2026-06-21T03:48:00Z', coucher: '2026-06-21T19:56:00Z', debut: '2026-06-21T03:18:00Z', fin: '2026-06-21T20:26:00Z' },
  { nom: 'Brest le 21/12/2026', lieu: { latitude: 48.3904, longitude: -4.4861 }, jour: '2026-12-21T12:00:00+01:00', lever: '2026-12-21T08:08:00Z', coucher: '2026-12-21T16:23:00Z', debut: '2026-12-21T07:38:00Z', fin: '2026-12-21T16:53:00Z' },
  { nom: 'Angers le 29/03/2026', lieu: { latitude: 47.4784, longitude: -0.5632 }, jour: '2026-03-29T12:00:00+02:00', lever: '2026-03-29T05:48:00Z', coucher: '2026-03-29T18:26:00Z', debut: '2026-03-29T05:18:00Z', fin: '2026-03-29T18:56:00Z' },
];

const PARIS = CAS[0];

function heuresDe(cas: CasReference): HeuresLegales {
  const soleil = new AstroService().soleil(cas.lieu, new Date(cas.jour));
  const heures = heuresLegales(soleil);
  expect(heures).not.toBeNull();
  return heures as HeuresLegales;
}

describe('Heures légales de pêche : éphéméride (US 77)', () => {
  for (const cas of CAS) {
    it(`critère 1 : given ${cas.nom}, when on demande les heures légales, then le début est le lever − 30 min et la fin le coucher + 30 min, à 3 minutes au plus de l'éphéméride IMCCE (Miriade, centre du soleil)`, () => {
      const soleil = new AstroService().soleil(cas.lieu, new Date(cas.jour));
      const heures = heuresDe(cas);

      expect(heures.debut.getTime()).toBe((soleil.lever as Date).getTime() - 30 * MINUTE);
      expect(heures.fin.getTime()).toBe((soleil.coucher as Date).getTime() + 30 * MINUTE);
      expect(Math.abs(heures.debut.getTime() - new Date(cas.debut).getTime())).toBeLessThanOrEqual(TOLERANCE_MS);
      expect(Math.abs(heures.fin.getTime() - new Date(cas.fin).getTime())).toBeLessThanOrEqual(TOLERANCE_MS);
    });
  }

  it('critère 2 : given un moment 1 minute avant le début des heures légales, when on demande si le moment est dans les heures légales, then la réponse est non', () => {
    const heures = heuresDe(PARIS);
    expect(dansHeuresLegales(new Date(heures.debut.getTime() - MINUTE), heures)).toBe(false);
  });

  it('critère 3 : given un moment égal au début des heures légales, when on demande si le moment est dans les heures légales, then la réponse est oui', () => {
    const heures = heuresDe(PARIS);
    expect(dansHeuresLegales(new Date(heures.debut.getTime()), heures)).toBe(true);
  });

  it('critère 3 : given un moment égal à la fin des heures légales, when on demande si le moment est dans les heures légales, then la réponse est oui', () => {
    const heures = heuresDe(PARIS);
    expect(dansHeuresLegales(new Date(heures.fin.getTime()), heures)).toBe(true);
  });

  it('critère 4 : given un moment 1 minute après la fin des heures légales, when on demande si le moment est dans les heures légales, then la réponse est non', () => {
    const heures = heuresDe(PARIS);
    expect(dansHeuresLegales(new Date(heures.fin.getTime() + MINUTE), heures)).toBe(false);
  });

  describe('sans réseau', () => {
    const g = globalThis as unknown as Record<string, unknown>;
    let fetchOrigine: unknown;
    let xhrOrigine: unknown;

    afterEach(() => {
      g['fetch'] = fetchOrigine;
      g['XMLHttpRequest'] = xhrOrigine;
    });

    it('critère 5 : given tout accès réseau bloqué, when on demande les heures légales, then elles sont rendues sans aucune requête réseau', () => {
      const fetchEspion = vi.fn(() => {
        throw new Error('réseau interdit (fetch)');
      });
      const xhrEspion = vi.fn(() => {
        throw new Error('réseau interdit (XMLHttpRequest)');
      });
      fetchOrigine = g['fetch'];
      xhrOrigine = g['XMLHttpRequest'];
      g['fetch'] = fetchEspion;
      g['XMLHttpRequest'] = xhrEspion;

      const heures = heuresDe(PARIS);

      expect(heures.debut).toBeInstanceOf(Date);
      expect(heures.fin).toBeInstanceOf(Date);
      expect(fetchEspion).not.toHaveBeenCalled();
      expect(xhrEspion).not.toHaveBeenCalled();
    });
  });
});
