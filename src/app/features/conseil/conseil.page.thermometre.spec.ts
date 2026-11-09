/*
 * US 85 : saisir la température de l'eau mesurée au thermomètre. Maquette de référence : docs/maquettes/us-85-saisie-thermometre.html.
 *
 * Contrat du DOM que ces tests supposent (tout est rendu dans la carte « Conditions », ligne de l'eau) :
 *  - Un `button` « J'ai mesuré l'eau », présent quand la saisie est fermée (y compris eau inconnue et mesure déjà saisie).
 *  - Au toucher : le bouton laisse place à un `input` libellé « Température de l'eau (°C) » (`label[for]`, `aria-label` ou `label` englobant)
 *    et à deux `button` « Annuler » et « Valider ». Une virgule est acceptée (« 12,5 »).
 *  - Refus : le champ reste ouvert, un `[role="alert"]` porte « Entre une température entre 0 et 35 °C. », rien n'est enregistré
 *    ni recalculé. Succès : le champ se ferme, le bouton « J'ai mesuré l'eau » revient, les conditions et le top 3 sont recalculés.
 *  - La page lit la mesure dans `SaisieTempEauStore` (core/data/saisie-temp-eau.store.ts) et la passe en `saisieTempEau`
 *    dans chaque appel à `ConditionsService.releve()` (maintenant et moments choisis).
 *
 * Doubles : PositionService, CatalogService, AstroService, MoteurService (comme les specs US 81/82). ConditionsService est un
 * double qui applique la règle du service réel (`saisieRecente` : mesure de moins de 6 h au moment visé, sinon station Hub'Eau).
 * Temps : faux timers sur `Date`. Maintenant = 9 novembre 2026, 9 h 12 à Paris (08:12Z, UTC+1).
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, DemandeConditions, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SaisieTempEauStore } from '../../core/data/saisie-temp-eau.store';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { SaisieTempEau, saisieRecente } from '../../core/engine/temperature-eau';
import { ConseilPage } from './conseil.page';

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};

const HEURE_MS = 3600 * 1000;
const JOUR_MS = 24 * HEURE_MS;
const MAINTENANT = new Date('2026-11-09T08:12:00Z'); // 9 h 12 à Paris
const DEMAIN_7H = new Date('2026-11-10T06:00:00Z'); // 21 h 48 après MAINTENANT
const LEVER_DU_9 = new Date('2026-11-09T06:32:00Z');
const COUCHER_DU_9 = new Date('2026-11-09T17:01:00Z');
/** Même lever et même coucher chaque jour : heures légales 7 h 02 – 18 h 31 à Paris. */
function soleilDu(moment: Date): SoleilDuJour {
  const jours = Math.floor(moment.getTime() / JOUR_MS) - Math.floor(LEVER_DU_9.getTime() / JOUR_MS);
  return { lever: new Date(LEVER_DU_9.getTime() + jours * JOUR_MS), coucher: new Date(COUCHER_DU_9.getTime() + jours * JOUR_MS) };
}

const STATION = { nom: 'La Maine à Angers', distanceKm: 4 };
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

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'jig', nom: 'Jig à jupe' },
  { id: 'ver', nom: 'Ver souple finesse' },
  { id: 'minnow', nom: 'Leurre dur (minnow)' },
] as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tirée-relâchée' },
  { id: 'gratte', nom: 'Gratté' },
  { id: 'dropshot', nom: 'Drop shot' },
] as Animation[];
const COULEURS = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];

