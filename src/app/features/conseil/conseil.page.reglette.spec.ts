/*
 * US 296 : choisir le moment avec la réglette du temps (PLAN §3 sélecteur de moment, §6 heures légales calculées en local).
 * Maquette validée : docs/maquettes/us-296-reglette-du-temps.html. La réglette REMPLACE la pastille et la feuille « Moment » de l'US 82.
 *
 * Contrat du DOM que ces tests supposent (les noms de classes sont ceux de la maquette ; tout le reste de la structure est libre) :
 *  - `.reglette` : le bloc de la réglette, entre la rivière (`app-riviere-en-coupe`) et le dock (`.dock`). Il contient :
 *      · `.valeur` : le libellé du moment, « Maintenant 14 h 20 », « Ce soir 18 h 30 », « Demain 7 h 30 »… (voir `libelleReglette`
 *        dans moment-format.ts). Il suit le curseur PENDANT le glissement ;
 *      · `.jours button` : les boutons de jour. Aujourd'hui : « Demain ». Depuis demain : « Aujourd'hui » et « Après-demain ». Depuis
 *        après-demain : « Demain »… (seuls les boutons de la maquette sont testés) ;
 *      · `[role="slider"]` : la piste (toute la largeur du bloc). `tabindex="0"`, `aria-label="Moment du conseil"`, `aria-valuemin`,
 *        `aria-valuemax`, `aria-valuenow` (nombres) et `aria-valuetext` = le même libellé que `.valeur`, lu en clair par VoiceOver ;
 *      · `.curseur` : le curseur, DANS la piste (zone tactile de 48 × 48 px autour du rond visible de 24 px) ;
 *      · `.legal` : la bande des heures légales du jour affiché ; `.reperes` : ses deux heures écrites dessous (« 7 h 02 », « 18 h 31 ») ;
 *      · `.maint` : le trait « maintenant » et `.passe` : le passé hachuré, présents seulement quand le jour affiché est aujourd'hui.
 *  - Le glissement se fait aux événements `pointerdown`, `pointermove` et `pointerup` reçus par l'élément `[role="slider"]` (ceux du
 *    curseur y remontent). La position est lue sur `getBoundingClientRect()` de CET élément : pas = arrondi((clientX - left) / width × 48), de 0 h (à gauche) à 24 h (à droite), un pas = 30 min. Le conseil n'est recalculé qu'au `pointerup`.
 *  - Clavier : flèche droite / gauche = ± 30 min (un pas), « Début » = « Maintenant ». Chaque appui est un relâchement : le conseil est
 *    recalculé tout de suite. Aujourd'hui, le premier pas à droite de « Maintenant 14 h 20 » est 14 h 30 ; on ne descend pas sous « Maintenant ».
 *  - Aujourd'hui, le passé n'est pas choisissable (le curseur s'arrête sur « Maintenant ») ; la fenêtre des 48 h est conservée
 *    (le curseur s'arrête avant Maintenant + 48 h).
 *  - La pastille « Moment » et `app-moment-feuille` n'existent plus ; la pastille « Espèce » monte dans l'en-tête `.haut`, à côté du lieu.
 *
 * Temps : faux timers sur `Date`. Maintenant = lundi 9 novembre 2026, 14 h 20 à Paris (13:20Z, UTC+1).
 * Le double AstroService donne les heures légales 7 h 02 – 18 h 31 (Paris) chaque jour.
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
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';
import { compact, liensDesCoups, temperatureAffichee } from './conseil.page.aides';

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};

const JOUR_MS = 24 * 3600 * 1000;
const MAINTENANT = new Date('2026-11-09T13:20:00Z'); // 14 h 20 à Paris
const CE_SOIR_18H30 = new Date('2026-11-09T17:30:00Z');
const CE_SOIR_21H = new Date('2026-11-09T20:00:00Z');
const APRES_MIDI_15H = new Date('2026-11-09T14:00:00Z');
const APRES_MIDI_14H30 = new Date('2026-11-09T13:30:00Z');
const DEMAIN_DEBUT = new Date('2026-11-09T23:00:00Z'); // minuit de Paris, le 10
const DEMAIN_FIN = new Date('2026-11-10T23:00:00Z');
const LIMITE_48H = new Date(MAINTENANT.getTime() + 2 * JOUR_MS);

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

/** Conditions de « Maintenant » : eau 11,5 °C. De ce soir 18 h 30 : 10,4 °C. De demain : 9,2 °C. Les autres moments : 10,0 °C. */
const RELEVE_MAINTENANT: ReleveActuel = { conditions: conditionsDe({}), pressionHpa: 1012, moinsPrecis: false };
const RELEVE_SOIR: ReleveActuel = { conditions: conditionsDe({ tempEau: 10.4, vent: 6, nuages: 20 }), pressionHpa: 1014, moinsPrecis: false };
const RELEVE_DEMAIN: ReleveActuel = { conditions: conditionsDe({ tempEau: 9.2, vent: 8, nuages: 100 }), pressionHpa: 1016, moinsPrecis: false };
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
  { id: 'nacre', nom: 'Blanc nacré' },
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
const top3 = (premier: Partial<Conseil>): ResultatConseil => ({
  conseils: [
    conseil(premier),
    conseil({ typeId: 'jig', techniqueId: 'gratte', score: 7 }),
    conseil({ typeId: 'ver', techniqueId: 'dropshot', score: 5 }),
  ],
  explications: [],
});
const TOP3_MAINTENANT = top3({ typeId: 'shad', techniqueId: 'tiree' });
const TOP3_SOIR = top3({ typeId: 'minnow', techniqueId: 'twitching' });
const TOP3_DEMAIN = top3({ typeId: 'cuillere', techniqueId: 'lineaire' });
const TOP3_AUTRE = top3({ typeId: 'ver', techniqueId: 'dropshot' });

