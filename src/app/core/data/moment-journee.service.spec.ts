// US 57 : MomentJourneeService dit si l'on pêche à l'aube, de jour, au crépuscule ou de nuit.
// Contrat : src/app/core/data/moment-journee.service.ts exporte `MomentJournee` et `MomentJourneeService` (providedIn: 'root').
// Calcul local avec suncalc (crépuscule civil) ; intervalles semi-ouverts :
// [dawn, sunrise) aube, [sunrise, sunset) jour, [sunset, dusk) crépuscule, sinon nuit.
import { TestBed } from '@angular/core/testing';
import { getTimes } from 'suncalc';
import { MomentJourneeService } from './moment-journee.service';
import type { Lieu } from './weather-provider';

const LYON: Lieu = { latitude: 45.76, longitude: 4.84 };
const JOURS = [
  { nom: 'été', date: new Date('2026-06-21T12:00:00Z') },
  { nom: 'hiver', date: new Date('2026-12-21T12:00:00Z') },
];
const MINUTE = 60_000;
const decale = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MINUTE);

describe('MomentJourneeService', () => {
  const service = () => TestBed.inject(MomentJourneeService);

  for (const { nom, date } of JOURS) {
    const brut = getTimes(date, LYON.latitude, LYON.longitude);
    const t = { dawn: brut.dawn!, sunrise: brut.sunrise!, sunset: brut.sunset!, dusk: brut.dusk!, solarNoon: brut.solarNoon! };

    describe(`en ${nom} à Lyon`, () => {
      it('critère 1 : given un lieu et une heure entre le début de l\'aube civile et le lever du soleil, when on demande le moment de la journée, then le service rend « aube »', () => {
        const milieu = new Date((t.dawn.getTime() + t.sunrise.getTime()) / 2);
        expect(service().moment(LYON, milieu)).toBe('aube');
        expect(service().moment(LYON, t.dawn)).toBe('aube');
      });

      it('critère 2 : given une heure entre le lever et le coucher du soleil, when on demande le moment de la journée, then le service rend « jour »', () => {
        expect(service().moment(LYON, t.solarNoon)).toBe('jour');
        expect(service().moment(LYON, decale(t.sunrise, 5))).toBe('jour');
        expect(service().moment(LYON, decale(t.sunset, -5))).toBe('jour');
      });

      it('critère 3 : given une heure entre le coucher du soleil et la fin du crépuscule civil, when on demande le moment de la journée, then le service rend « crépuscule »', () => {
        const milieu = new Date((t.sunset.getTime() + t.dusk.getTime()) / 2);
        expect(service().moment(LYON, milieu)).toBe('crépuscule');
        expect(service().moment(LYON, t.sunset)).toBe('crépuscule');
      });

      it('critère 4 : given une heure après la fin du crépuscule civil, when on demande le moment de la journée, then le service rend « nuit »', () => {
        expect(service().moment(LYON, t.dusk)).toBe('nuit');
        expect(service().moment(LYON, decale(t.dusk, 30))).toBe('nuit');
      });

      it('critère 4 : given une heure avant le début de l\'aube civile, when on demande le moment de la journée, then le service rend « nuit »', () => {
        expect(service().moment(LYON, decale(t.dawn, -1))).toBe('nuit');
        expect(service().moment(LYON, decale(t.dawn, -30))).toBe('nuit');
      });

      it('critère 5 : given l\'heure exacte du lever du soleil, when on demande le moment de la journée, then le service rend « jour »', () => {
        expect(service().moment(LYON, new Date(t.sunrise.getTime()))).toBe('jour');
      });
    });
  }
});