const conseil = (typeId: string, techniqueId: string, score: number): Conseil => ({
  typeId,
  techniqueId,
  especeCode: 'SAN',
  score,
  pourquoi: ['Première phrase. Deuxième phrase du moteur.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
});
/** Top 3 rendu pour une eau de station, puis pour une eau mesurée au thermomètre. */
const TOP3_STATION: ResultatConseil = {
  conseils: [conseil('shad', 'tiree', 9), conseil('jig', 'gratte', 7), conseil('ver', 'dropshot', 5)],
  explications: [],
};
const TOP3_SAISIE: ResultatConseil = {
  conseils: [conseil('minnow', 'tiree', 9), conseil('ver', 'dropshot', 7), conseil('jig', 'gratte', 5)],
  explications: [],
};

/** Mesure de 9 °C prise à `MAINTENANT − ageH` heures. */
const mesure = (ageH: number, valeurC = 9): SaisieTempEau => ({ valeurC, mesureeA: new Date(MAINTENANT.getTime() - ageH * HEURE_MS) });

interface Reglages {
  /** Mesure déjà gardée sur le téléphone ; `undefined` = rien. Ignoré avec `vraiStore`. */
  deja?: SaisieTempEau;
  /** Utilise le vrai `SaisieTempEauStore` (localStorage de jsdom) au lieu d'un double en mémoire. */
  vraiStore?: boolean;
  /** Source de l'eau quand la mesure n'est pas utilisée. */
  sansMesure?: 'capteur' | 'estimation' | 'inconnue';
  maintenant?: Date;
}

async function configurer({ deja, vraiStore = false, sansMesure = 'capteur', maintenant = MAINTENANT }: Reglages = {}) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(maintenant);
  const appelsReleve: DemandeConditions[] = [];
  const appelsMoteur: { conditions: Conditions; moment: Date }[] = [];
  const ecritures: SaisieTempEau[] = [];
  let gardee = deja ?? null;
  const store = { lire: () => gardee, ecrire: (s: SaisieTempEau) => { ecritures.push(s); gardee = s; } };
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      ...(vraiStore ? [] : [{ provide: SaisieTempEauStore, useValue: store }]),
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
          releve: async (demande: DemandeConditions): Promise<ReleveActuel> => {
            appelsReleve.push(demande);
            const moment = demande.moment ?? new Date();
            if (saisieRecente(demande.saisieTempEau, moment) && demande.saisieTempEau) {
              return {
                conditions: conditionsDe({ tempEau: demande.saisieTempEau.valeurC, sourceTempEau: 'saisie' }),
                pressionHpa: 1012,
                moinsPrecis: false,
                saisieA: demande.saisieTempEau.mesureeA,
              };
            }
            if (sansMesure === 'inconnue') {
              return { conditions: conditionsDe({ tempEau: null, sourceTempEau: null }), pressionHpa: 1012, moinsPrecis: false };
            }
            return sansMesure === 'estimation'
              ? { conditions: conditionsDe({ tempEau: 8, sourceTempEau: 'estimation' }), pressionHpa: 1012, moinsPrecis: false }
              : { conditions: conditionsDe({}), pressionHpa: 1012, moinsPrecis: false, stationEau: STATION };
          },
        },
      },
      {
        provide: AstroService,
        useValue: { soleil: (_l: unknown, moment: Date): SoleilDuJour => soleilDu(moment), lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) },
      },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async (conditions: Conditions, moment: Date): Promise<ResultatConseil> => {
            appelsMoteur.push({ conditions, moment });
            return conditions.sourceTempEau === 'saisie' ? TOP3_SAISIE : TOP3_STATION;
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
  return { fixture, page: fixture.nativeElement as HTMLElement, stabiliser, appelsReleve, appelsMoteur, ecritures };
}
type Env = Awaited<ReturnType<typeof configurer>>;

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');
const boutons = (racine: ParentNode): HTMLElement[] => [...racine.querySelectorAll<HTMLElement>('button, ion-button')];

function carte(page: HTMLElement): HTMLElement {
  const titre = [...page.querySelectorAll('h1, h2, h3, h4, h5, h6, ion-card-title')].find((t) => t.textContent?.trim() === 'Conditions');
  const c = titre?.closest('section, article, ion-card') as HTMLElement | null;
  if (!c) throw new Error('aucune carte titrée « Conditions »');
  return c;
}
const texteCarte = (page: HTMLElement): string => compact(carte(page).textContent);

