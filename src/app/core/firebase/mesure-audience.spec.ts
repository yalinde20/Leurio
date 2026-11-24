import type { FirebaseApp } from 'firebase/app';
import { creerPortAnalytics, ModuleAnalytics } from './mesure-audience';

function preparer(contexte: { emulateurs: boolean; measurementId?: string }, supporte = true) {
  const appels: unknown[][] = [];
  const module: ModuleAnalytics = {
    isSupported: async () => supporte,
    initializeAnalytics: (...args: unknown[]) => (appels.push(['initializeAnalytics', ...args]), 'analytics'),
    setAnalyticsCollectionEnabled: (...args: unknown[]) => void appels.push(['collecte', ...args]),
    logEvent: (...args: unknown[]) => void appels.push(['logEvent', ...args]),
  };
  const charger = vi.fn(async () => ({ module, app: 'app' as unknown as FirebaseApp }));
  return { port: creerPortAnalytics(contexte, charger), appels, charger };
}

describe('US 19 : port Analytics', () => {
  it('given les émulateurs, when on l\'utilise, then rien n\'est chargé', async () => {
    const { port, charger, appels } = preparer({ emulateurs: true, measurementId: 'G-X' });
    await port.initialiser();
    await port.envoyer('a', {});
    await port.desactiver();
    expect(charger).not.toHaveBeenCalled();
    expect(appels).toEqual([]);
  });

  it('given aucun identifiant de mesure, when on l\'initialise, then rien n\'est chargé', async () => {
    const { port, charger } = preparer({ emulateurs: false });
    await port.initialiser();
    expect(charger).not.toHaveBeenCalled();
  });

  it('given un build réel, when on initialise puis envoie puis désactive, then Analytics est configuré sans signaux Google et chargé une seule fois', async () => {
    const { port, appels, charger } = preparer({ emulateurs: false, measurementId: 'G-X' });
    expect(charger).not.toHaveBeenCalled();
    await port.initialiser();
    await port.initialiser();
    await port.envoyer('spot_ajoute', { departement: '49' });
    await port.desactiver();
    expect(charger).toHaveBeenCalledTimes(1);
    expect(appels).toEqual([
      ['initializeAnalytics', 'app', { config: { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false } }],
      ['collecte', 'analytics', true],
      ['collecte', 'analytics', true],
      ['logEvent', 'analytics', 'spot_ajoute', { departement: '49' }],
      ['collecte', 'analytics', false],
    ]);
  });

  it('given un navigateur non pris en charge, when on initialise, then rien n\'est envoyé et rien n\'échoue', async () => {
    const { port, appels } = preparer({ emulateurs: false, measurementId: 'G-X' }, false);
    await port.initialiser();
    await port.envoyer('a', {});
    expect(appels).toEqual([]);
  });

  it('given un chargement en échec, when on initialise, then l\'erreur est journalisée sans être relancée', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const port = creerPortAnalytics({ emulateurs: false, measurementId: 'G-X' }, () => Promise.reject(new Error('réseau')));
    await expect(port.initialiser()).resolves.toBeUndefined();
    expect(erreur).toHaveBeenCalled();
    erreur.mockRestore();
  });
});
