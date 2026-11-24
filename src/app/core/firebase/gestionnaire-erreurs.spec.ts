import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GestionnaireErreurs, nettoyer } from './gestionnaire-erreurs';
import { BUILD_APP, creerPortPlantages, initialiserPlantages, PLANTAGES, PluginCrashlytics, PortPlantages, VERSION_APP } from './plantages';

describe('US 18 critère 2 : nettoyage des rapports', () => {
  it.each([
    ['?latitude=47.47&longitude=-0.55', /47\.47|0\.55/],
    ['lat=47.5&lng=-0.5&lon=2', /47\.5|0\.5|=2/],
    ['{"latitude":47,"longitude":-1}', /47|-1/],
    ['bbox=-0.6,47.4,-0.5,47.5', /47\.4|0\.6|0\.5/],
    ['jean%40exemple.fr', /exemple/],
    ['jean@exemple.fr', /exemple/],
    ['users/AbC123xyz/spots/s1', /AbC123xyz/],
    ['users%2FAbC123xyz%2Fphotos', /AbC123xyz/],
  ])('given « %s », when on nettoie, then les données personnelles disparaissent', (texte, interdit) => {
    expect(nettoyer(texte)).not.toMatch(interdit);
  });

  it('given un texte sans donnée personnelle, when on nettoie, then il est inchangé', () => {
    expect(nettoyer('Version 1.2.3 introuvable, latitude absente')).toBe('Version 1.2.3 introuvable, latitude absente');
  });

  it('given un chemin encodé avec une suite, when on nettoie, then seul l\'identifiant disparaît', () => {
    expect(nettoyer('users%2FAbC%2Fspots%2Fs.jpg')).toBe('users%2F[uid]%2Fspots%2Fs.jpg');
  });

  it('given users/<uid>, when on nettoie, then le chemin garde sa forme', () => {
    expect(nettoyer('users/abc/spots')).toBe('users/[uid]/spots');
  });

  function gestionnaire(): { h: ErrorHandler; rapports: { message: string; pile?: string }[] } {
    const rapports: { message: string; pile?: string }[] = [];
    const port: PortPlantages = {
      activerCollecte: async () => undefined,
      enregistrer: async (e) => void rapports.push(e),
      definirVersion: async () => undefined,
      envoyerRapportsEnAttente: async () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: PLANTAGES, useValue: port },
        { provide: VERSION_APP, useValue: '1.0.0' },
        { provide: ErrorHandler, useClass: GestionnaireErreurs },
      ],
    });
    return { h: TestBed.inject(ErrorHandler), rapports };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('given une HttpErrorResponse dont l\'url porte une position, when elle est signalée, then le rapport n\'a ni position ni uid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { h, rapports } = gestionnaire();
    h.handleError(new HttpErrorResponse({ status: 500, url: 'https://api.test/f?latitude=47.47&longitude=-0.55&u=users/uid-secret/x' }));
    await vi.waitFor(() => expect(rapports).toHaveLength(1));
    expect(rapports[0].message).not.toMatch(/47\.47|0\.55|uid-secret/);
  });

  it('given une valeur impossible à lire (objet circulaire sans prototype), when elle est signalée, then handleError ne lève rien', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { h } = gestionnaire();
    const o = Object.create(null) as Record<string, unknown>;
    o['self'] = o;
    expect(() => h.handleError(o)).not.toThrow();
  });
});

describe('US 18 : clé « build » des rapports', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('given un build identifié, when une erreur est signalée, then le rapport porte la clé « build » avant l\'enregistrement', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const appels: string[] = [];
    const port: PortPlantages = {
      activerCollecte: async () => undefined,
      enregistrer: async () => void appels.push('enregistrer'),
      definirVersion: async () => void appels.push('version'),
      definirBuild: async (b) => void appels.push(`build:${b}`),
      envoyerRapportsEnAttente: async () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: PLANTAGES, useValue: port },
        { provide: BUILD_APP, useValue: '1970163 · 2026-11-24' },
        { provide: ErrorHandler, useClass: GestionnaireErreurs },
      ],
    });
    TestBed.inject(ErrorHandler).handleError(new Error('x'));
    await vi.waitFor(() => expect(appels).toContain('enregistrer'));
    expect(appels.indexOf('build:1970163 · 2026-11-24')).toBeGreaterThanOrEqual(0);
    expect(appels.indexOf('build:1970163 · 2026-11-24')).toBeLessThan(appels.indexOf('enregistrer'));
  });

  it('given le port natif de production, when on pose le build, then la clé « build » est posée comme texte', async () => {
    const appels: unknown[] = [];
    const plugin: PluginCrashlytics = {
      setEnabled: async () => undefined,
      recordException: async () => undefined,
      setCustomKey: async (a) => void appels.push(a),
      sendUnsentReports: async () => undefined,
    };
    await initialiserPlantages(creerPortPlantages(plugin, { natif: true, emulateurs: false }), '0.0.0', 'abc1234 · 2026-11-24');
    expect(appels).toContainEqual({ key: 'build', value: 'abc1234 · 2026-11-24', type: 'string' });
    expect(appels).toContainEqual({ key: 'version', value: '0.0.0', type: 'string' });
  });
});