function boutonDans(racine: HTMLElement, texte: string): HTMLElement | undefined {
  return boutons(racine).find((b) => compact(b.textContent) === compact(texte));
}
function bouton(page: HTMLElement, texte: string): HTMLElement {
  const b = boutonDans(carte(page), texte);
  if (!b) throw new Error(`Aucun bouton « ${texte} » dans la carte « Conditions »`);
  return b;
}
function champ(page: HTMLElement): HTMLInputElement | undefined {
  const c = carte(page);
  return [...c.querySelectorAll<HTMLInputElement>('input')].find((i) => {
    const parLabel = i.id ? c.querySelector(`label[for="${i.id}"]`) : null;
    const libelle = i.getAttribute('aria-label') ?? parLabel?.textContent ?? i.closest('label')?.textContent ?? '';
    return compact(libelle).startsWith(compact("Température de l'eau (°C)"));
  });
}
function champOuvert(page: HTMLElement): HTMLInputElement {
  const i = champ(page);
  if (!i) throw new Error("Aucun champ libellé « Température de l'eau (°C) » dans la carte « Conditions »");
  return i;
}

async function ouvrirSaisie(env: Env): Promise<void> {
  bouton(env.page, "J'ai mesuré l'eau").click();
  await env.stabiliser();
}
async function saisir(env: Env, texte: string): Promise<void> {
  const i = champOuvert(env.page);
  i.value = texte;
  i.dispatchEvent(new Event('input', { bubbles: true }));
  i.dispatchEvent(new Event('change', { bubbles: true }));
  await env.stabiliser();
}
async function valider(env: Env): Promise<void> {
  bouton(env.page, 'Valider').click();
  await env.stabiliser();
}
async function mesurer(env: Env, texte: string): Promise<void> {
  await ouvrirSaisie(env);
  await saisir(env, texte);
  await valider(env);
}

/** Les cartes de conseil : les `section`, `article` ou `ion-card` les plus internes dont le texte contient « Animation : ». */
function cartesConseil(page: HTMLElement): string[] {
  return [...page.querySelectorAll<HTMLElement>('section, article, ion-card')]
    .filter((e) => compact(e.textContent).includes(compact('Animation :')) && !e.querySelector('section, article, ion-card') && !e.closest('[role="dialog"]'))
    .map((e) => compact(e.textContent));
}

// Choix d'un moment (contrat de la US 82).
async function choisirDemain7h(env: Env): Promise<void> {
  const dialogue = () => env.page.querySelector<HTMLElement>('[role="dialog"]');
  const selecteur = boutons(env.page).find((b) => !b.closest('[role="dialog"]') && compact(b.textContent).includes('Moment'));
  selecteur?.click();
  await env.stabiliser();
  const cliquable = (t: string) =>
    [...dialogue()!.querySelectorAll<HTMLElement>('button, ion-button, [role="radio"], label')].find((e) => compact(e.textContent) === compact(t));
  cliquable('Demain')?.click();
  await env.stabiliser();
  const select = [...dialogue()!.querySelectorAll<HTMLSelectElement>('select')][0];
  const option = [...select.options].find((o) => compact(o.textContent) === compact('7 h'));
  select.value = option!.value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await env.stabiliser();
  cliquable('Valider')?.click();
  await env.stabiliser();
}
async function choisirMaintenant(env: Env): Promise<void> {
  const selecteur = boutons(env.page).find((b) => !b.closest('[role="dialog"]') && compact(b.textContent).includes('Moment'));
  selecteur?.click();
  await env.stabiliser();
  boutonDans(env.page.querySelector<HTMLElement>('[role="dialog"]')!, 'Maintenant')?.click();
  await env.stabiliser();
}

const MESSAGE = 'Entre une température entre 0 et 35 °C.';

