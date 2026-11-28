/*
 * US 83 : choisir l'espèce visée. Maquette de référence : docs/maquettes/us-83-choisir-l-espece.html.
 *
 * Contrat du DOM (neutre sur les balises autres que ceux-ci) :
 *  - un `button` (ou `ion-button`) dont le texte contient « Espèce » et la valeur choisie (« Toutes les espèces » au départ) ;
 *  - un tap dessus ouvre, dans la page (pas d'ion-modal), un élément `[role="dialog"]` titré « Espèce visée »,
 *    qui contient un `[role="radiogroup"]` de lignes `[role="radio"]` avec `aria-checked` :
 *    « Toutes les espèces » puis `CatalogService.especes()` dans l'ordre ;
 *  - un tap sur une ligne la choisit et ferme la feuille ; un `button` « Annuler » ferme sans rien changer ;
 *  - le moteur reçoit `conditions.especeCible` = code de l'espèce (absent pour « Toutes les espèces »).
 * Le double de ConditionsService reproduit le vrai : il pose `especeCible` si la demande le porte ; la page peut donc
 * le passer à `releve({ especeCible })` ou le poser sur les conditions avant d'appeler le moteur.
 * Le choix n'est pas mémorisé : une nouvelle page repart sur « Toutes les espèces ».
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, Espece, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import especesReelles from '../../../assets/data/species.json';
import { ConseilPage } from './conseil.page';
import { textesDesCoups } from './conseil.page.aides';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-09T06:32:00Z'), coucher: new Date('2026-11-09T17:01:00Z') };
const DANS_LES_HEURES = new Date('2026-11-09T12:00:00Z');

const CONDITIONS: Conditions = {
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
};

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'jig', nom: 'Jig à jupe' },
  { id: 'ver', nom: 'Ver souple finesse' },
  { id: 'lame', nom: 'Lame vibrante' },
  { id: 'cuiller', nom: 'Cuiller ondulante' },
  { id: 'souple', nom: 'Leurre souple (finesse)' },
] as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tirée-relâchée' },
  { id: 'gratte', nom: 'Gratté' },
  { id: 'dropshot', nom: 'Drop shot' },
  { id: 'dandine', nom: 'Dandine' },
] as Animation[];
const COULEURS = [
  { id: 'gardon', nom: 'Gardon' },
  { id: 'naturel', nom: 'Naturel' },
  { id: 'argent', nom: 'Argent' },
] as Couleur[];

const conseil = (surcharge: Partial<Conseil>): Conseil => ({
  typeId: 'shad',
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 10,
  pourquoi: ['Phrase. Autre phrase.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
  ...surcharge,
});

const POUR_TOUTES: ResultatConseil = {
  conseils: [
    conseil({ typeId: 'shad', techniqueId: 'tiree', score: 9 }),
    conseil({ typeId: 'jig', techniqueId: 'gratte', score: 7, taille: { valeur: 10, unite: 'g' } }),
    conseil({ typeId: 'ver', techniqueId: 'dropshot', score: 5 }),
  ],
  explications: [],
};
const POUR_SANDRE: ResultatConseil = {
  conseils: [
    conseil({ typeId: 'shad', techniqueId: 'tiree', score: 9, couleur: 'gardon' }),
    conseil({ typeId: 'souple', techniqueId: 'gratte', score: 8, couleur: 'naturel', taille: { valeur: 7, unite: 'cm' } }),
    conseil({ typeId: 'lame', techniqueId: 'dandine', score: 6, couleur: 'argent', taille: { valeur: 14, unite: 'g' } }),
  ],
  explications: [],
};
const POUR_TRUITE: ResultatConseil = {
  conseils: [conseil({ typeId: 'cuiller', techniqueId: 'tiree', especeCode: 'TRF', score: 8, couleur: 'argent' })],
  explications: [],
};

const TRUITE = { ...(especesReelles[1] as unknown as Espece), code: 'TRF', nom: 'Truite fario' } as Espece;
const ESPECES_REELLES = especesReelles as unknown as Espece[];

interface Reglages {
  especes?: Espece[];
  resultatPour?: (especeCible: string | undefined) => ResultatConseil;
}

async function afficher({ especes = ESPECES_REELLES, resultatPour }: Reglages = {}) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(DANS_LES_HEURES);
  const appelsMoteur: Conditions[] = [];
  const pour =
    resultatPour ?? ((cible: string | undefined) => (cible === 'SAN' ? POUR_SANDRE : cible === 'TRF' ? POUR_TRUITE : POUR_TOUTES));
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
          especes: async () => especes,
        },
      },
      {
        provide: ConditionsService,
        useValue: {
          releve: async (demande: { especeCible?: string }): Promise<ReleveActuel> => ({
            conditions: {
              ...CONDITIONS,
              ...(demande.especeCible !== undefined && demande.especeCible !== 'toutes' ? { especeCible: demande.especeCible } : {}),
            },
            pressionHpa: 1012,
            moinsPrecis: false,
          }),
        },
      },
      {
        provide: AstroService,
        useValue: { soleil: (): SoleilDuJour => SOLEIL, lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) },
      },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async (conditions: Conditions) => {
            appelsMoteur.push(conditions);
            return pour(conditions.especeCible);
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
  return { page: fixture.nativeElement as HTMLElement, appelsMoteur, stabiliser };
}

afterEach(() => vi.useRealTimers());

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');

function boutonEspece(page: HTMLElement): HTMLElement {
  const bouton = [...page.querySelectorAll<HTMLElement>('button, ion-button')].find((b) => compact(b.textContent).startsWith(compact('Espèce')));
  if (!bouton) throw new Error('aucun bouton « Espèce »');
  return bouton;
}
const feuille = (page: HTMLElement): HTMLElement | null => page.querySelector<HTMLElement>('app-espece-feuille [role="dialog"]');
const lignes = (page: HTMLElement): HTMLElement[] => [...(feuille(page)?.querySelectorAll<HTMLElement>('[role="radiogroup"] [role="radio"]') ?? [])];
const noms = (page: HTMLElement): string[] => lignes(page).map((l) => (l.textContent ?? '').replace(/[✓\s\u00a0\u202f]+$/g, '').trim());
/** Les coups : le « 01 » de la rivière, puis les « 02 » et « 03 » de la feuille « 2 autres coups » (texte compact). */
const cartesConseil = (env: Awaited<ReturnType<typeof afficher>>): Promise<string[]> => textesDesCoups(env);

