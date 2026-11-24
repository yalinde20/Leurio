/*
 * US 20 : App Check en production sur le web (reCAPTCHA Enterprise), sur Android et iOS (plugin natif : Play Integrity,
 * App Attest) et jamais exigé sur les émulateurs, en développement ni dans les tests.
 * firebase/app-check est remplacé par un double qui note ce qui est construit : aucun appel réseau, aucun reCAPTCHA réel.
 */
export {};

interface Journal {
  construits: { classe: string; arg: unknown }[];
}
const { journal } = vi.hoisted(() => ({ journal: { construits: [] } as Journal }));

vi.mock('firebase/app-check', () => {
  const fab = (classe: string) =>
    class {
      constructor(public arg: unknown) {
        journal.construits.push({ classe, arg });
      }
    };
  return {
    CustomProvider: fab('CustomProvider'),
    ReCaptchaEnterpriseProvider: fab('ReCaptchaEnterpriseProvider'),
    ReCaptchaV3Provider: fab('ReCaptchaV3Provider'),
    initializeAppCheck: () => ({}),
  };
});

interface OptionsFournisseur {
  getToken: () => Promise<{ token: string; expireTimeMillis: number }>;
}
interface Contexte {
  natif: boolean;
  emulateurs: boolean;
  cleSite: string;
}
type Choisir = (contexte: Contexte, charger: () => Promise<unknown>) => { arg: OptionsFournisseur | string };

async function choisir(): Promise<Choisir> {
  const module = (await import('./app-check')) as unknown as { choisirFournisseurAppCheck: Choisir };
  return module.choisirFournisseurAppCheck;
}

/** Double du plugin natif : note chaque appel. */
function plugin(jeton: { token: string; expireTimeMillis?: number } = { token: 'jeton-natif', expireTimeMillis: 4_000_000_000_000 }) {
  const appels = { initialize: [] as unknown[], getToken: 0 };
  return {
    appels,
    initialize: async (options?: unknown) => {
      appels.initialize.push(options);
    },
    getToken: async () => {
      appels.getToken += 1;
      return jeton;
    },
  };
}

describe('choisirFournisseurAppCheck (US 20)', () => {
  beforeEach(() => {
    journal.construits.length = 0;
  });

  it('critère 1 : given la production sur le web, when le fournisseur est choisi, then c\'est reCAPTCHA Enterprise avec la clé de site et le plugin natif n\'est pas chargé', async () => {
    const choisirFournisseurAppCheck = await choisir();
    const charger = vi.fn(async () => plugin());
    choisirFournisseurAppCheck({ natif: false, emulateurs: false, cleSite: 'cle-web' }, charger);
    expect(journal.construits).toEqual([{ classe: 'ReCaptchaEnterpriseProvider', arg: 'cle-web' }]);
    expect(charger).not.toHaveBeenCalled();
  });

  it('critère 1 : given la production sur Android ou iOS, when le fournisseur est choisi, then c\'est un CustomProvider et aucun reCAPTCHA n\'est construit', async () => {
    const choisirFournisseurAppCheck = await choisir();
    choisirFournisseurAppCheck({ natif: true, emulateurs: false, cleSite: 'cle-web' }, async () => plugin());
    expect(journal.construits.map((c) => c.classe)).toEqual(['CustomProvider']);
  });

  it('critère 1 : given la production native, when App Check demande un jeton, then le plugin est initialisé avec le renouvellement automatique et le jeton natif est rendu', async () => {
    const choisirFournisseurAppCheck = await choisir();
    const double = plugin({ token: 'jeton-play-integrity', expireTimeMillis: 4_000_000_000_000 });
    const fournisseur = choisirFournisseurAppCheck({ natif: true, emulateurs: false, cleSite: 'k' }, async () => double);
    const { getToken } = fournisseur.arg as OptionsFournisseur;
    const jeton = await getToken();
    expect(double.appels.initialize).toEqual([{ isTokenAutoRefreshEnabled: true }]);
    expect(jeton).toEqual({ token: 'jeton-play-integrity', expireTimeMillis: 4_000_000_000_000 });
  });

  it('critère 1 : given la production native, when App Check demande plusieurs jetons, then le plugin n\'est initialisé qu\'une seule fois', async () => {
    const choisirFournisseurAppCheck = await choisir();
    const double = plugin();
    const fournisseur = choisirFournisseurAppCheck({ natif: true, emulateurs: false, cleSite: 'k' }, async () => double);
    const { getToken } = fournisseur.arg as OptionsFournisseur;
    await getToken();
    await getToken();
    await Promise.all([getToken(), getToken()]);
    expect(double.appels.initialize).toHaveLength(1);
    expect(double.appels.getToken).toBe(4);
  });

  it('critère 1 : given un jeton natif sans date d\'expiration, when App Check le demande, then le jeton rendu expire dans le futur', async () => {
    const choisirFournisseurAppCheck = await choisir();
    const double = plugin({ token: 'jeton-sans-date' });
    const fournisseur = choisirFournisseurAppCheck({ natif: true, emulateurs: false, cleSite: 'k' }, async () => double);
    const jeton = await (fournisseur.arg as OptionsFournisseur).getToken();
    expect(jeton.token).toBe('jeton-sans-date');
    expect(jeton.expireTimeMillis).toBeGreaterThan(Date.now());
  });

  it.each([
    ['sur le web', false],
    ['sur Android ou iOS', true],
  ])('critère 2 : given les émulateurs ou le développement %s, when le fournisseur est choisi, then c\'est le fournisseur local factice, sans plugin ni reCAPTCHA', async (_nom, natif) => {
    const choisirFournisseurAppCheck = await choisir();
    const charger = vi.fn(async () => plugin());
    const fournisseur = choisirFournisseurAppCheck({ natif, emulateurs: true, cleSite: '' }, charger);
    expect(journal.construits.map((c) => c.classe)).toEqual(['CustomProvider']);
    const jeton = await (fournisseur.arg as OptionsFournisseur).getToken();
    expect(jeton.token).toBe('jeton-app-check-local');
    expect(jeton.expireTimeMillis).toBeGreaterThan(Date.now());
    expect(charger).not.toHaveBeenCalled();
  });
});
