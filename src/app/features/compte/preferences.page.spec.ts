/*
 * US 93 : modifier mes espèces favorites, mon niveau et mes unités depuis Compte (PLAN §3, §4, §7).
 * Maquette validée : docs/maquettes/us-93-preferences.html. Décisions du propriétaire : A1 (groupe « Réglages »), U1 (unités sur l'appareil
 * seulement), I1 (voir unites.ecrans.spec.ts pour l'affichage des unités dans les écrans).
 *
 * Fichiers et symboles attendus (à créer) :
 *  - src/app/features/compte/preferences.page.ts : `PreferencesPage`, route enfant de l'onglet Compte : `compte/preferences`
 *    (déclarée dans src/app/app.routes.ts comme `theme`). Titre « Préférences », bouton retour « Compte ».
 *  - src/app/core/data/profil.service.ts : `SOURCE_PROFIL` (InjectionToken, providedIn root, fabrique Firebase) de type
 *      interface SourceProfil { mettreAJour(uid: string, champs: Partial<Pick<UserDoc, 'niveau' | 'especesFavorites'>>): Promise<void> }
 *    Écrit seulement ces champs dans users/{uid} (updateDoc). La promesse se résout à l'accusé du serveur : tant qu'elle est en cours,
 *    l'écriture est « en attente » (hors ligne le cache persistant la garde et l'envoie au retour du réseau). Le double des tests
 *    en contrôle la résolution. L'uid vient de `SOURCE_COMPTE.uidCourant()` ; sans compte (`null`), aucune écriture.
 *  - src/app/features/compte/compte.page.ts : le groupe « Affichage » devient « Réglages » (décision A1) avec, dans l'ordre,
 *    « Préférences » (sous-texte « Espèces, niveau, unités », chevron, lien vers `/compte/preferences`) puis « Thème ».
 * Contrat du DOM de PreferencesPage : une case (`input[type=checkbox]` ou `role="checkbox"` + `aria-checked`) par espèce du CatalogService,
 * dans l'ordre du contenu, nommée par le nom de l'espèce ; des radios (`input[type=radio]` ou `role="radio"`) « Débutant » (avec « Je débute au leurre »),
 * « Intermédiaire » (avec « déjà pris des carnassiers au leurre »), « Métriques (°C, cm, g) » et « Impériales (°F, po, oz) » ; titres de groupes
 * « Tes espèces préférées », « Ton niveau », « Unités ». Chaque changement s'applique tout de suite (pas de bouton Enregistrer) : copie de l'appareil
 * (`OnboardingStore.terminer`, utilisée par le moteur) et users/{uid} pour niveau et espèces, `UnitesService` pour les unités.
 * Mention pendant une écriture en attente : « Pas encore synchronisé : ce sera fait au retour du réseau. »
 */
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { throwError } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, Espece, TypeLeurre } from '../../core/data/catalog.service';
import { SOURCE_COMPTE, SourceCompte } from '../../core/data/compte.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { OnboardingStore } from '../../core/data/onboarding.store';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SOURCE_PROFIL } from '../../core/data/profil.service';
import { SOURCE_SPOTS } from '../../core/data/spots.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { Conditions } from '../../core/engine/conditions';
import { compact, trouver } from './compte-informations.doubles';

const MENTION = 'Pas encore synchronisé : ce sera fait au retour du réseau.';
// Ordre du contenu volontairement non alphabétique : la page doit suivre le contenu.
const ESPECES = [
  { code: 'ZZ1', nom: 'Zébrée test' },
  { code: 'AA2', nom: 'Alpha test' },
  { code: 'MM3', nom: 'Médiane test' },
] as Espece[];
const POSITION: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-09T06:32:00Z'), coucher: new Date('2026-11-09T17:01:00Z') };
const RELEVE: ReleveActuel = {
  conditions: {
    tempEau: 11.5,
    sourceTempEau: 'capteur',
    debitTendance: 'normal',
    pressionTendance48h: null,
    nuages: 80,
    vent: 12,
    moment: 'jour',
    saison: 'automne',
    categorie: null,
    departement: '49',
    niveau: 'debutant',
  },
  pressionHpa: 1012,
  moinsPrecis: false,
};

