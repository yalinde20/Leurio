/*
 * US 82 : choisir le moment du conseil dans les 48 h à venir. Maquette de référence : docs/maquettes/us-82-moment-du-conseil.html.
 *
 * Contrat du DOM que ces tests supposent (tout est rendu DANS le composant de la page ; pas d'ion-modal ni d'ion-action-sheet,
 * qui se rendent hors du composant) :
 *  - Le sélecteur : un `button` (ou `ion-button`) HORS de la feuille, dont le texte contient « Moment » suivi de la valeur
 *    affichée : « Maintenant », « Demain 7 h », « Aujourd'hui 18 h », « Après-demain 6 h » (jour avec majuscule, heure « 7 h »).
 *  - La feuille : un élément `[role="dialog"]` présent dans le DOM seulement quand elle est ouverte (absent à l'ouverture de
 *    l'écran et après « Maintenant » ou une validation réussie ; présent après un refus). Elle contient :
 *      · un `button` « Maintenant » : applique l'instant présent et ferme la feuille ;
 *      · le choix du jour : trois éléments cliquables (`button`, `[role="radio"]` ou `label` d'un radio) « Aujourd'hui »,
 *        « Demain », « Après-demain » ;
 *      · l'heure : un `select` libellé « Heure » (`aria-label`, `label[for]` ou `label` englobant) dont les `option` ont pour texte
 *        « 0 h » … « 23 h » ; le test fixe `select.value` sur l'option voulue puis émet `input` et `change` ;
 *      · des `button` « Annuler » et « Valider » ;
 *      · l'erreur : un `[role="alert"]` portant « Choisis un moment dans les 48 h à venir. » (refus de « Valider »).
 *  - Un moment valide : la feuille se ferme, le sélecteur affiche le libellé et la carte « Conditions » porte la mention
 *    « Prévisions pour demain 7 h » (jour en minuscules : « aujourd'hui », « demain », « après-demain »). Pour « Maintenant »,
 *    la mention disparaît.
 *  - Le jour et l'heure sont ceux de Paris (Europe/Paris, comme conditions-format.ts). Un moment est « heure pile » (minutes,
 *    secondes et millisecondes à 0). Valide = strictement après l'instant présent et au plus 48 h après.
 *  - Moment choisi : ConditionsService.releve({ lieu, moment }), MoteurService.conseiller(conditions, moment),
 *    AstroService.soleil(lieu, moment) reçoivent ce moment ; « Maintenant » = new Date() à l'instant du tap.
 *  - Hors heures légales pour un jour choisi : « Heures légales demain : … » (aujourd'hui / demain / après-demain).
 *  - Le moment n'est pas mémorisé (état du composant, pas de localStorage) : non testable ici, voir le rapport.
 *
 * Temps : faux timers sur `Date`. Maintenant = lundi 9 novembre 2026, 14 h à Paris (13:00Z, UTC+1).
 * Demain 7 h = 2026-11-10T06:00Z ; Demain 22 h = 2026-11-10T21:00Z ; Après-demain 6 h = 2026-11-11T05:00Z (dans les 48 h) ;
 * Après-demain 23 h = 2026-11-11T22:00Z (au-delà de 48 h) ; Aujourd'hui 8 h = 2026-11-09T07:00Z (passé).
 * Le double AstroService donne les heures légales 7 h 02 – 18 h 31 (Paris) chaque jour.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};

const JOUR_MS = 24 * 3600 * 1000;
const MAINTENANT = new Date('2026-11-09T13:00:00Z'); // 14 h à Paris
const DEMAIN_7H = new Date('2026-11-10T06:00:00Z');
const DEMAIN_22H = new Date('2026-11-10T21:00:00Z');
const APRES_DEMAIN_6H = new Date('2026-11-11T05:00:00Z');

const LEVER_DU_9 = new Date('2026-11-09T06:32:00Z');
const COUCHER_DU_9 = new Date('2026-11-09T17:01:00Z');
/** Même lever et même coucher chaque jour : heures légales 7 h 02 – 18 h 31 à Paris. */
function soleilDu(moment: Date): SoleilDuJour {
  const jours = Math.floor(moment.getTime() / JOUR_MS) - Math.floor(LEVER_DU_9.getTime() / JOUR_MS);
  return {
    lever: new Date(LEVER_DU_9.getTime() + jours * JOUR_MS),
    coucher: new Date(COUCHER_DU_9.getTime() + jours * JOUR_MS),
  };
}

