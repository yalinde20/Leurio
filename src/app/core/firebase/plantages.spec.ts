/*
 * US 18 : remonter les plantages avec Crashlytics (PLAN §4, §10 phase 5). Tests avec des doubles : aucun test ne charge le
 * vrai plugin natif ni n'appelle un service réel.
 *
 * CONTRAT À IMPLÉMENTER
 * - src/app/core/firebase/plantages.ts exporte :
 *   - `interface PortPlantages { activerCollecte(actif: boolean): Promise<void>; enregistrer(erreur: { message: string; pile?: string }): Promise<void>;
 *       definirVersion(version: string): Promise<void>; envoyerRapportsEnAttente(): Promise<void> }` ;
 *   - `PLANTAGES : InjectionToken<PortPlantages>` (par défaut : l'implémentation réelle, qui enveloppe `FirebaseCrashlytics` de
 *     `@capacitor-firebase/crashlytics`, chargé à la demande, jamais dans le web) ;
 *   - `VERSION_APP : InjectionToken<string>` (par défaut : la version de package.json) ;
 *   - `creerPortPlantages(plugin: PluginCrashlytics, contexte: { natif: boolean; emulateurs: boolean }): PortPlantages`, la fabrique :
 *     actif seulement si `natif && !emulateurs`. Sinon le port est inerte : il n'appelle jamais `recordException`, `setCustomKey`,
 *     `sendUnsentReports`, ni `setEnabled({ enabled: true })`.
 *     `PluginCrashlytics` = { setEnabled({enabled}), recordException({message, stacktrace?}),
 *       setCustomKey({key, value, type: 'string'}), sendUnsentReports() } (sous-ensemble de FirebaseCrashlytics).
 *     Port actif : activerCollecte(a) -> setEnabled({enabled:a}) ; enregistrer -> recordException({message, stacktrace: pile}) ;
 *     definirVersion(v) -> setCustomKey({key:'version', value:v, type:'string'}) ; envoyerRapportsEnAttente -> sendUnsentReports().
 *     Aucune vérification de navigator.onLine : le SDK natif garde le rapport et l'envoie au lancement suivant avec du réseau.
 *   - `initialiserPlantages(port: PortPlantages, version: string): Promise<void>` : au lancement, active la collecte, définit la version
 *     et envoie les rapports en attente (appelée par un provideAppInitializer, sans jamais bloquer ni faire échouer le démarrage).
 * - src/app/core/firebase/gestionnaire-erreurs.ts exporte `GestionnaireErreurs implements ErrorHandler`, fourni dans app.config.ts
 *   (`{ provide: ErrorHandler, useClass: GestionnaireErreurs }`). Il lit PLANTAGES et VERSION_APP, nettoie le message et la pile
 *   (coordonnées décimales et adresses e-mail remplacées), pose la version puis enregistre. Jamais d'uid, jamais de setUserId.
 */
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig } from '../../app.config';
import { GestionnaireErreurs } from './gestionnaire-erreurs';
import { creerPortPlantages, initialiserPlantages, PLANTAGES, PluginCrashlytics, PortPlantages, VERSION_APP } from './plantages';

interface Journal {
  appels: string[];
  rapports: { message: string; pile?: string }[];
  versions: string[];
  collecte: boolean[];
  envois: number;
}

function portDouble(): { port: PortPlantages; j: Journal } {
  const j: Journal = { appels: [], rapports: [], versions: [], collecte: [], envois: 0 };
  const port: PortPlantages = {
    activerCollecte: async (a) => {
      j.appels.push('collecte');
      j.collecte.push(a);
    },
    enregistrer: async (e) => {
      j.appels.push('enregistrer');
      j.rapports.push(e);
    },
    definirVersion: async (v) => {
      j.appels.push('version');
      j.versions.push(v);
    },
    envoyerRapportsEnAttente: async () => {
      j.appels.push('envoi');
      j.envois++;
    },
  };
  return { port, j };
}

function pluginDouble() {
  const appels: { nom: string; arg?: unknown }[] = [];
  const plugin: PluginCrashlytics = {
    setEnabled: async (a: { enabled: boolean }) => void appels.push({ nom: 'setEnabled', arg: a }),
    recordException: async (a: { message: string; stacktrace?: string }) => void appels.push({ nom: 'recordException', arg: a }),
    setCustomKey: async (a: { key: string; value: string; type: 'string' }) => void appels.push({ nom: 'setCustomKey', arg: a }),
    sendUnsentReports: async () => void appels.push({ nom: 'sendUnsentReports' }),
  } as PluginCrashlytics;
  return { plugin, appels };
}