const memeInstant = (a: Date, b: Date): boolean => a.getTime() === b.getTime();
const jourDemain = (m: Date): boolean => m.getTime() >= DEMAIN_DEBUT.getTime() && m.getTime() < DEMAIN_FIN.getTime();

async function afficher() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  const appelsReleve: Date[] = [];
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
            if (memeInstant(moment, CE_SOIR_18H30)) return RELEVE_SOIR;
            return jourDemain(moment) ? RELEVE_DEMAIN : RELEVE_AUTRE;
          },
        },
      },
      {
        provide: AstroService,
        useValue: {
          soleil: (_lieu: unknown, moment: Date): SoleilDuJour => soleilDu(moment),
          lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async (_conditions: Conditions, moment: Date): Promise<ResultatConseil> => {
            appelsMoteur.push(moment);
            if (memeInstant(moment, MAINTENANT)) return TOP3_MAINTENANT;
            if (memeInstant(moment, CE_SOIR_18H30)) return TOP3_SOIR;
            return jourDemain(moment) ? TOP3_DEMAIN : TOP3_AUTRE;
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
  return { page: fixture.nativeElement as HTMLElement, stabiliser, appelsReleve, appelsMoteur };
}
type Env = Awaited<ReturnType<typeof afficher>>;

afterEach(() => vi.useRealTimers());

const reglette = (page: HTMLElement): HTMLElement => {
  const trouve = page.querySelector<HTMLElement>('.reglette');
  if (!trouve) throw new Error('Aucune réglette (`.reglette`) sur l\'écran Conseil');
  return trouve;
};
const curseurDe = (page: HTMLElement): HTMLElement => {
  const trouve = reglette(page).querySelector<HTMLElement>('[role="slider"]');
  if (!trouve) throw new Error('La réglette n\'a pas d\'élément [role="slider"]');
  return trouve;
};
const valeurLue = (page: HTMLElement): string => compact(reglette(page).querySelector('.valeur')?.textContent);
const texteLu = (page: HTMLElement): string => compact(curseurDe(page).getAttribute('aria-valuetext'));

function boutonJour(page: HTMLElement, texte: string): HTMLElement | undefined {
  return [...reglette(page).querySelectorAll<HTMLElement>('.jours button')].find((b) => compact(b.textContent) === compact(texte));
}

const LARGEUR = 480; // 10 px par pas de 30 min
const px = (heures: number): number => (heures / 24) * LARGEUR;

/** Donne une géométrie à la piste (jsdom n'a pas de mise en page) et de quoi capturer le pointeur. */
function preparerPiste(slider: HTMLElement): void {
  slider.getBoundingClientRect = () => ({ left: 0, top: 0, right: LARGEUR, bottom: 48, width: LARGEUR, height: 48, x: 0, y: 0, toJSON: () => ({}) });
  for (const cible of [slider, ...slider.querySelectorAll<HTMLElement>('*')]) {
    cible.setPointerCapture = () => undefined;
    cible.releasePointerCapture = () => undefined;
    cible.hasPointerCapture = () => true;
  }
}

function evenementPointeur(type: 'pointerdown' | 'pointermove' | 'pointerup', x: number): Event {
  const options = { bubbles: true, cancelable: true, clientX: x, clientY: 24, button: 0, buttons: type === 'pointerup' ? 0 : 1 };
  const e = typeof PointerEvent === 'function' ? new PointerEvent(type, { ...options, pointerId: 1, isPrimary: true }) : new MouseEvent(type, options);
  if (!('pointerId' in e)) Object.defineProperty(e, 'pointerId', { value: 1 });
  return e;
}

/** Pose le doigt sur le curseur, le fait glisser jusqu'à `x` et attend le rendu ; le doigt reste posé. */
async function glisserSansRelacher(env: Env, depuis: number, vers: number): Promise<void> {
  const piste = curseurDe(env.page);
  preparerPiste(piste);
  piste.dispatchEvent(evenementPointeur('pointerdown', depuis));
  piste.dispatchEvent(evenementPointeur('pointermove', (depuis + vers) / 2));
  piste.dispatchEvent(evenementPointeur('pointermove', vers));
  await env.stabiliser();
}

async function relacher(env: Env, x: number): Promise<void> {
  curseurDe(env.page).dispatchEvent(evenementPointeur('pointerup', x));
  await env.stabiliser();
}

async function glisser(env: Env, depuis: number, vers: number): Promise<void> {
  await glisserSansRelacher(env, depuis, vers);
  await relacher(env, vers);
}

async function touche(env: Env, key: string): Promise<void> {
  curseurDe(env.page).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  await env.stabiliser();
}

const premierCoup = (page: HTMLElement): string => compact(liensDesCoups(page)[0]?.textContent);

describe('ConseilPage : la réglette du temps (US 296)', () => {
  it("critère 1 : given l'écran Conseil à l'ouverture, when je regarde la réglette, then le curseur est sur « Maintenant » avec l'heure", async () => {
    const env = await afficher();

    const piste = curseurDe(env.page);
    expect(piste.getAttribute('aria-label')).toBe('Moment du conseil');
    expect(valeurLue(env.page)).toBe(compact('Maintenant 14 h 20'));
    expect(texteLu(env.page)).toBe(compact('Maintenant 14 h 20'));
    expect(env.appelsReleve.map((d) => d.getTime())).toEqual([MAINTENANT.getTime()]);
    expect(temperatureAffichee(env.page)).toBe(compact('11,5 °C'));
  });

  it("critère 1 : given l'écran Conseil à l'ouverture, when je regarde la réglette, then la plage des heures légales du jour est marquée, avec ses deux heures, et « maintenant » est repéré", async () => {
    const env = await afficher();
    const bloc = reglette(env.page);

    const bande = bloc.querySelector<HTMLElement>('.legal');
    expect(bande, 'bande des heures légales (.legal)').not.toBeNull();
    expect(parseFloat(bande!.style.left)).toBeGreaterThan(0);
    expect(parseFloat(bande!.style.width)).toBeGreaterThan(0);
    const reperes = compact(bloc.querySelector('.reperes')?.textContent);
    expect(reperes).toContain(compact('7 h 02'));
    expect(reperes).toContain(compact('18 h 31'));
    expect(bloc.querySelector('.maint'), 'trait « maintenant » (.maint)').not.toBeNull();
    expect(bloc.querySelector('.passe'), 'passé hachuré (.passe)').not.toBeNull();
  });

  it("given l'écran Conseil, when je regarde l'écran, then la réglette est entre la rivière et le dock, la pastille et la feuille « Moment » n'existent plus et « Espèce » est dans l'en-tête à côté du lieu", async () => {
    const env = await afficher();
    const { page } = env;

    const riviere = page.querySelector('app-riviere-en-coupe')!;
    const dock = page.querySelector('.dock')!;
    const bloc = reglette(page);
    expect(riviere.compareDocumentPosition(bloc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bloc.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(page.querySelector('app-moment-feuille')).toBeNull();
    const pastilles = [...page.querySelectorAll<HTMLElement>('button')].map((b) => compact(b.textContent));
    expect(pastilles.some((t) => t.startsWith('Moment'))).toBe(false);
    const haut = page.querySelector<HTMLElement>('.haut')!;
    const dansLEnTete = [...haut.querySelectorAll<HTMLElement>('button')].map((b) => compact(b.textContent));
    expect(dansLEnTete.some((t) => t.startsWith('Espèce'))).toBe(true);
    expect(haut.querySelector('.lieu')).not.toBeNull();
  });

  it("critère 2 : given la réglette, when je fais glisser le curseur jusqu'à 18 h 30, then le libellé devient « Ce soir 18 h 30 » pendant le glissement, sans recalculer le conseil", async () => {
    const env = await afficher();
    const appelsAvant = env.appelsReleve.length;

    await glisserSansRelacher(env, px(14.34), px(18.5));

    expect(valeurLue(env.page)).toBe(compact('Ce soir 18 h 30'));
    expect(texteLu(env.page)).toBe(compact('Ce soir 18 h 30'));
    // Le conseil est recalculé au relâchement, pas à chaque mouvement.
    expect(env.appelsReleve).toHaveLength(appelsAvant);
    expect(env.appelsMoteur).toHaveLength(appelsAvant);
    expect(temperatureAffichee(env.page)).toBe(compact('11,5 °C'));
    await relacher(env, px(18.5));
  });

  it("critère 2 : given la réglette, when je fais glisser le curseur jusqu'à 18 h 30 et je le relâche, then le libellé est « Ce soir 18 h 30 » et le conseil est recalculé pour ce moment", async () => {
    const env = await afficher();

    await glisser(env, px(14.34), px(18.5));

    expect(valeurLue(env.page)).toBe(compact('Ce soir 18 h 30'));
    expect(texteLu(env.page)).toBe(compact('Ce soir 18 h 30'));
    expect(env.appelsReleve.at(-1)?.getTime()).toBe(CE_SOIR_18H30.getTime());
    expect(env.appelsMoteur.at(-1)?.getTime()).toBe(CE_SOIR_18H30.getTime());
    expect(temperatureAffichee(env.page)).toBe(compact('10,4 °C'));
    expect(premierCoup(env.page)).toContain(compact('Leurre dur (minnow)'));
    expect(compact(env.page.textContent)).not.toContain(compact('Hors des heures légales'));
  });

  it("critère 2 : given la réglette, when je fais glisser le curseur vers le passé, then il s'arrête sur « Maintenant » et aucun moment passé n'est calculé", async () => {
    const env = await afficher();

    await glisser(env, px(14.34), px(5));

    expect(valeurLue(env.page)).toBe(compact('Maintenant 14 h 20'));
    expect(texteLu(env.page)).toBe(compact('Maintenant 14 h 20'));
    expect(env.appelsReleve.every((d) => d.getTime() >= MAINTENANT.getTime())).toBe(true);
    expect(env.appelsMoteur.every((d) => d.getTime() >= MAINTENANT.getTime())).toBe(true);
  });

  it("critère 3 : given la réglette, when je touche « Demain », then la réglette montre le lendemain (libellé, boutons de jour, heures légales de demain, plus de passé)", async () => {
    const env = await afficher();
    expect(boutonJour(env.page, 'Demain')).toBeDefined();
    expect(boutonJour(env.page, "Aujourd'hui")).toBeUndefined();

    boutonJour(env.page, 'Demain')!.click();
    await env.stabiliser();

    expect(valeurLue(env.page).startsWith('Demain')).toBe(true);
    expect(texteLu(env.page).startsWith('Demain')).toBe(true);
    expect(boutonJour(env.page, "Aujourd'hui")).toBeDefined();
    expect(boutonJour(env.page, 'Après-demain')).toBeDefined();
    expect(boutonJour(env.page, 'Demain')).toBeUndefined();
    const bloc = reglette(env.page);
    expect(bloc.querySelector('.legal')).not.toBeNull();
    expect(compact(bloc.querySelector('.reperes')?.textContent)).toContain(compact('7 h 02'));
    expect(bloc.querySelector('.passe')).toBeNull();
    expect(bloc.querySelector('.maint')).toBeNull();
  });

  it("critère 3 : given la réglette, when je touche « Demain », then le conseil suit le moment choisi (conditions, moteur et coups de demain)", async () => {
    const env = await afficher();

    boutonJour(env.page, 'Demain')!.click();
    await env.stabiliser();

    const dernierReleve = env.appelsReleve.at(-1)!;
    expect(jourDemain(dernierReleve)).toBe(true);
    expect(env.appelsMoteur.at(-1)?.getTime()).toBe(dernierReleve.getTime());
    expect(temperatureAffichee(env.page)).toBe(compact('9,2 °C'));
    expect(premierCoup(env.page)).toContain(compact('Cuillère tournante'));
  });

  it("critère 3 : given demain affiché, when je touche « Après-demain » puis tire le curseur au bout, then le curseur s'arrête avant Maintenant + 48 h", async () => {
    const env = await afficher();
    boutonJour(env.page, 'Demain')!.click();
    await env.stabiliser();
    boutonJour(env.page, 'Après-demain')!.click();
    await env.stabiliser();
    expect(valeurLue(env.page).startsWith(compact('Après-demain'))).toBe(true);

    await glisser(env, px(7), LARGEUR);

    expect(valeurLue(env.page).startsWith(compact('Après-demain'))).toBe(true);
    expect(env.appelsReleve.every((d) => d.getTime() <= LIMITE_48H.getTime())).toBe(true);
    expect(env.appelsReleve.at(-1)!.getTime()).toBeGreaterThan(DEMAIN_FIN.getTime());
  });

  it("critère 4 : given le curseur sur une heure hors des heures légales, when je le tire, then l'écran Conseil garde ses coups jusqu'au relâchement", async () => {
    const env = await afficher();

    await glisserSansRelacher(env, px(14.34), px(21));

    expect(valeurLue(env.page)).toBe(compact('Ce soir 21 h'));
    expect(liensDesCoups(env.page).length).toBeGreaterThan(0);
    expect(compact(env.page.textContent)).not.toContain(compact('Hors des heures légales'));
    await relacher(env, px(21));
  });

  it("critère 4 : given le curseur sur une heure hors des heures légales (21 h), when je le relâche, then l'écran Conseil passe dans l'état « hors des heures légales »", async () => {
    const env = await afficher();

    await glisser(env, px(14.34), px(21));

    const texte = compact(env.page.textContent);
    expect(texte).toContain(compact('Hors des heures légales : pas de pêche aux carnassiers la nuit.'));
    expect(texte).toContain(compact('7 h 02 – 18 h 31'));
    expect(liensDesCoups(env.page)).toHaveLength(0);
    expect(compact(env.page.querySelector('button.etat')?.textContent)).toContain(compact('Pêche fermée'));
    expect(valeurLue(env.page)).toBe(compact('Ce soir 21 h'));
    expect(env.appelsReleve.at(-1)?.getTime()).toBe(CE_SOIR_21H.getTime());
  });

  it("critère 5 : given la réglette au clavier, when je règle avec les flèches, then la piste est un slider focalisable et le moment change de 30 min par appui", async () => {
    const env = await afficher();
    const piste = curseurDe(env.page);
    expect(piste.getAttribute('role')).toBe('slider');
    expect(piste.getAttribute('tabindex')).toBe('0');
    expect(piste.getAttribute('aria-label')).toBe('Moment du conseil');
    const avant = Number(piste.getAttribute('aria-valuenow'));
    expect(Number.isFinite(avant)).toBe(true);
    expect(Number.isFinite(Number(piste.getAttribute('aria-valuemin')))).toBe(true);
    expect(Number.isFinite(Number(piste.getAttribute('aria-valuemax')))).toBe(true);

    await touche(env, 'ArrowRight');
    expect(valeurLue(env.page)).toBe(compact('Cet après-midi 14 h 30'));
    expect(env.appelsReleve.at(-1)?.getTime()).toBe(APRES_MIDI_14H30.getTime());
    const apres = Number(curseurDe(env.page).getAttribute('aria-valuenow'));
    expect(apres).toBeGreaterThan(avant);

    await touche(env, 'ArrowRight');
    expect(valeurLue(env.page)).toBe(compact('Cet après-midi 15 h'));
    expect(env.appelsReleve.at(-1)?.getTime()).toBe(APRES_MIDI_15H.getTime());
    expect(env.appelsMoteur.at(-1)?.getTime()).toBe(APRES_MIDI_15H.getTime());

    await touche(env, 'ArrowLeft');
    expect(valeurLue(env.page)).toBe(compact('Cet après-midi 14 h 30'));
    expect(env.appelsReleve.at(-1)?.getTime()).toBe(APRES_MIDI_14H30.getTime());
  });

  it("critère 5 : given la réglette avec VoiceOver, when je la règle avec les flèches, then sa valeur est annoncée en clair par aria-valuetext", async () => {
    const env = await afficher();

    await touche(env, 'ArrowRight');
    await touche(env, 'ArrowRight');

    expect(curseurDe(env.page).getAttribute('aria-valuetext')).toBe('Cet après-midi 15 h');
    expect(valeurLue(env.page)).toBe(texteLu(env.page));
  });

  it("critère 5 : given un moment réglé aux flèches, when j'appuie sur « Début », then le curseur revient sur « Maintenant » et le conseil à l'instant présent", async () => {
    const env = await afficher();
    await touche(env, 'ArrowRight');
    await touche(env, 'ArrowRight');

    await touche(env, 'Home');

    expect(texteLu(env.page)).toBe(compact('Maintenant 14 h 20'));
    expect(env.appelsReleve.at(-1)?.getTime()).toBe(MAINTENANT.getTime());
    expect(temperatureAffichee(env.page)).toBe(compact('11,5 °C'));
  });

  it("critère 5 : given « Maintenant », when j'appuie sur la flèche gauche, then le curseur reste sur « Maintenant » (le passé n'est pas choisissable)", async () => {
    const env = await afficher();

    await touche(env, 'ArrowLeft');

    expect(texteLu(env.page)).toBe(compact('Maintenant 14 h 20'));
    expect(env.appelsReleve.every((d) => d.getTime() >= MAINTENANT.getTime())).toBe(true);
  });

  it("critère 6 : given un téléphone de 390 px, when je mesure le curseur, then sa zone tactile fait au moins 48 × 48 px", async () => {
    const env = await afficher();
    const curseur = curseurDe(env.page).querySelector<HTMLElement>('.curseur');
    expect(curseur, 'curseur (.curseur) dans la piste').not.toBeNull();

    const style = getComputedStyle(curseur!);
    const mesure = (...proprietes: string[]): number => Math.max(...proprietes.map((p) => parseFloat(style.getPropertyValue(p)) || 0));
    expect(mesure('width', 'min-width')).toBeGreaterThanOrEqual(48);
    expect(mesure('height', 'min-height')).toBeGreaterThanOrEqual(48);
    const pisteStyle = getComputedStyle(curseurDe(env.page));
    expect(Math.max(parseFloat(pisteStyle.height) || 0, parseFloat(pisteStyle.minHeight) || 0)).toBeGreaterThanOrEqual(48);
  });
});