const conditionsDe = (surcharge: Partial<Conditions>): Conditions => ({
  tempEau: 11.5,
  sourceTempEau: 'capteur',
  debitTendance: 'normal',
  pressionTendance48h: -8,
  nuages: 80,
  vent: 12,
  moment: 'jour',
  saison: 'automne',
  categorie: null,
  departement: '49',
  niveau: 'debutant',
  ...surcharge,
});

/** Les conditions « d'aujourd'hui » : eau 11,5 °C, vent 12 km/h. Celles de demain 7 h : eau 9,2 °C, vent 8 km/h. */
const RELEVE_MAINTENANT: ReleveActuel = { conditions: conditionsDe({}), pressionHpa: 1012, moinsPrecis: false };
const RELEVE_DEMAIN_7H: ReleveActuel = {
  conditions: conditionsDe({ tempEau: 9.2, vent: 8, nuages: 100 }),
  pressionHpa: 1016,
  moinsPrecis: false,
};
const RELEVE_AUTRE: ReleveActuel = { conditions: conditionsDe({ tempEau: 10, vent: 5, nuages: 0 }), pressionHpa: 1014, moinsPrecis: false };

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'minnow', nom: 'Leurre dur (minnow)' },
  { id: 'cuillere', nom: 'Cuillère tournante' },
  { id: 'jig', nom: 'Jig à jupe' },
  { id: 'ver', nom: 'Ver souple finesse' },
] as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tirée-relâchée' },
  { id: 'gratte', nom: 'Gratté' },
  { id: 'dropshot', nom: 'Drop shot' },
  { id: 'lineaire', nom: 'Linéaire' },
  { id: 'twitching', nom: 'Twitching' },
] as Animation[];
const COULEURS = [
  { id: 'gardon', nom: 'Gardon' },
  { id: 'chartreuse', nom: 'Chartreuse' },
  { id: 'nacre', nom: 'Blanc nacré' },
  { id: 'argent', nom: 'Argent' },
] as Couleur[];