function gestionnaire(port: PortPlantages, version = '1.2.3'): ErrorHandler {
  TestBed.configureTestingModule({
    providers: [
      { provide: PLANTAGES, useValue: port },
      { provide: VERSION_APP, useValue: version },
      { provide: ErrorHandler, useClass: GestionnaireErreurs },
    ],
  });
  return TestBed.inject(ErrorHandler);
}

afterEach(() => TestBed.resetTestingModule());

describe('US 18 : plantages Crashlytics', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));

  it('US 18 critère 1 : given l\'app native en production, when une erreur non gérée survient, then un rapport est enregistré avec le message, la pile et la version de l\'app', async () => {
    const { plugin, appels } = pluginDouble();
    const port = creerPortPlantages(plugin, { natif: true, emulateurs: false });
    const h = gestionnaire(port, '1.2.3');

    const erreur = new Error('boum');
    h.handleError(erreur);
    await vi.waitFor(() => expect(appels.some((a) => a.nom === 'recordException')).toBe(true));

    const rapport = appels.find((a) => a.nom === 'recordException')?.arg as { message: string; stacktrace?: string };
    expect(rapport.message).toContain('boum');
    expect(rapport.stacktrace).toContain('Error');
    expect(appels).toContainEqual({ nom: 'setCustomKey', arg: { key: 'version', value: '1.2.3', type: 'string' } });
  });

  it('US 18 critère 1 : given une erreur non gérée, when elle est signalée, then la version est posée avant l\'enregistrement du rapport', async () => {
    const { port, j } = portDouble();
    gestionnaire(port, '4.5.6').handleError(new Error('x'));
    await vi.waitFor(() => expect(j.rapports).toHaveLength(1));
    expect(j.versions).toEqual(['4.5.6']);
    expect(j.appels.indexOf('version')).toBeLessThan(j.appels.indexOf('enregistrer'));
  });

  it('US 18 critère 1 : given un rejet de promesse non géré (valeur qui n\'est pas une Error), when il est signalé, then un rapport est enregistré', async () => {
    const { port, j } = portDouble();
    const h = gestionnaire(port);
    h.handleError('échec en texte');
    h.handleError({ code: 42 });
    await vi.waitFor(() => expect(j.rapports).toHaveLength(2));
    expect(j.rapports[0].message).toContain('échec en texte');
    expect(j.rapports[1].message.length).toBeGreaterThan(0);
  });

  it('US 18 critère 1 : given l\'app, when on lit sa configuration, then le gestionnaire d\'erreurs de Crashlytics y est fourni et la version de l\'app est un numéro de version', () => {
    const fournisseurs = (appConfig.providers as unknown[]).flat(Infinity) as { provide?: unknown; useClass?: unknown }[];
    expect(fournisseurs.some((p) => p?.provide === ErrorHandler && p?.useClass === GestionnaireErreurs)).toBe(true);
    TestBed.configureTestingModule({});
    expect(TestBed.inject(VERSION_APP)).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('US 18 critère 2 : given une erreur dont le message et la pile contiennent des coordonnées et une adresse e-mail, when le rapport est envoyé, then il ne contient ni latitude, ni longitude, ni e-mail', async () => {
    const { port, j } = portDouble();
    const erreur = new Error('Position 47.4712, -0.5518 refusée pour pecheur@exemple.fr (lat=47.4712&lng=-0.5518)');
    erreur.stack = 'Error: x\n at https://leurio.test/?latitude: 47.4712 longitude: -0.5518&mail=jean.dupont+x@mail.example.com';
    gestionnaire(port).handleError(erreur);
    await vi.waitFor(() => expect(j.rapports).toHaveLength(1));

    const tout = `${j.rapports[0].message}\n${j.rapports[0].pile ?? ''}`;
    expect(tout).not.toMatch(/47\.4712/);
    expect(tout).not.toMatch(/0\.5518/);
    expect(tout).not.toMatch(/@/);
    expect(tout).toContain('Position');
  });

  it('US 18 critère 2 : given un rapport, when il est envoyé, then l\'identifiant de compte n\'est jamais transmis (aucun setUserId, uid absent du rapport)', async () => {
    const { plugin, appels } = pluginDouble();
    (plugin as unknown as Record<string, unknown>)['setUserId'] = async (a: unknown) => void appels.push({ nom: 'setUserId', arg: a });
    const port = creerPortPlantages(plugin, { natif: true, emulateurs: false });
    await initialiserPlantages(port, '1.0.0');
    gestionnaire(port).handleError(new Error('uid-test-123 a planté'));
    await vi.waitFor(() => expect(appels.some((a) => a.nom === 'recordException')).toBe(true));
    expect(appels.some((a) => a.nom === 'setUserId')).toBe(false);
  });

  it('US 18 critère 2 : given une erreur sans coordonnée ni e-mail, when le rapport est envoyé, then son texte est transmis tel quel', async () => {
    const { port, j } = portDouble();
    gestionnaire(port).handleError(new Error('Version 1.2.3 introuvable, étape 3.5 sur 10'));
    await vi.waitFor(() => expect(j.rapports).toHaveLength(1));
    expect(j.rapports[0].message).toContain('Version 1.2.3 introuvable');
  });

  it('US 18 critère 3 : given l\'app en développement ou dans les tests (émulateurs), when une erreur non gérée survient, then aucun rapport n\'est envoyé et la collecte reste désactivée', async () => {
    const { plugin, appels } = pluginDouble();
    const port = creerPortPlantages(plugin, { natif: true, emulateurs: true });
    await initialiserPlantages(port, '1.0.0');
    gestionnaire(port).handleError(new Error('boum'));
    await new Promise((r) => setTimeout(r, 20));
    expect(appels.filter((a) => a.nom !== 'setEnabled')).toEqual([]);
    expect(appels.filter((a) => a.nom === 'setEnabled').every((a) => (a.arg as { enabled: boolean }).enabled === false)).toBe(true);
  });

  it('US 18 critère 3 : given l\'app web (non native) même en production, when une erreur non gérée survient, then aucun rapport n\'est envoyé', async () => {
    const { plugin, appels } = pluginDouble();
    const port = creerPortPlantages(plugin, { natif: false, emulateurs: false });
    await initialiserPlantages(port, '1.0.0');
    gestionnaire(port).handleError(new Error('boum'));
    await new Promise((r) => setTimeout(r, 20));
    expect(appels.filter((a) => a.nom !== 'setEnabled')).toEqual([]);
    expect(appels.some((a) => a.nom === 'setEnabled' && (a.arg as { enabled: boolean }).enabled)).toBe(false);
  });

  it('US 18 critère 3 : given les tests (émulateurs), when le port par défaut est injecté, then il est inerte et ne charge pas le plugin natif', async () => {
    TestBed.configureTestingModule({});
    const port = TestBed.inject(PLANTAGES);
    await expect(port.enregistrer({ message: 'x' })).resolves.toBeUndefined();
    await expect(initialiserPlantages(port, '1.0.0')).resolves.toBeUndefined();
  });

  it('US 18 critère 4 : given l\'app native sans réseau, when elle plante, then le rapport est quand même enregistré auprès du SDK (qui l\'envoie au lancement suivant)', async () => {
    const { plugin, appels } = pluginDouble();
    const port = creerPortPlantages(plugin, { natif: true, emulateurs: false });
    const enLigne = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      gestionnaire(port).handleError(new Error('plantage hors ligne'));
      await vi.waitFor(() => expect(appels.some((a) => a.nom === 'recordException')).toBe(true));
    } finally {
      enLigne.mockRestore();
    }
  });

  it('US 18 critère 4 : given l\'app native en production, when elle se lance (avec du réseau), then la collecte est activée, la version posée et les rapports en attente sont envoyés', async () => {
    const { plugin, appels } = pluginDouble();
    const port = creerPortPlantages(plugin, { natif: true, emulateurs: false });
    await initialiserPlantages(port, '1.2.3');
    expect(appels).toContainEqual({ nom: 'setEnabled', arg: { enabled: true } });
    expect(appels).toContainEqual({ nom: 'setCustomKey', arg: { key: 'version', value: '1.2.3', type: 'string' } });
    expect(appels.some((a) => a.nom === 'sendUnsentReports')).toBe(true);
  });

  it('US 18 critère 4 : given un lancement où le plugin échoue, when l\'initialisation s\'exécute, then elle ne fait pas échouer le démarrage', async () => {
    const { port } = portDouble();
    port.activerCollecte = async () => {
      throw new Error('plugin indisponible');
    };
    await expect(initialiserPlantages(port, '1.0.0')).resolves.toBeUndefined();
  });
});
