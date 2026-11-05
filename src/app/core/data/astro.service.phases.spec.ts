import { TestBed } from '@angular/core/testing';
import { AstroService } from './astro.service';

describe('AstroService (cas limites)', () => {
  it('given un lieu au-delà du cercle polaire en plein été, when on demande le soleil, then lever et coucher sont null', () => {
    const soleil = TestBed.inject(AstroService).soleil({ latitude: 78.2, longitude: 15.6 }, new Date('2025-06-21T12:00:00Z'));
    expect(soleil.lever).toBeNull();
    expect(soleil.coucher).toBeNull();
  });

  it('given le jour du passage à l\'heure d\'été, when on demande le soleil à Paris, then le lever est en heure d\'été', () => {
    const soleil = TestBed.inject(AstroService).soleil({ latitude: 48.8566, longitude: 2.3522 }, new Date('2025-03-30T12:00:00+02:00'));
    const heure = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(soleil.lever as Date);
    expect(parseInt(heure, 10)).toBe(7);
  });
});
