import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { appConfig } from './app.config';
import { SOURCE_COMPTE, SourceCompte } from './core/data/compte.service';
import { SOURCE_PROFIL } from './core/data/profil.service';
import { ANALYTICS, PortAnalytics } from './core/firebase/mesure-audience';

async function demarrer(stocke: { analytics: boolean; video: boolean } | null) {
  const appels: string[] = [];
  const evenements: string[] = [];
  const port: PortAnalytics = {
    initialiser: async () => void appels.push('initialiser'),
    envoyer: async (nom) => void evenements.push(nom),
    desactiver: async () => void appels.push('desactiver'),
  };
  const compte: SourceCompte = {
    uidCourant: async () => 'uid-test-123',
    connecterAnonymement: async () => 'uid-test-123',
    profilExiste: async () => true,
    ecrireProfil: async () => undefined,
  };
  TestBed.configureTestingModule({
    providers: [
      ...(appConfig.providers as never[]),
      { provide: ANALYTICS, useValue: port },
      { provide: SOURCE_COMPTE, useValue: compte },
      { provide: SOURCE_PROFIL, useValue: { mettreAJour: async () => undefined, lireConsentements: async () => stocke } },
    ],
  });
  await TestBed.inject(ApplicationInitStatus).donePromise;
  await TestBed.inject(Router).navigateByUrl('/');
  await new Promise<void>((r) => setTimeout(r, 20));
  return { appels, evenements };
}

describe('US 19 : démarrage d\'Analytics', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('US 19 critère 1 : given aucune réponse sur Analytics, when l\'app démarre et navigue, then Analytics n\'est jamais initialisé et aucun événement n\'est envoyé', async () => {
    const { appels, evenements } = await demarrer(null);
    expect(appels).toEqual([]);
    expect(evenements).toEqual([]);
  });

  it('US 19 critère 5 : given un refus enregistré sur le compte par un autre appareil, when l\'app s\'ouvre ici avec le même compte, then Analytics n\'est pas initialisé', async () => {
    const { appels, evenements } = await demarrer({ analytics: false, video: false });
    expect(appels).toEqual([]);
    expect(evenements).toEqual([]);
  });

  it('US 19 critère 2 : given Analytics accepté dans le compte, when l\'app démarre et navigue, then Analytics est initialisé et screen_view est envoyé', async () => {
    const { appels, evenements } = await demarrer({ analytics: true, video: false });
    expect(appels).toEqual(['initialiser']);
    expect(evenements).toContain('screen_view');
  });
});