describe('ConseilPage : température mesurée au thermomètre (US 85)', () => {
  it("critère 1 : given l'écran Conseil est affiché, when je touche « J'ai mesuré l'eau », then un champ « Température de l'eau (°C) » et un bouton « Valider » s'affichent", async () => {
    const env = await configurer();
    expect(champ(env.page), 'le champ est fermé tant qu\'on n\'a rien touché').toBeUndefined();

    await ouvrirSaisie(env);

    const i = champOuvert(env.page);
    expect(i.getAttribute('inputmode')).toBe('decimal');
    expect(boutonDans(carte(env.page), 'Valider')).toBeDefined();
    expect(boutonDans(carte(env.page), 'Annuler')).toBeDefined();
    expect(boutonDans(carte(env.page), "J'ai mesuré l'eau"), 'le bouton laisse place au champ').toBeUndefined();
  });

  it("critère 1 : given l'eau est inconnue (« Mesure-la au thermomètre »), when je regarde la carte, then le bouton « J'ai mesuré l'eau » est là et ouvre le champ", async () => {
    const env = await configurer({ sansMesure: 'inconnue' });

    expect(texteCarte(env.page)).toContain(compact("Température de l'eau inconnue"));
    await ouvrirSaisie(env);

    expect(champOuvert(env.page)).toBeDefined();
  });

  it("critère 2 : given le champ est affiché, when j'entre 9 et je touche « Valider », then la carte « Conditions » affiche 9 °C avec la source « Mesurée au thermomètre à 9 h 12 »", async () => {
    const env = await configurer();
    expect(texteCarte(env.page)).toContain(compact("Température de l'eau : 11,5 °C"));

    await mesurer(env, '9');

    const texte = texteCarte(env.page);
    expect(texte).toContain(compact("Température de l'eau : 9 °C"));
    expect(texte).toContain(compact('Mesurée au thermomètre à 9 h 12'));
    expect(texte).not.toContain(compact("Station Hub'Eau"));
    expect(champ(env.page), 'la saisie se ferme').toBeUndefined();
    expect(boutonDans(carte(env.page), "J'ai mesuré l'eau"), 'le bouton revient pour corriger').toBeDefined();
  });

  it("critère 2 : given le champ est affiché, when j'entre 9 et je touche « Valider », then la mesure est gardée avec l'instant présent", async () => {
    const env = await configurer();

    await mesurer(env, '9');

    expect(env.ecritures).toHaveLength(1);
    expect(env.ecritures[0].valeurC).toBe(9);
    expect(env.ecritures[0].mesureeA.getTime()).toBe(MAINTENANT.getTime());
  });

  it("critère 2 : given le champ est affiché, when j'entre 9 et je touche « Valider », then les conditions sont redemandées avec la mesure et les 3 conseils sont recalculés", async () => {
    const env = await configurer();
    const avant = env.appelsMoteur.length;
    expect(cartesConseil(env.page)[0]).toContain(compact('Shad'));

    await mesurer(env, '9');

    expect(env.appelsReleve.at(-1)?.saisieTempEau?.valeurC).toBe(9);
    expect(env.appelsMoteur.length).toBeGreaterThan(avant);
    const dernier = env.appelsMoteur.at(-1);
    expect(dernier?.conditions.tempEau).toBe(9);
    expect(dernier?.conditions.sourceTempEau).toBe('saisie');
    const cartes = cartesConseil(env.page);
    expect(cartes).toHaveLength(3);
    expect(cartes[0]).toContain(compact('Leurre dur (minnow)'));
    expect(cartes[1]).toContain(compact('Ver souple finesse'));
    expect(cartes[2]).toContain(compact('Jig à jupe'));
    expect(compact(env.page.textContent)).not.toContain(compact('Shad'));
  });

  it('critère 2 : given le champ est affiché, when j\'entre « 12,5 » avec une virgule et je valide, then la carte affiche 12,5 °C', async () => {
    const env = await configurer();

    await mesurer(env, '12,5');

    expect(texteCarte(env.page)).toContain(compact("Température de l'eau : 12,5 °C"));
    expect(env.ecritures[0]?.valeurC).toBe(12.5);
  });

  it.each([['0'], ['35']])('critère 2 : given le champ est affiché, when j\'entre la borne %s et je valide, then la mesure est acceptée (bornes incluses)', async (borne) => {
    const env = await configurer();

    await mesurer(env, borne);

    expect(env.ecritures).toHaveLength(1);
    expect(env.ecritures[0].valeurC).toBe(Number(borne));
    expect(texteCarte(env.page)).toContain(compact(`Température de l'eau : ${borne} °C`));
    expect(env.page.querySelector('[role="alert"]')).toBeNull();
  });

  it("critère 2 : given une eau inconnue, when j'entre 12,5 et je valide, then la carte affiche 12,5 °C mesurée au thermomètre", async () => {
    const env = await configurer({ sansMesure: 'inconnue' });

    await mesurer(env, '12,5');

    expect(texteCarte(env.page)).toContain(compact("Température de l'eau : 12,5 °C"));
    expect(texteCarte(env.page)).toContain(compact('Mesurée au thermomètre à 9 h 12'));
  });

  it.each([
    ['vide', ''],
    ['des espaces', '   '],
    ['non numérique', 'abc'],
    ['partiellement numérique', '12abc'],
    ['sous zéro', '-0,5'],
    ['juste au-dessus de 35', '35,1'],
    ['bien au-dessus de 35', '42'],
  ])('critère 3 : given le champ est affiché, when la valeur est %s et je touche « Valider », then la saisie est refusée avec « Entre une température entre 0 et 35 °C. »', async (_nom, valeur) => {
    const env = await configurer();
    const releves = env.appelsReleve.length;
    const moteur = env.appelsMoteur.length;
    await ouvrirSaisie(env);
    await saisir(env, valeur);

    await valider(env);

    const alerte = env.page.querySelector('[role="alert"]');
    expect(alerte, 'aucun [role="alert"]').not.toBeNull();
    expect(compact(alerte?.textContent)).toBe(compact(MESSAGE));
    expect(carte(env.page).contains(alerte), "l'erreur est dans la carte « Conditions »").toBe(true);
    expect(champ(env.page), 'le champ reste ouvert').toBeDefined();
    expect(env.ecritures, 'rien n\'est enregistré').toHaveLength(0);
    expect(env.appelsReleve).toHaveLength(releves);
    expect(env.appelsMoteur).toHaveLength(moteur);
    expect(texteCarte(env.page)).toContain(compact("Température de l'eau : 11,5 °C"));
  });

  it("critère 3 : given une saisie refusée, when je corrige avec 9 et je valide, then le message disparaît et la mesure est acceptée", async () => {
    const env = await configurer();
    await ouvrirSaisie(env);
    await saisir(env, '42');
    await valider(env);
    expect(env.page.querySelector('[role="alert"]')).not.toBeNull();

    await saisir(env, '9');
    await valider(env);

    expect(env.page.querySelector('[role="alert"]')).toBeNull();
    expect(env.ecritures).toHaveLength(1);
    expect(texteCarte(env.page)).toContain(compact("Température de l'eau : 9 °C"));
  });

  it("critère 3 : given le champ est affiché, when je touche « Annuler », then le champ se ferme sans rien enregistrer", async () => {
    const env = await configurer();
    await ouvrirSaisie(env);
    await saisir(env, '9');

    bouton(env.page, 'Annuler').click();
    await env.stabiliser();

    expect(champ(env.page)).toBeUndefined();
    expect(boutonDans(carte(env.page), "J'ai mesuré l'eau")).toBeDefined();
    expect(env.ecritures).toHaveLength(0);
    expect(texteCarte(env.page)).toContain(compact("Température de l'eau : 11,5 °C"));
  });

  it("critère 4 : given j'ai saisi 9 °C il y a moins de 6 h, when je rouvre l'app, then la carte « Conditions » affiche toujours 9 °C avec la source « Mesurée au thermomètre à 9 h 12 »", async () => {
    const premiere = await configurer({ vraiStore: true });
    await mesurer(premiere, '9');
    premiere.fixture.destroy();

    // 3 h plus tard, l'app est rouverte : tout est recréé, seul le téléphone a gardé la mesure.
    const rouverte = await configurer({ vraiStore: true, maintenant: new Date(MAINTENANT.getTime() + 3 * HEURE_MS) });

    const texte = texteCarte(rouverte.page);
    expect(texte).toContain(compact("Température de l'eau : 9 °C"));
    expect(texte).toContain(compact('Mesurée au thermomètre à 9 h 12'));
    expect(rouverte.appelsReleve[0]?.saisieTempEau?.valeurC).toBe(9);
    expect(rouverte.appelsMoteur.at(-1)?.conditions.sourceTempEau).toBe('saisie');
    expect(cartesConseil(rouverte.page)[0]).toContain(compact('Leurre dur (minnow)'));
  });

  it("critère 4 : given une mesure de 9 °C gardée il y a 5 h, when l'écran Conseil s'affiche, then la carte affiche 9 °C mesurée au thermomètre à 4 h 12", async () => {
    const env = await configurer({ deja: mesure(5) });

    expect(texteCarte(env.page)).toContain(compact("Température de l'eau : 9 °C"));
    expect(texteCarte(env.page)).toContain(compact('Mesurée au thermomètre à 4 h 12'));
    expect(env.appelsReleve[0]?.saisieTempEau?.mesureeA.getTime()).toBe(mesure(5).mesureeA.getTime());
  });

  it("critère 5 : given j'ai saisi une température il y a plus de 6 h, when l'écran Conseil s'affiche, then la température saisie n'est plus utilisée et la station est affichée", async () => {
    const env = await configurer({ deja: mesure(7) });

    const texte = texteCarte(env.page);
    expect(texte).toContain(compact("Température de l'eau : 11,5 °C"));
    expect(texte).toContain(compact("Station Hub'Eau La Maine à Angers, à 4 km"));
    expect(texte).not.toContain(compact('Mesurée au thermomètre'));
    expect(env.appelsMoteur.at(-1)?.conditions.sourceTempEau).toBe('capteur');
    // La page a bien transmis la mesure au service, qui seul décide de l'ignorer.
    expect(env.appelsReleve[0]?.saisieTempEau?.valeurC).toBe(9);
  });

  it("critère 5 : given j'ai saisi une température il y a plus de 6 h et pas de station, when l'écran Conseil s'affiche, then la source estimée est affichée", async () => {
    const env = await configurer({ deja: mesure(7), sansMesure: 'estimation' });

    const texte = texteCarte(env.page);
    expect(texte).toContain(compact("Estimée depuis l'air des derniers jours"));
    expect(texte).not.toContain(compact('Mesurée au thermomètre'));
    expect(env.appelsReleve[0]?.saisieTempEau?.valeurC, 'la page transmet la mesure ; le service l\'écarte').toBe(9);
  });

  it("critère 6 : given j'ai saisi une température et choisi demain 7 h (à plus de 6 h de la mesure), when l'écran Conseil se met à jour, then la température saisie n'est pas utilisée pour ce moment", async () => {
    const env = await configurer({ deja: mesure(0) });
    expect(texteCarte(env.page)).toContain(compact('Mesurée au thermomètre à 9 h 12'));

    await choisirDemain7h(env);

    const dernier = env.appelsReleve.at(-1);
    expect(dernier?.moment?.getTime()).toBe(DEMAIN_7H.getTime());
    expect(dernier?.saisieTempEau?.valeurC, 'la page passe la mesure ; le service l\'écarte').toBe(9);
    const texte = texteCarte(env.page);
    expect(texte).toContain(compact('Prévisions pour demain 7 h'));
    expect(texte).toContain(compact("Station Hub'Eau La Maine à Angers, à 4 km"));
    expect(texte).not.toContain(compact('Mesurée au thermomètre'));
    expect(env.appelsMoteur.at(-1)?.conditions.sourceTempEau).toBe('capteur');
  });

  it("critère 6 : given une mesure écartée pour demain 7 h, when je reviens à « Maintenant » dans les 6 h, then la mesure est de nouveau utilisée", async () => {
    const env = await configurer({ deja: mesure(0) });
    await choisirDemain7h(env);

    await choisirMaintenant(env);

    expect(texteCarte(env.page)).toContain(compact('Mesurée au thermomètre à 9 h 12'));
    expect(env.appelsMoteur.at(-1)?.conditions.sourceTempEau).toBe('saisie');
  });

  it("critère 6 : given je choisis demain 7 h puis je saisis 9, when je valide, then la mesure faite maintenant n'est pas appliquée à demain 7 h", async () => {
    const env = await configurer();
    await choisirDemain7h(env);

    await mesurer(env, '9');

    expect(env.ecritures).toHaveLength(1);
    const texte = texteCarte(env.page);
    expect(texte).toContain(compact('Prévisions pour demain 7 h'));
    expect(texte).not.toContain(compact('Mesurée au thermomètre'));
  });
});
