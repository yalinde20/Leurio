import { TestBed } from '@angular/core/testing';
import { ChoixTheme, ThemeService } from './theme.service';

const CLE = 'leurio.theme';

/** Double de window.matchMedia('(prefers-color-scheme: dark)') que le test pilote comme le téléphone. */
function telephone(sombre: boolean) {
  let ecouteurs: ((e: { matches: boolean }) => void)[] = [];
  const etat = { sombre };
  const mql = {
    get matches() { return etat.sombre; },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, f: (e: { matches: boolean }) => void) => { ecouteurs.push(f); },
    removeEventListener: (_: string, f: (e: { matches: boolean }) => void) => { ecouteurs = ecouteurs.filter((x) => x !== f); },
    addListener: (f: (e: { matches: boolean }) => void) => { ecouteurs.push(f); },
    removeListener: (f: (e: { matches: boolean }) => void) => { ecouteurs = ecouteurs.filter((x) => x !== f); },
    dispatchEvent: () => true,
    onchange: null,
  };
  vi.stubGlobal('matchMedia', (q: string) => ({ ...mql, get matches() { return q.includes('dark') ? etat.sombre : !etat.sombre; }, media: q }));
  return {
    passeEn(sombre: boolean) {
      etat.sombre = sombre;
      ecouteurs.slice().forEach((f) => f({ matches: sombre }));
    },
  };
}

const themeApplique = () => document.documentElement.getAttribute('data-theme');

/** Démarre l'app : une instance neuve du service, comme à un lancement. */
function lancer(): ThemeService {
  TestBed.resetTestingModule();
  const service = TestBed.inject(ThemeService);
  TestBed.tick();
  return service;
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  });

  it('critère 0 : given un premier lancement de l\'app, when on lit le choix de thème, then il vaut « système » et le thème suit le téléphone', () => {
    telephone(true);
    const service = lancer();
    expect(service.choix()).toBe<ChoixTheme>('systeme');
    expect(themeApplique()).toBeNull();
  });

  it('critère 1 : given un téléphone en mode sombre, when on choisit le thème clair, then le thème clair s\'applique aussitôt', () => {
    telephone(true);
    const service = lancer();
    service.choisir('clair');
    expect(service.choix()).toBe('clair');
    expect(themeApplique()).toBe('clair');
    expect(localStorage.getItem(CLE)).toBe('clair');
  });

  it('critère 2 : given un téléphone en mode clair, when on choisit le thème sombre, then le thème sombre s\'applique aussitôt', () => {
    telephone(false);
    const service = lancer();
    service.choisir('sombre');
    expect(service.choix()).toBe('sombre');
    expect(themeApplique()).toBe('sombre');
    expect(localStorage.getItem(CLE)).toBe('sombre');
  });

  it('critère 3 : given le thème forcé en clair, when le téléphone change de mode, then le thème reste clair', () => {
    const tel = telephone(false);
    const service = lancer();
    service.choisir('clair');
    tel.passeEn(true);
    TestBed.tick();
    expect(service.choix()).toBe('clair');
    expect(themeApplique()).toBe('clair');
    tel.passeEn(false);
    TestBed.tick();
    expect(themeApplique()).toBe('clair');
  });

  it('critère 4 : given le thème forcé en sombre, when on revient au choix « système », then le thème suit de nouveau le réglage du téléphone, sans recharger', () => {
    const tel = telephone(false);
    const service = lancer();
    service.choisir('sombre');
    expect(themeApplique()).toBe('sombre');

    service.choisir('systeme');
    TestBed.tick();
    expect(service.choix()).toBe('systeme');
    expect(themeApplique()).toBeNull(); // plus rien de forcé : les tokens suivent prefers-color-scheme
    expect(localStorage.getItem(CLE)).toBe('systeme');

    tel.passeEn(true);
    TestBed.tick();
    expect(themeApplique()).toBeNull();
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(true);
  });

  it('critère 5 : given le thème forcé en sombre, when on relance l\'app sur un téléphone en mode clair, then le thème sombre est appliqué dès le premier affichage', () => {
    telephone(false);
    localStorage.setItem(CLE, 'sombre');
    const service = lancer();
    expect(service.choix()).toBe('sombre');
    expect(themeApplique()).toBe('sombre');
  });

  for (const illisible of ['violet', '', 'null', '{"theme":"sombre"}', 'SOMBRE', 'undefined']) {
    it(`critère 6 : given un choix de thème enregistré illisible ou inconnu (« ${illisible} »), when on lance l'app, then le choix vaut « système »`, () => {
      telephone(false);
      localStorage.setItem(CLE, illisible);
      const service = lancer();
      expect(service.choix()).toBe('systeme');
      expect(themeApplique()).toBeNull();
    });
  }

  it('critère 6 : given un stockage local qui refuse la lecture, when on lance l\'app, then le choix vaut « système »', () => {
    telephone(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    const service = lancer();
    expect(service.choix()).toBe('systeme');
    expect(themeApplique()).toBeNull();
  });

  it('given un stockage local qui refuse l\'écriture, when on choisit un thème, then il s\'applique quand même pour la session', () => {
    telephone(false);
    const service = lancer();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => service.choisir('sombre')).not.toThrow();
    expect(service.choix()).toBe('sombre');
    expect(themeApplique()).toBe('sombre');
  });

  describe('couleur de la barre d\'état (theme-color)', () => {
    const CLAIR = '#f8f8f8';
    const SOMBRE = '#1f1f1f';
    const barres = () => ({
      clair: document.querySelector('meta[name="theme-color"][media*="light"]')!.getAttribute('content'),
      sombre: document.querySelector('meta[name="theme-color"][media*="dark"]')!.getAttribute('content'),
    });
    beforeEach(() => {
      document.head.insertAdjacentHTML(
        'beforeend',
        `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${CLAIR}">` +
          `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${SOMBRE}">`,
      );
    });

    it('given un thème forcé, when on le choisit, then les deux balises prennent la couleur de ce thème', () => {
      telephone(false);
      const service = lancer();
      service.choisir('sombre');
      expect(barres()).toEqual({ clair: SOMBRE, sombre: SOMBRE });
      service.choisir('clair');
      expect(barres()).toEqual({ clair: CLAIR, sombre: CLAIR });
    });

    it('given un thème forcé, when on revient à « système », then les couleurs d\'origine sont restaurées', () => {
      telephone(false);
      const service = lancer();
      service.choisir('sombre');
      service.choisir('systeme');
      expect(barres()).toEqual({ clair: CLAIR, sombre: SOMBRE });
    });

    it('given des balises déjà forcées par le script de index.html, when le service démarre puis revient à « système », then les couleurs d\'origine sont restaurées', () => {
      telephone(false);
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
        m.setAttribute('data-origine', m.getAttribute('content')!);
        m.setAttribute('content', SOMBRE);
      });
      localStorage.setItem(CLE, 'sombre');
      const service = lancer();
      expect(barres()).toEqual({ clair: SOMBRE, sombre: SOMBRE });
      service.choisir('systeme');
      expect(barres()).toEqual({ clair: CLAIR, sombre: SOMBRE });
    });

    it('given des balises déjà forcées en sombre par le script de index.html, when on choisit le thème clair, then les deux balises prennent la couleur claire d\'origine', () => {
      telephone(false);
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
        m.setAttribute('data-origine', m.getAttribute('content')!);
        m.setAttribute('content', SOMBRE);
      });
      localStorage.setItem(CLE, 'sombre');
      const service = lancer();
      service.choisir('clair');
      expect(barres()).toEqual({ clair: CLAIR, sombre: CLAIR });
    });
  });
});