const conseil = (surcharge: Partial<Conseil>): Conseil => ({
  typeId: 'shad',
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 10,
  pourquoi: ['Première phrase. Deuxième phrase du moteur.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
  ...surcharge,
});

const TOP3_MAINTENANT: ResultatConseil = {
  conseils: [
    conseil({ typeId: 'shad', techniqueId: 'tiree', couleur: 'gardon', score: 9 }),
    conseil({ typeId: 'jig', techniqueId: 'gratte', couleur: 'chartreuse', taille: { valeur: 10, unite: 'g' }, score: 7 }),
    conseil({ typeId: 'ver', techniqueId: 'dropshot', couleur: 'gardon', taille: { valeur: 6, unite: 'cm' }, score: 5 }),
  ],
  explications: [],
};
const TOP3_DEMAIN_7H: ResultatConseil = {
  conseils: [
    conseil({ typeId: 'shad', techniqueId: 'lineaire', couleur: 'nacre', taille: { valeur: 10, unite: 'cm' }, score: 9 }),
    conseil({ typeId: 'minnow', techniqueId: 'twitching', couleur: 'nacre', taille: { valeur: 9, unite: 'cm' }, score: 7 }),
    conseil({ typeId: 'cuillere', techniqueId: 'lineaire', couleur: 'argent', taille: { valeur: 6, unite: 'g' }, score: 5 }),
  ],
  explications: [],
};
const TOP3_AUTRE: ResultatConseil = { conseils: [...TOP3_MAINTENANT.conseils].reverse(), explications: [] };

const memeInstant = (a: Date, b: Date): boolean => a.getTime() === b.getTime();

async function afficher() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  const appelsReleve: Date[] = [];
  const appelsMoteur: Date[] = [];
  const appelsSoleil: Date[] = [];
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
          typesDeLeurres: async () => TYPES,
          animations: async () => ANIMATIONS,
          couleurs: async () => COULEURS,
        },
      },
      {
        provide: ConditionsService,
        useValue: {
          releve: async ({ moment }: { moment: Date }): Promise<ReleveActuel> => {
            appelsReleve.push(moment);
            if (memeInstant(moment, MAINTENANT)) return RELEVE_MAINTENANT;
            return memeInstant(moment, DEMAIN_7H) ? RELEVE_DEMAIN_7H : RELEVE_AUTRE;
          },
        },
      },
      {
        provide: AstroService,
        useValue: {
          soleil: (_lieu: unknown, moment: Date): SoleilDuJour => {
            appelsSoleil.push(moment);
            return soleilDu(moment);
          },
          lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async (_conditions: Conditions, moment: Date): Promise<ResultatConseil> => {
            appelsMoteur.push(moment);
            if (memeInstant(moment, MAINTENANT)) return TOP3_MAINTENANT;
            return memeInstant(moment, DEMAIN_7H) ? TOP3_DEMAIN_7H : TOP3_AUTRE;
          },
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  const stabiliser = async () => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  await stabiliser();
  return { page: fixture.nativeElement as HTMLElement, stabiliser, appelsReleve, appelsMoteur, appelsSoleil };
}

afterEach(() => vi.useRealTimers());

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');

const boutons = (racine: ParentNode): HTMLElement[] => [...racine.querySelectorAll<HTMLElement>('button, ion-button')];
const feuille = (page: HTMLElement): HTMLElement | null => page.querySelector<HTMLElement>('[role="dialog"]');

/** Le sélecteur de moment : un bouton hors de la feuille dont le texte contient « Moment ». */
function selecteur(page: HTMLElement): HTMLElement {
  const trouve = boutons(page).find((b) => !b.closest('[role="dialog"]') && compact(b.textContent).includes('Moment'));
  if (!trouve) throw new Error('Aucun bouton « Moment » (sélecteur de moment) hors de la feuille');
  return trouve;
}

function dansLaFeuille(page: HTMLElement): HTMLElement {
  const f = feuille(page);
  if (!f) throw new Error('La feuille « Moment du conseil » ([role="dialog"]) n\'est pas ouverte');
  return f;
}

function cliquable(page: HTMLElement, texte: string): HTMLElement {
  const trouve = [...dansLaFeuille(page).querySelectorAll<HTMLElement>('button, ion-button, [role="radio"], label')].find(
    (e) => compact(e.textContent) === compact(texte),
  );
  if (!trouve) throw new Error(`Aucun élément « ${texte} » dans la feuille`);
  return trouve;
}

function selectHeure(page: HTMLElement): HTMLSelectElement {
  const f = dansLaFeuille(page);
  const trouve = [...f.querySelectorAll<HTMLSelectElement>('select')].find((s) => {
    const parLabel = s.id ? f.querySelector(`label[for="${s.id}"]`) : null;
    const libelle = s.getAttribute('aria-label') ?? parLabel?.textContent ?? s.closest('label')?.textContent ?? '';
    return compact(libelle).startsWith('Heure');
  });
  if (!trouve) throw new Error('Aucun select libellé « Heure » dans la feuille');
  return trouve;
}

async function ouvrir(env: Awaited<ReturnType<typeof afficher>>): Promise<void> {
  selecteur(env.page).click();
  await env.stabiliser();
}

async function choisir(env: Awaited<ReturnType<typeof afficher>>, jour: string, heure: number): Promise<void> {
  cliquable(env.page, jour).click();
  await env.stabiliser();
  const select = selectHeure(env.page);
  const option = [...select.options].find((o) => compact(o.textContent) === compact(`${heure} h`));
  if (!option) throw new Error(`Aucune option « ${heure} h » dans le select Heure`);
  select.value = option.value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await env.stabiliser();
}

async function valider(env: Awaited<ReturnType<typeof afficher>>): Promise<void> {
  cliquable(env.page, 'Valider').click();
  await env.stabiliser();
}

/** Les cartes de conseil : les `section`, `article` ou `ion-card` les plus internes dont le texte contient « Animation : ». */
function cartesConseil(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>('section, article, ion-card')].filter(
    (e) =>
      compact(e.textContent).includes(compact('Animation :')) &&
      !e.querySelector('section, article, ion-card') &&
      !e.closest('[role="dialog"]'),
  );
}