const sansReseau: HttpInterceptorFn = (req) => throwError(() => new Error(`requête non prévue : ${req.url}`));

interface Champs {
  niveau?: string;
  especesFavorites?: string[];
}
interface Ecriture {
  uid: string;
  champs: Champs;
  resoudre: () => void;
}

interface Options {
  /** `null` : pas de compte. */
  uid?: string | null;
  /** Les écritures ne se résolvent qu'à la main (réseau absent). */
  enAttente?: boolean;
  niveau?: 'debutant' | 'intermediaire';
  especesFavorites?: string[];
  unites?: 'metriques' | 'imperiales';
}

async function ouvrir(url: string, { uid = 'uid-test-123', enAttente = false, niveau = 'debutant', especesFavorites = ['AA2'], unites }: Options = {}) {
  // Le moment est fixé (9 novembre 2026, 13 h à Paris) : le conseil ne dépend pas de l'heure réelle (heures légales du double AstroService).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
  localStorage.clear();
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau, especesFavorites }));
  if (unites) localStorage.setItem('leurio.unites', unites);
  const ecritures: Ecriture[] = [];
  const appelsReleve: { niveau?: string }[] = [];
  const appelsMoteur: Conditions[] = [];
  const compte: SourceCompte = {
    uidCourant: async () => uid,
    connecterAnonymement: async () => uid ?? 'uid-test-123',
    profilExiste: async () => true,
    ecrireProfil: async () => undefined,
  };
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideIonicAngular(),
      provideRouter(routes),
      provideHttpClient(withInterceptors([sansReseau])),
      { provide: SOURCE_COMPTE, useValue: compte },
      {
        provide: SOURCE_PROFIL,
        useValue: {
          mettreAJour: (u: string, champs: Champs) =>
            new Promise<void>((resolve) => {
              const ecriture = { uid: u, champs, resoudre: resolve };
              ecritures.push(ecriture);
              if (!enAttente) resolve();
            }),
        },
      },
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: SOURCE_SPOTS, useValue: { uid: async () => null, documents: async () => [] } },
      {
        provide: CatalogService,
        useValue: {
          especes: async () => ESPECES,
          federation: async () => undefined,
          typesDeLeurres: async () => [] as TypeLeurre[],
          animations: async () => [] as Animation[],
          couleurs: async () => [] as Couleur[],
        },
      },
      { provide: PositionService, useValue: { positionGps: async () => POSITION } },
      {
        provide: ConditionsService,
        useValue: {
          releve: async (demande: { niveau?: 'debutant' | 'intermediaire' }) => {
            appelsReleve.push(demande);
            return { ...RELEVE, conditions: { ...RELEVE.conditions, niveau: demande.niveau ?? 'debutant' } };
          },
        },
      },
      { provide: AstroService, useValue: { soleil: (): SoleilDuJour => SOLEIL, lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async (conditions: Conditions) => {
            appelsMoteur.push(conditions);
            return { conseils: [], explications: [] };
          },
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(App);
  const page = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    for (let i = 0; i < 5; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  const router = TestBed.inject(Router);
  router.setUpLocationChangeListener();
  await router.navigateByUrl(url);
  await stabiliser();
  return { page, stabiliser, router, ecritures, appelsReleve, appelsMoteur, store: TestBed.inject(OnboardingStore) };
}

interface Controle {
  libelle: string;
  coche: boolean;
  el: HTMLElement;
}

/** Les cases ou les radios de la page, avec leur texte et leur état. */
function controles(page: HTMLElement, type: 'checkbox' | 'radio'): Controle[] {
  const els = Array.from(page.querySelectorAll<HTMLElement>(`input[type="${type}"], [role="${type}"]`));
  return els.map((el) => {
    const texte = el.getAttribute('aria-label') ?? el.closest('label')?.textContent ?? (el.id ? page.querySelector(`label[for="${el.id}"]`)?.textContent : '') ?? el.textContent;
    const coche = el instanceof HTMLInputElement ? el.checked : el.getAttribute('aria-checked') === 'true';
    return { libelle: (texte ?? '').trim(), coche, el };
  });
}

const trouverControle = (page: HTMLElement, type: 'checkbox' | 'radio', nom: string): Controle => {
  const c = controles(page, type).find((x) => compact(x.libelle).includes(compact(nom)));
  if (!c) throw new Error(`pas de ${type} « ${nom} » (présents : ${controles(page, type).map((x) => x.libelle).join(' | ')})`);
  return c;
};
const estCoche = (page: HTMLElement, type: 'checkbox' | 'radio', nom: string): boolean => trouverControle(page, type, nom).coche;

async function toucher(page: HTMLElement, type: 'checkbox' | 'radio', nom: string, stabiliser: () => Promise<void>) {
  trouverControle(page, type, nom).el.click();
  await stabiliser();
}

afterEach(() => {
  vi.useRealTimers();
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 93 : Compte, groupe « Réglages » (décision A1)', () => {
  it('A1 : given l\'onglet Compte, when je le regarde, then le groupe « Réglages » (avant « Informations », plus aucun « Affichage ») contient « Préférences » (sous-texte « Espèces, niveau, unités ») puis « Thème »', async () => {
    const { page } = await ouvrir('/compte');

    const texte = compact(page.querySelector('ion-content')?.textContent);
    expect(texte).not.toContain(compact('Affichage'));
    expect(texte).toContain(compact('Réglages'));
    const ordre = ['Réglages', 'Préférences', 'Espèces, niveau, unités', 'Thème', 'Informations'].map((t) => texte.indexOf(compact(t)));
    expect(ordre.every((i) => i >= 0), `tous présents : ${ordre}`).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  it('A1 : given l\'onglet Compte, when je touche « Préférences », then la page « Préférences » s\'ouvre à l\'adresse /compte/preferences', async () => {
    const { page, stabiliser, router } = await ouvrir('/compte');

    const ligne = trouver(page.querySelector('ion-content') as HTMLElement, 'Préférences')?.closest<HTMLElement>('a');
    expect(ligne, 'une ligne « Préférences » (lien)').toBeTruthy();
    expect(ligne!.getAttribute('href') ?? '').toContain('/compte/preferences');
    ligne!.click();
    await stabiliser();

    expect(router.url).toBe('/compte/preferences');
    expect(compact(page.querySelector('ion-toolbar ion-title')?.textContent)).toBe('Préférences');
  });
});

describe('US 93 : Préférences', () => {
  it('critère 1 : given j\'ai terminé l\'onboarding en « Intermédiaire » avec une espèce, when j\'ouvre « Préférences », then la liste des espèces vient du contenu dans son ordre et mes espèces et mon niveau actuels sont sélectionnés', async () => {
    const { page } = await ouvrir('/compte/preferences', { niveau: 'intermediaire', especesFavorites: ['AA2', 'MM3'] });

    expect(controles(page, 'checkbox').map((c) => c.libelle)).toEqual(['Zébrée test', 'Alpha test', 'Médiane test']);
    expect(controles(page, 'checkbox').map((c) => c.coche)).toEqual([false, true, true]);
    expect(estCoche(page, 'radio', 'Intermédiaire')).toBe(true);
    expect(estCoche(page, 'radio', 'Débutant')).toBe(false);
    const texte = compact(page.textContent);
    for (const t of ['Tes espèces préférées', 'Ton niveau', 'Unités', 'Je débute au leurre', 'déjà pris des carnassiers au leurre', 'Métriques (°C, cm, g)', 'Impériales (°F, po, oz)']) {
      expect(texte, t).toContain(compact(t));
    }
    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Préférences');
  });

  it('critère 1 : given j\'ai choisi « Débutant », when j\'ouvre « Préférences », then « Débutant » est sélectionné, les unités sont en métrique par défaut et aucune mention « Pas encore synchronisé » n\'est affichée', async () => {
    const { page } = await ouvrir('/compte/preferences', { niveau: 'debutant', especesFavorites: [] });

    expect(estCoche(page, 'radio', 'Débutant')).toBe(true);
    expect(estCoche(page, 'radio', 'Intermédiaire')).toBe(false);
    expect(controles(page, 'checkbox').some((c) => c.coche)).toBe(false);
    expect(estCoche(page, 'radio', 'Métriques')).toBe(true);
    expect(estCoche(page, 'radio', 'Impériales')).toBe(false);
    expect(compact(page.textContent)).not.toContain(compact(MENTION));
  });

  it('critère 2 : given « Préférences » est ouvert en « Débutant », when je choisis « Intermédiaire », then users/{uid} reçoit niveau intermediaire (ce champ seul), la copie de l\'appareil est mise à jour et le conseil suivant est demandé pour ce niveau', async () => {
    const { page, stabiliser, router, ecritures, appelsReleve, appelsMoteur, store } = await ouvrir('/compte/preferences', { niveau: 'debutant', especesFavorites: ['AA2'] });

    await toucher(page, 'radio', 'Intermédiaire', stabiliser);

    expect(ecritures.map((e) => ({ uid: e.uid, champs: e.champs }))).toEqual([{ uid: 'uid-test-123', champs: { niveau: 'intermediaire' } }]);
    expect(estCoche(page, 'radio', 'Intermédiaire')).toBe(true);
    expect(estCoche(page, 'radio', 'Débutant')).toBe(false);
    expect(store.lire()).toEqual({ niveau: 'intermediaire', especesFavorites: ['AA2'] });
    expect(JSON.parse(localStorage.getItem('leurio.onboarding') ?? 'null')).toEqual({ niveau: 'intermediaire', especesFavorites: ['AA2'] });

    // Le conseil suivant (l'écran Conseil s'ouvre pour la première fois) est calculé pour ce niveau.
    await router.navigateByUrl('/conseil');
    await stabiliser();
    expect(appelsReleve.at(-1)?.niveau).toBe('intermediaire');
    expect(appelsMoteur.at(-1)?.niveau).toBe('intermediaire');
  });

  it('critère 2 : given « Préférences » est ouvert en « Intermédiaire », when je choisis « Débutant », then users/{uid} reçoit niveau debutant', async () => {
    const { page, stabiliser, ecritures } = await ouvrir('/compte/preferences', { niveau: 'intermediaire', especesFavorites: [] });

    await toucher(page, 'radio', 'Débutant', stabiliser);

    expect(ecritures.map((e) => e.champs)).toEqual([{ niveau: 'debutant' }]);
  });

  it('critère 3 : given « Préférences » est ouvert avec une espèce cochée, when je coche une autre espèce, then especesFavorites de users/{uid} contient les deux (dans l\'ordre du contenu) sans toucher au niveau, et la copie de l\'appareil suit', async () => {
    const { page, stabiliser, ecritures, store } = await ouvrir('/compte/preferences', { niveau: 'debutant', especesFavorites: ['AA2'] });

    await toucher(page, 'checkbox', 'Zébrée test', stabiliser);

    expect(ecritures.map((e) => ({ uid: e.uid, champs: e.champs }))).toEqual([{ uid: 'uid-test-123', champs: { especesFavorites: ['ZZ1', 'AA2'] } }]);
    expect(estCoche(page, 'checkbox', 'Zébrée test')).toBe(true);
    expect(store.lire()).toEqual({ niveau: 'debutant', especesFavorites: ['ZZ1', 'AA2'] });
  });

  it('critère 3 : given « Préférences » est ouvert avec deux espèces cochées, when je décoche l\'une, then especesFavorites de users/{uid} ne contient plus que l\'autre', async () => {
    const { page, stabiliser, ecritures, store } = await ouvrir('/compte/preferences', { niveau: 'debutant', especesFavorites: ['ZZ1', 'AA2'] });

    await toucher(page, 'checkbox', 'Alpha test', stabiliser);

    expect(ecritures.map((e) => e.champs)).toEqual([{ especesFavorites: ['ZZ1'] }]);
    expect(estCoche(page, 'checkbox', 'Alpha test')).toBe(false);
    expect(store.lire()?.especesFavorites).toEqual(['ZZ1']);
  });

  it('critère 4 : given « Préférences » est ouvert en métrique, when je choisis « Impériales », then le choix est gardé sur l\'appareil (leurio.unites), il n\'y a aucune écriture dans users/{uid}, et en revenant à « Métriques » il est repris', async () => {
    const { page, stabiliser, ecritures } = await ouvrir('/compte/preferences');

    await toucher(page, 'radio', 'Impériales', stabiliser);
    expect(estCoche(page, 'radio', 'Impériales')).toBe(true);
    expect(estCoche(page, 'radio', 'Métriques')).toBe(false);
    expect(localStorage.getItem('leurio.unites')).toBe('imperiales');

    await toucher(page, 'radio', 'Métriques', stabiliser);
    expect(localStorage.getItem('leurio.unites')).toBe('metriques');
    expect(ecritures).toEqual([]);
  });

  it('critère 4 : given j\'ai choisi « Impériales », when je rouvre « Préférences », then « Impériales » est sélectionné', async () => {
    const { page } = await ouvrir('/compte/preferences', { unites: 'imperiales' });

    expect(estCoche(page, 'radio', 'Impériales')).toBe(true);
    expect(estCoche(page, 'radio', 'Métriques')).toBe(false);
  });

  it('critère 5 : given je n\'ai pas de réseau (l\'écriture ne se résout pas), when je change mon niveau, then le choix s\'applique tout de suite (case et copie de l\'appareil) et « Pas encore synchronisé : ce sera fait au retour du réseau. » est affiché', async () => {
    const { page, stabiliser, ecritures, store } = await ouvrir('/compte/preferences', { enAttente: true, niveau: 'debutant' });
    expect(compact(page.textContent)).not.toContain(compact(MENTION));

    await toucher(page, 'radio', 'Intermédiaire', stabiliser);

    expect(estCoche(page, 'radio', 'Intermédiaire')).toBe(true);
    expect(store.lire()?.niveau).toBe('intermediaire');
    expect(ecritures).toHaveLength(1);
    expect(compact(page.textContent)).toContain(compact(MENTION));
  });

  it('critère 5 : given une écriture en attente, when le réseau revient et l\'écriture est acquittée, then la mention « Pas encore synchronisé » disparaît et le choix reste appliqué', async () => {
    const { page, stabiliser, ecritures, store } = await ouvrir('/compte/preferences', { enAttente: true, especesFavorites: [] });
    await toucher(page, 'checkbox', 'Alpha test', stabiliser);
    expect(compact(page.textContent)).toContain(compact(MENTION));

    ecritures.forEach((e) => e.resoudre());
    await stabiliser();

    expect(compact(page.textContent)).not.toContain(compact(MENTION));
    expect(estCoche(page, 'checkbox', 'Alpha test')).toBe(true);
    expect(store.lire()?.especesFavorites).toEqual(['AA2']);
  });

  it('critère 5 : given le réseau est présent, when je change une préférence, then aucune mention « Pas encore synchronisé » n\'est affichée une fois l\'écriture acquittée', async () => {
    const { page, stabiliser } = await ouvrir('/compte/preferences', { niveau: 'debutant' });

    await toucher(page, 'radio', 'Intermédiaire', stabiliser);

    expect(compact(page.textContent)).not.toContain(compact(MENTION));
  });

  it('critère 5 : given je n\'ai pas encore de compte (uid null), when je change mon niveau et une espèce, then les choix s\'appliquent sur l\'appareil et rien n\'est écrit dans users/{uid}', async () => {
    const { page, stabiliser, ecritures, store } = await ouvrir('/compte/preferences', { uid: null, niveau: 'debutant', especesFavorites: [] });

    await toucher(page, 'radio', 'Intermédiaire', stabiliser);
    await toucher(page, 'checkbox', 'Médiane test', stabiliser);

    expect(ecritures).toEqual([]);
    expect(estCoche(page, 'radio', 'Intermédiaire')).toBe(true);
    expect(estCoche(page, 'checkbox', 'Médiane test')).toBe(true);
    expect(store.lire()).toEqual({ niveau: 'intermediaire', especesFavorites: ['MM3'] });
    expect(compact(page.textContent)).not.toContain(compact(MENTION));
  });
});
