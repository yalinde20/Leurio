// US 60 : une source qui rejette est traitée comme indisponible, les conditions sont quand même rendues (PLAN §4).
import { TestBed } from '@angular/core/testing';
import { ConditionsService } from './conditions.service';
import { GeoService } from './geo.service';
import { HubeauService } from './hubeau.service';
import { MomentJourneeService } from './moment-journee.service';
import { TemperatureEauService } from './temperature-eau.service';
import { WeatherProvider } from './weather-provider';

describe('ConditionsService, sources en panne', () => {
  it('given trois sources qui rejettent, when on demande les conditions, then elles sont rendues avec des valeurs nulles et un débit inconnu', async () => {
    const panne = vi.fn().mockRejectedValue(new Error('panne'));
    TestBed.configureTestingModule({
      providers: [
        { provide: TemperatureEauService, useValue: { temperatureEauProche: panne } },
        { provide: HubeauService, useValue: { tendanceDebitProche: panne } },
        { provide: WeatherProvider, useValue: { meteoPrevue: panne } },
        { provide: MomentJourneeService, useValue: { moment: () => 'nuit' } },
        { provide: GeoService, useValue: { departement: () => '49' } },
      ],
    });
    const conditions = await TestBed.inject(ConditionsService).conditions({
      lieu: { latitude: 47.47, longitude: -0.55 },
      moment: new Date('2026-11-06T22:00:00Z'),
    });
    expect(conditions).toEqual({
      tempEau: null,
      sourceTempEau: null,
      debitTendance: 'inconnu',
      pressionTendance48h: null,
      nuages: null,
      vent: null,
      moment: 'nuit',
      saison: 'automne',
      categorie: null,
      departement: '49',
      niveau: 'debutant',
    });
  });

  it('given un moment invalide, when on demande les conditions, then elles sont rendues pour maintenant', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-15T12:00:00Z'));
    try {
      const meteoPrevue = vi.fn().mockResolvedValue({ disponible: false });
      const temperatureEauProche = vi.fn().mockResolvedValue({ statut: "température de l'eau inconnue" });
      TestBed.configureTestingModule({
        providers: [
          { provide: TemperatureEauService, useValue: { temperatureEauProche } },
          { provide: HubeauService, useValue: { tendanceDebitProche: vi.fn().mockResolvedValue({ statut: 'aucune station' }) } },
          { provide: WeatherProvider, useValue: { meteoPrevue } },
          { provide: MomentJourneeService, useValue: { moment: () => 'jour' } },
          { provide: GeoService, useValue: { departement: () => '49' } },
        ],
      });
      const lieu = { latitude: 47.47, longitude: -0.55 };
      const conditions = await TestBed.inject(ConditionsService).conditions({ lieu, moment: new Date('') });
      expect(conditions.saison).toBe('hiver');
      expect(meteoPrevue).toHaveBeenCalledWith(lieu, new Date('2027-01-15T12:00:00Z'));
      expect(temperatureEauProche).toHaveBeenCalledWith(lieu, new Date('2027-01-15T12:00:00Z'));
    } finally {
      vi.useRealTimers();
    }
  });
});