describe('ConseilPage : moment du conseil (US 82)', () => {
  it("critère 1 : given j'ouvre l'écran Conseil, when je regarde le sélecteur de moment, then il affiche « Maintenant »", async () => {
    const env = await afficher();

    expect(compact(selecteur(env.page).textContent)).toContain(compact('Maintenant'));
    expect(feuille(env.page)).toBeNull();
    expect(compact(env.page.textContent)).not.toContain(compact('Prévisions pour'));
    expect(env.appelsReleve.map((d) => d.getTime())).toEqual([MAINTENANT.getTime()]);
  });

  it("critère 2 : given le sélecteur ouvert, when je choisis demain à 7 h, then le sélecteur affiche « Demain 7 h » et la feuille se ferme", async () => {
    const env = await afficher();
    await ouvrir(env);
    expect(compact(dansLaFeuille(env.page).textContent)).toContain(compact('Moment du conseil'));

    await choisir(env, 'Demain', 7);
    await valider(env);

    expect(compact(selecteur(env.page).textContent)).toContain(compact('Demain 7 h'));
    expect(feuille(env.page)).toBeNull();
  });

  it("critère 2 : given le sélecteur ouvert, when je choisis demain à 7 h, then la carte « Conditions » porte la mention « Prévisions pour demain 7 h » et les conditions de ce moment", async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Demain', 7);
    await valider(env);

    const texte = compact(env.page.textContent);
    expect(texte).toContain(compact('Prévisions pour demain 7 h'));
    expect(texte).toContain(compact("Température de l'eau : 9,2 °C"));
    expect(texte).toContain(compact('Vent : 8 km/h'));
    expect(texte).not.toContain(compact("Température de l'eau : 11,5 °C"));
    expect(env.appelsReleve.at(-1)?.getTime()).toBe(DEMAIN_7H.getTime());
  });

  it('critère 2 : given le sélecteur ouvert, when je choisis demain à 7 h, then les 3 conseils sont ceux que le moteur rend pour ce moment', async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Demain', 7);
    await valider(env);

    const cartes = cartesConseil(env.page).map((c) => compact(c.textContent));
    expect(cartes).toHaveLength(3);
    expect(cartes[0]).toContain(compact('Shad'));
    expect(cartes[0]).toContain(compact('Animation : Linéaire'));
    expect(cartes[1]).toContain(compact('Leurre dur (minnow)'));
    expect(cartes[2]).toContain(compact('Cuillère tournante'));
    expect(compact(env.page.textContent)).not.toContain(compact('Jig à jupe'));
    expect(env.appelsMoteur.at(-1)?.getTime()).toBe(DEMAIN_7H.getTime());
    expect(env.appelsSoleil.at(-1)?.getTime()).toBe(DEMAIN_7H.getTime());
  });

  it("critère 2 : given le sélecteur ouvert, when je choisis après-demain à 6 h (dans les 48 h), then le choix est accepté et la mention dit « après-demain 6 h »", async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Après-demain', 6);
    await valider(env);

    expect(compact(selecteur(env.page).textContent)).toContain(compact('Après-demain 6 h'));
    expect(compact(env.page.textContent)).toContain(compact('Prévisions pour après-demain 6 h'));
    expect(env.appelsReleve.at(-1)?.getTime()).toBe(APRES_DEMAIN_6H.getTime());
  });

  it("critère 3 : given le sélecteur ouvert, when je choisis un moment passé (aujourd'hui 8 h), then le choix est refusé avec « Choisis un moment dans les 48 h à venir. » et « Maintenant » reste affiché", async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, "Aujourd'hui", 8);
    await valider(env);

    const alerte = dansLaFeuille(env.page).querySelector('[role="alert"]');
    expect(compact(alerte?.textContent)).toBe(compact('Choisis un moment dans les 48 h à venir.'));
    expect(compact(selecteur(env.page).textContent)).toContain(compact('Maintenant'));
    expect(compact(selecteur(env.page).textContent)).not.toContain(compact("Aujourd'hui 8 h"));
    expect(env.appelsReleve).toHaveLength(1);
    expect(env.appelsMoteur).toHaveLength(1);
    expect(compact(env.page.textContent)).not.toContain(compact('Prévisions pour'));
  });

  it("critère 3 : given le sélecteur ouvert, when je choisis un moment à plus de 48 h (après-demain 23 h), then le choix est refusé avec le même message et rien n'est recalculé", async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Après-demain', 23);
    await valider(env);

    const alerte = dansLaFeuille(env.page).querySelector('[role="alert"]');
    expect(compact(alerte?.textContent)).toBe(compact('Choisis un moment dans les 48 h à venir.'));
    expect(compact(selecteur(env.page).textContent)).toContain(compact('Maintenant'));
    expect(env.appelsReleve).toHaveLength(1);
    expect(env.appelsMoteur).toHaveLength(1);
    expect(env.appelsSoleil.every((d) => memeInstant(d, MAINTENANT))).toBe(true);
  });

  it("critère 3 : given un moment futur déjà choisi, when je choisis ensuite un moment refusé, then le moment précédent (« Demain 7 h ») reste affiché avec ses conditions", async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Demain', 7);
    await valider(env);
    const appelsAvant = env.appelsReleve.length;

    await ouvrir(env);
    await choisir(env, "Aujourd'hui", 8);
    await valider(env);

    expect(compact(dansLaFeuille(env.page).querySelector('[role="alert"]')?.textContent)).toBe(
      compact('Choisis un moment dans les 48 h à venir.'),
    );
    expect(compact(selecteur(env.page).textContent)).toContain(compact('Demain 7 h'));
    expect(compact(env.page.textContent)).toContain(compact("Température de l'eau : 9,2 °C"));
    expect(env.appelsReleve).toHaveLength(appelsAvant);
  });

  it("critère 4 : given j'ai choisi un moment futur hors des heures légales (demain 22 h), when l'écran se met à jour, then l'avertissement remplace les conseils", async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Demain', 22);
    await valider(env);

    const texte = compact(env.page.textContent);
    expect(texte).toContain(compact('Hors des heures légales : pas de pêche aux carnassiers la nuit.'));
    expect(texte).toContain(compact('Heures légales demain : 7 h 02 – 18 h 31'));
    expect(cartesConseil(env.page)).toHaveLength(0);
    expect(compact(selecteur(env.page).textContent)).toContain(compact('Demain 22 h'));
    expect(env.appelsSoleil.at(-1)?.getTime()).toBe(DEMAIN_22H.getTime());
  });

  it("critère 5 : given demain 7 h choisi, when je choisis « Maintenant », then le sélecteur, les conditions et les conseils reviennent à l'instant présent", async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Demain', 7);
    await valider(env);
    expect(cartesConseil(env.page)).toHaveLength(3);

    await ouvrir(env);
    cliquable(env.page, 'Maintenant').click();
    await env.stabiliser();

    const texte = compact(env.page.textContent);
    expect(compact(selecteur(env.page).textContent)).toContain(compact('Maintenant'));
    expect(compact(selecteur(env.page).textContent)).not.toContain(compact('Demain'));
    expect(feuille(env.page)).toBeNull();
    expect(texte).not.toContain(compact('Prévisions pour'));
    expect(texte).toContain(compact("Température de l'eau : 11,5 °C"));
    const cartes = cartesConseil(env.page).map((c) => compact(c.textContent));
    expect(cartes).toHaveLength(3);
    expect(cartes[0]).toContain(compact('Shad'));
    expect(cartes[0]).toContain(compact('Animation : Tirée-relâchée'));
    expect(cartes[1]).toContain(compact('Jig à jupe'));
    expect(env.appelsReleve.at(-1)?.getTime()).toBe(MAINTENANT.getTime());
    expect(env.appelsMoteur.at(-1)?.getTime()).toBe(MAINTENANT.getTime());
    expect(env.appelsSoleil.at(-1)?.getTime()).toBe(MAINTENANT.getTime());
  });

  it("critère 5 : given demain 22 h choisi (avertissement affiché), when je choisis « Maintenant », then l'avertissement disparaît et les 3 conseils reviennent", async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Demain', 22);
    await valider(env);
    expect(cartesConseil(env.page)).toHaveLength(0);

    await ouvrir(env);
    cliquable(env.page, 'Maintenant').click();
    await env.stabiliser();

    expect(compact(env.page.textContent)).not.toContain(compact('Hors des heures légales'));
    expect(cartesConseil(env.page)).toHaveLength(3);
    expect(compact(selecteur(env.page).textContent)).toContain(compact('Maintenant'));
  });

  it("given la feuille ouverte, when je tape « Annuler », then la feuille se ferme sans rien changer", async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Demain', 7);
    cliquable(env.page, 'Annuler').click();
    await env.stabiliser();

    expect(feuille(env.page)).toBeNull();
    expect(compact(selecteur(env.page).textContent)).toContain(compact('Maintenant'));
    expect(env.appelsReleve).toHaveLength(1);
  });
});
