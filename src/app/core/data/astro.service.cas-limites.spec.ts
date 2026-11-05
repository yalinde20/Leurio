import { TestBed } from '@angular/core/testing';
import { AstroService } from './astro.service';

const PARIS = { latitude: 48.8566, longitude: 2.3522 };

function parisJourEtMinutes(date: Date | null): { jour: string; minutes: number } {
  expect(date).not.toBeNull();
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date as Date);
  const v = (t: string): string => parties.find((p) => p.type === t)?.value ?? '';
  return { jour: `${v('year')}-${v('month')}-${v('day')}`, minutes: Number(v('hour')) * 60 + Number(v('minute')) };
}

describe('AstroService (cas limites)', () => {
  it('given un lieu au-delà du cercle polaire en plein été, when on demande le soleil, then lever et coucher sont null', () => {
    const soleil = TestBed.inject(AstroService).soleil({ latitude: 78.2, longitude: 15.6 }, new Date('2025-06-21T12:00:00Z'));
    expect(soleil.lever).toBeNull();
    expect(soleil.coucher).toBeNull();
  });

  const cas = [
    { nom: 'Paris le 26/10/2025 à 00h30 (passage à l\'heure d\'hiver)', instant: '2025-10-26T00:30:00+02:00', jour: '2025-10-26', lever: 7 * 60 + 28, coucher: 17 * 60 + 40 },
    { nom: 'Paris le 26/10/2025 à 23h30', instant: '2025-10-26T23:30:00+01:00', jour: '2025-10-26', lever: 7 * 60 + 28, coucher: 17 * 60 + 40 },
    { nom: 'Paris le 29/03/2025 à 23h30 (veille du passage à l\'heure d\'été)', instant: '2025-03-29T23:30:00+01:00', jour: '2025-03-29', lever: null, coucher: null },
  ];

  for (const c of cas) {
    it(`given ${c.nom}, when on demande le soleil, then lever et coucher sont ceux du ${c.jour}`, () => {
      const soleil = TestBed.inject(AstroService).soleil(PARIS, new Date(c.instant));
      const lever = parisJourEtMinutes(soleil.lever);
      const coucher = parisJourEtMinutes(soleil.coucher);
      expect(lever.jour).toBe(c.jour);
      expect(coucher.jour).toBe(c.jour);
      if (c.lever !== null && c.coucher !== null) {
        expect(Math.abs(lever.minutes - c.lever)).toBeLessThanOrEqual(2);
        expect(Math.abs(coucher.minutes - c.coucher)).toBeLessThanOrEqual(2);
      }
    });
  }
});
