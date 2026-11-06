// US 64 : le relevé dit d'où viennent l'eau (station ou saisie) et pourquoi le débit manque. Doubles uniquement.
import { TestBed } from '@angular/core/testing';
import { ConditionsService } from './conditions.service';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
import { TemperatureEauService } from './temperature-eau.service';
import { Lieu, WeatherProvider } from './weather-provider';

const ANGERS: Lieu = { latitude: 47.47, longitude: -0.55 };
const MAINTENANT = new Date('2026-11-06T10:00:00Z');

function service(tempEau: unknown, debit: unknown) {
  TestBed.configureTestingModule({
    providers: [
      { provide: TemperatureEauService, useValue: { temperatureEauProche: vi.fn().mockResolvedValue(tempEau) } },
      { provide: HubeauService, useValue: { tendanceDebitProche: vi.fn().mockImplementation(() => (debit instanceof Error ? Promise.reject(debit) : Promise.resolve(debit))) } },
      { provide: WeatherProvider, useValue: { meteoPrevue: vi.fn().mockResolvedValue({ disponible: false }) } },
      { provide: MomentJourneeService, useValue: { moment: () => 'jour' } },
      { provide: GeoService, useValue: { departement: () => '49' } },
    ],
  });
  return TestBed.inject(ConditionsService);
}

const CAPTEUR = {
  statut: 'connue',
  source: 'capteur',
  tempEauC: 11.5,
  station: { code: 'S1', nom: 'La Maine à Angers' },
  distanceKm: 4,
  date: '2026-11-06',
  heure: '06:00:00',
};
const TENDANCE = { statut: 'tendance', tendance: 'normal', station: { code: 'H1', nom: 'La Maine' }, distanceKm: 5, debitActuelM3s: 1, debitMoyenM3s: 1, dateMesure: '2026-11-06' };

describe('ConditionsService : origine des données (US 64)', () => {
  it('given une eau mesurée par une station, when on demande le relevé, then stationEau donne son nom et sa distance et le débit n\'est pas absent', async () => {
    const releve = await service(CAPTEUR, TENDANCE).releve({ lieu: ANGERS, moment: MAINTENANT });
    expect(releve.stationEau).toEqual({ nom: 'La Maine à Angers', distanceKm: 4 });
    expect(releve.saisieA).toBeUndefined();
    expect(releve.debitAbsent).toBeUndefined();
  });

  it('given une eau estimée, when on demande le relevé, then ni station ni saisie', async () => {
    const releve = await service({ statut: 'connue', source: 'estimation', tempEauC: 9, moyenneAirC: 9, joursUtilises: 7 }, TENDANCE).releve({ lieu: ANGERS, moment: MAINTENANT });
    expect(releve.stationEau).toBeUndefined();
    expect(releve.saisieA).toBeUndefined();
  });

  it('given une saisie récente, when on demande le relevé, then saisieA donne l\'instant de la saisie', async () => {
    const mesureeA = new Date('2026-11-06T06:30:00Z');
    const releve = await service(CAPTEUR, TENDANCE).releve({ lieu: ANGERS, moment: MAINTENANT, saisieTempEau: { valeurC: 12.4, mesureeA } });
    expect(releve.saisieA).toEqual(mesureeA);
    expect(releve.stationEau).toBeUndefined();
  });

  it('given aucune station de débit, when on demande le relevé, then debitAbsent vaut « aucune station »', async () => {
    const releve = await service(CAPTEUR, { statut: 'aucune station' }).releve({ lieu: ANGERS, moment: MAINTENANT });
    expect(releve.debitAbsent).toBe('aucune station');
  });

  it('given Hub\'Eau indisponible ou qui rejette, when on demande le relevé, then debitAbsent vaut « Hub\'Eau indisponible »', async () => {
    const a = await service(CAPTEUR, { statut: "Hub'Eau indisponible" }).releve({ lieu: ANGERS, moment: MAINTENANT });
    expect(a.debitAbsent).toBe("Hub'Eau indisponible");
    TestBed.resetTestingModule();
    const b = await service(CAPTEUR, new Error('réseau')).releve({ lieu: ANGERS, moment: MAINTENANT });
    expect(b.debitAbsent).toBe("Hub'Eau indisponible");
  });
});
