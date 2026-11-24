import { ApplicationInitStatus, ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig } from './app.config';
import { BUILD_APP, PLANTAGES, PortPlantages, VERSION_APP } from './core/firebase/plantages';

describe('US 18 : démarrage de Crashlytics', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('US 18 critère 4 : given l\'app native en production, when elle démarre, then la collecte est activée et les rapports en attente sont envoyés', async () => {
    const appels: string[] = [];
    const port: PortPlantages = {
      activerCollecte: async (a) => void appels.push(`collecte:${a}`),
      enregistrer: async () => undefined,
      definirVersion: async (v) => void appels.push(`version:${v}`),
      definirBuild: async (b) => void appels.push(`build:${b}`),
      envoyerRapportsEnAttente: async () => void appels.push('envoi'),
    };
    TestBed.configureTestingModule({
      providers: [
        ...(appConfig.providers as never[]),
        { provide: PLANTAGES, useValue: port },
        { provide: VERSION_APP, useValue: '1.2.3' },
        { provide: BUILD_APP, useValue: 'abc1234 · 2026-11-24' },
      ],
    });
    TestBed.inject(ErrorHandler);
    await TestBed.inject(ApplicationInitStatus).donePromise;
    await vi.waitFor(() =>
      expect(appels).toEqual(['collecte:true', 'version:1.2.3', 'build:abc1234 · 2026-11-24', 'envoi']),
    );
  });
});
