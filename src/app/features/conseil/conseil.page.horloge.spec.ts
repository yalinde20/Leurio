/*
 * US 295 : « Maintenant » avance avec l'horloge. L'état réglementaire est recalculé chaque minute, à la reprise de l'app
 * (visibilitychange) et au retour du détail ; franchir la fin des heures légales remplace les coups par l'avertissement.
 * Heures légales du double AstroService : 7 h 02 – 18 h 31 à Paris (6 h 02 – 17 h 31 UTC).
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';
import { compact, stabiliser } from './conseil.page.aides';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-09T06:32:00Z'), coucher: new Date('2026-11-09T17:01:00Z') };
const CONDITIONS: Conditions = {
  tempEau: 11.5, sourceTempEau: 'capteur', debitTendance: 'normal', pressionTendance48h: -8, nuages: 80, vent: 12,
  moment: 'jour', saison: 'automne', categorie: null, departement: '49', niveau: 'debutant',
};
const RELEVE: ReleveActuel = { conditions: CONDITIONS, pressionHpa: 1012, moinsPrecis: false };
const conseil: Conseil = { typeId: 'shad', techniqueId: 'tiree', especeCode: 'SAN', score: 9, pourquoi: [], couleur: 'gardon', taille: { valeur: 8, unite: 'cm' } };

const MINUTE = 60_000;
const heure = (hhmm: string) => new Date(`2026-11-09T${hhmm}${hhmm.length === 5 ? ':00' : ''}Z`);

async function afficher(maintenant: Date) {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(maintenant);
  const appelsSoleil: Date[] = [];
  const appelsMoteur: Date[] = [];
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      {
        provide: CatalogService,
        useValue: {
          federation: async () => undefined,
          typesDeLeurres: async () => [{ id: 'shad', nom: 'Shad' }] as TypeLeurre[],
          animations: async () => [{ id: 'tiree', nom: 'Tirée-relâchée' }] as Animation[],
          couleurs: async () => [{ id: 'gardon', nom: 'Gardon' }] as Couleur[],
        },
      },
      { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
      {
        provide: AstroService,
        useValue: {
          soleil: (_l: unknown, jour: Date): SoleilDuJour => {
            appelsSoleil.push(jour);
            return SOLEIL;
          },
          lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async () => {
            appelsMoteur.push(new Date());
            return { conseils: [conseil], explications: [] };
          },
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  await stabiliser(fixture);
  const page = fixture.nativeElement as HTMLElement;
  const avancer = async (ms: number) => {
    vi.advanceTimersByTime(ms);
    await stabiliser(fixture);
  };
  const etat = () => compact(page.querySelector('button.etat')?.textContent);
  return { fixture, page, avancer, etat, appelsSoleil, appelsMoteur };
}

afterEach(() => vi.useRealTimers());

describe('ConseilPage : « Maintenant » suit l\'horloge (US 295)', () => {
  it('given « Pêche ouverte », when les minutes passent, then la ligne passe à « Fermeture à 18 h 31, dans N min » sous les 30 min', async () => {
    const env = await afficher(heure('16:50'));
    expect(env.etat()).toBe(compact("Pêche ouverte jusqu'à 18 h 31"));

    await env.avancer(30 * MINUTE); // 17 h 20 UTC : fin 17 h 31, dans 11 min

    expect(env.etat()).toBe(compact('Fermeture à 18 h 31, dans 11 min'));
    expect(env.page.querySelector('button.etat [data-icone="alerte"]')).not.toBeNull();
    expect(env.page.querySelector('a.coup')).not.toBeNull();
  });

  it('given la dernière minute, when elle approche de zéro, then la ligne dit « dans moins d\'1 min »', async () => {
    const env = await afficher(heure('17:29:40'));

    await env.avancer(MINUTE); // 17 h 30 min 40 s : 20 s avant la fin

    expect(env.etat()).toBe(compact("Fermeture à 18 h 31, dans moins d'1 min"));
  });

  it('given « Maintenant » dans les heures légales, when la fin est franchie, then les coups disparaissent, la ligne dit « Pêche fermée » et l\'alerte donne les heures de demain', async () => {
    const env = await afficher(heure('17:25'));
    expect(env.page.querySelector('a.coup')).not.toBeNull();

    await env.avancer(10 * MINUTE); // 17 h 35 UTC, après la fin (17 h 31)

    expect(env.page.querySelector('a.coup')).toBeNull();
    expect(env.etat()).toContain(compact("Pêche fermée jusqu'à 7 h 02"));
    expect(env.page.querySelector('button.etat [data-icone="lune"]')).not.toBeNull();
    const alerte = compact(env.page.querySelector('[role="alert"]')?.textContent);
    expect(alerte).toContain(compact('Hors des heures légales'));
    expect(alerte).toContain(compact('Heures légales demain : 7 h 02 – 18 h 31'));
  });

  it('given l\'app en veille, when elle revient au premier plan (visibilitychange), then l\'état est recalculé sans attendre la minute', async () => {
    const env = await afficher(heure('17:25'));
    vi.setSystemTime(heure('17:40')); // l'horloge a avancé pendant la veille, sans que le minuteur ne tourne

    document.dispatchEvent(new Event('visibilitychange'));
    await stabiliser(env.fixture);

    expect(env.page.querySelector('a.coup')).toBeNull();
    expect(compact(env.page.querySelector('[role="alert"]')?.textContent)).toContain(compact('Hors des heures légales'));
  });

  it('given « Maintenant » avant l\'ouverture, when l\'ouverture est franchie, then le conseil est calculé et les coups apparaissent', async () => {
    const env = await afficher(heure('05:50'));
    expect(env.page.querySelector('a.coup')).toBeNull();
    expect(env.etat()).toContain(compact("Pêche fermée jusqu'à 7 h 02"));
    const avant = env.appelsMoteur.length;

    await env.avancer(20 * MINUTE); // 6 h 10 UTC, après l'ouverture (6 h 02)

    expect(env.appelsMoteur.length).toBeGreaterThan(avant);
    expect(env.page.querySelector('a.coup')).not.toBeNull();
    expect(env.etat()).toContain(compact("Pêche ouverte jusqu'à 18 h 31"));
  });

  it('given un moment choisi, when les minutes passent, then rien n\'est recalculé', async () => {
    const env = await afficher(heure('16:50'));
    TestBed.inject((await import('./conseil-choix.store')).ConseilChoixStore).moment.set({ date: heure('17:10'), libelle: 'Aujourd\'hui 18 h', mention: 'aujourd\'hui 18 h' });
    const appels = env.appelsSoleil.length;

    await env.avancer(45 * MINUTE);

    expect(env.appelsSoleil.length).toBe(appels);
  });

  it('given l\'écran détruit, when les minutes passent, then le minuteur est arrêté', async () => {
    const env = await afficher(heure('16:50'));
    env.fixture.destroy();
    const appels = env.appelsSoleil.length;

    vi.advanceTimersByTime(10 * MINUTE);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(env.appelsSoleil.length).toBe(appels);
  });
});