async function ouvrir(env: Awaited<ReturnType<typeof afficher>>) {
  boutonEspece(env.page).click();
  await env.stabiliser();
}
async function choisir(env: Awaited<ReturnType<typeof afficher>>, nom: string) {
  const ligne = lignes(env.page).find((l) => compact(l.textContent).startsWith(compact(nom)));
  if (!ligne) throw new Error(`aucune ligne « ${nom} »`);
  ligne.click();
  await env.stabiliser();
}

describe('ConseilPage : choix de l\'espèce visée (US 83)', () => {
  it('critère 1 : given j\'ouvre l\'écran « Conseil », when je regarde le choix de l\'espèce, then il affiche « Toutes les espèces »', async () => {
    const env = await afficher();
    const { page, appelsMoteur } = env;

    const bouton = boutonEspece(page);
    expect(compact(bouton.textContent)).toContain(compact('Toutes les espèces'));
    expect(feuille(page), 'la feuille est fermée au départ').toBeNull();
    expect(appelsMoteur[0]?.especeCible).toBeUndefined();
    expect(await cartesConseil(env)).toHaveLength(3);
  });

  it('critère 2 : given le choix de l\'espèce est ouvert, when je regarde la liste, then elle propose « Toutes les espèces » puis chaque espèce du contenu (7 au lancement), dans l\'ordre de species.json', async () => {
    const env = await afficher();
    await ouvrir(env);

    const dialogue = feuille(env.page);
    expect(dialogue, 'aucun role="dialog"').not.toBeNull();
    expect(env.page.querySelector('ion-modal')).toBeNull();
    expect(compact(dialogue!.textContent)).toContain(compact('Espèce visée'));
    expect(ESPECES_REELLES).toHaveLength(7);
    expect(noms(env.page)).toEqual(['Toutes les espèces', ...ESPECES_REELLES.map((e) => e.nom)]);
    expect(lignes(env.page)).toHaveLength(8);
    expect(lignes(env.page)[0].getAttribute('aria-checked')).toBe('true');
    expect(lignes(env.page).slice(1).every((l) => l.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('critère 3 : given le choix de l\'espèce est ouvert, when je choisis « Sandre », then le choix affiche « Sandre » et les 3 conseils sont recalculés pour le sandre', async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Sandre');

    expect(compact(boutonEspece(env.page).textContent)).toContain(compact('Sandre'));
    expect(compact(boutonEspece(env.page).textContent)).not.toContain(compact('Toutes les espèces'));
    expect(feuille(env.page), 'la feuille se ferme au choix').toBeNull();
    expect(env.appelsMoteur.at(-1)?.especeCible).toBe('SAN');
    const cartes = await cartesConseil(env);
    expect(cartes).toHaveLength(3);
    expect(cartes[0]).toContain('Shad');
    expect(cartes[1]).toContain(compact('Leurre souple (finesse)'));
    expect(cartes[2]).toContain(compact('Lame vibrante'));
    expect(compact(env.page.textContent)).toContain(compact('11,5 °C'));
  });

  it('critère 3 : given « Sandre » choisi, when je rouvre la liste, then « Sandre » est la ligne cochée', async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Sandre');
    await ouvrir(env);

    const cochees = lignes(env.page).filter((l) => l.getAttribute('aria-checked') === 'true');
    expect(cochees).toHaveLength(1);
    expect(compact(cochees[0].textContent)).toContain(compact('Sandre'));
  });

  it('critère 3 : given « Sandre » choisi, when je rechoisis « Toutes les espèces », then le moteur est rappelé sans espèce cible', async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Sandre');
    await ouvrir(env);
    await choisir(env, 'Toutes les espèces');

    expect(compact(boutonEspece(env.page).textContent)).toContain(compact('Toutes les espèces'));
    expect(env.appelsMoteur.at(-1)?.especeCible).toBeUndefined();
    expect((await cartesConseil(env))[1]).toContain(compact('Jig à jupe'));
  });

  it('critère 3 : given le choix ouvert, when je touche « Annuler », then la feuille se ferme sans changer le choix ni les conseils', async () => {
    const env = await afficher();
    const appelsAvant = env.appelsMoteur.length;
    await ouvrir(env);
    const annuler = [...feuille(env.page)!.querySelectorAll<HTMLElement>('button, ion-button')].find((b) => compact(b.textContent) === compact('Annuler'));
    expect(annuler, 'aucun bouton « Annuler »').toBeDefined();
    annuler!.click();
    await env.stabiliser();

    expect(feuille(env.page)).toBeNull();
    expect(compact(boutonEspece(env.page).textContent)).toContain(compact('Toutes les espèces'));
    expect(env.appelsMoteur).toHaveLength(appelsAvant);
  });

  it('critère 3 : given une page rouverte (nouvelle ouverture de l\'app), when elle s\'affiche, then le choix repart sur « Toutes les espèces »', async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Sandre');
    TestBed.resetTestingModule();
    vi.useRealTimers();

    const neuf = await afficher();
    expect(compact(boutonEspece(neuf.page).textContent)).toContain(compact('Toutes les espèces'));
    expect(neuf.appelsMoteur[0]?.especeCible).toBeUndefined();
  });

  it('critère 3 : given le moteur qui ne trouve aucun conseil pour l\'espèce, when je la choisis, then « Aucun conseil pour cette espèce en ce moment. » remplace les cartes', async () => {
    const env = await afficher({ resultatPour: (cible) => (cible === 'SAN' ? { conseils: [], explications: [] } : POUR_TOUTES) });
    await ouvrir(env);
    await choisir(env, 'Sandre');

    expect(compact(env.page.textContent)).toContain(compact('Aucun conseil pour cette espèce en ce moment.'));
    expect(env.page.querySelector('a.coup')).toBeNull();
  });

  it('critère 4 : given une 8e espèce de test dans le contenu, when j\'ouvre le choix de l\'espèce, then elle apparaît dans la liste (8 espèces + « Toutes les espèces ») sans modification du code', async () => {
    const env = await afficher({ especes: [...ESPECES_REELLES, TRUITE] });
    await ouvrir(env);

    expect(lignes(env.page)).toHaveLength(9);
    expect(noms(env.page)).toEqual(['Toutes les espèces', ...ESPECES_REELLES.map((e) => e.nom), 'Truite fario']);
  });

  it('critère 4 : given une 8e espèce de test, when je la choisis, then le moteur est appelé avec son code et les conseils affichés sont ceux de cette espèce', async () => {
    const env = await afficher({ especes: [...ESPECES_REELLES, TRUITE] });
    await ouvrir(env);
    await choisir(env, 'Truite fario');

    expect(compact(boutonEspece(env.page).textContent)).toContain(compact('Truite fario'));
    expect(env.appelsMoteur.at(-1)?.especeCible).toBe('TRF');
    const cartes = await cartesConseil(env);
    expect(cartes).toHaveLength(1);
    expect(cartes[0]).toContain(compact('Cuiller ondulante'));
  });
});
