/*
 * US 84 : compléments du bandeau « Réglementation » sur l'écran Conseil (PLAN §6, §8.4).
 * Maquette de référence : docs/maquettes/us-84-bandeau-reglementation-complements.html.
 *
 * Contrat du DOM (neutre sur les balises autres que ceux-ci) :
 *  - le bandeau est l'élément `section`/`article` qui porte le titre `h2`/`h3` « Réglementation » ;
 *  - dans le bandeau : la ligne « Quota : 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum » ;
 *    une ligne « 2e catégorie : Ouvert » hors fermeture du brochet, jamais de ligne « 1re catégorie » (catégorie inconnue) ;
 *    des alertes (texte seul) « Brochet fermé en 2e catégorie », « Sandre probablement fermé, vérifie »,
 *    « Black-bass : vérifie ton département » ; la mention « À vérifier dans l'arrêté de ton département » ;
 *    un `a` « Voir la fédération de ton département » (href = url de CatalogService.federation(departement),
 *    target="_blank"), absent si la fédération est inconnue (pas de repli national) ;
 *  - chaque carte de conseil (`article` qui contient « Animation : ») finit son pourquoi par les `explications`
 *    du moteur, et affiche « Taille minimale : 60 cm » si l'espèce choisie a une tailleMinCm.
 * Le moment « maintenant » est la date système simulée ; « Demain 7 h » passe par la feuille Moment (US 82).
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { CatalogService, Espece, Federation } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import especesReelles from '../../../assets/data/species.json';
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
const FEDERATION_49: Federation = {
  departement: '49',
  nom: 'Fédération de pêche du Maine-et-Loire',
  url: 'https://fedepeche49.example',
} as Federation;

const HORS_FERMETURE = new Date('2026-11-09T13:00:00Z');
const FERMETURE_BROCHET = new Date('2027-03-10T13:00:00Z');
const PRINTEMPS_BROCHET_OUVERT = new Date('2027-05-10T13:00:00Z');
const VEILLE_DE_LA_FERMETURE = new Date('2027-01-24T13:00:00Z');

const EXPLICATION = "Brochet fermé : certains leurres sont interdits jusqu'au 24/04 (si tu es en 2e catégorie)";
const QUOTA = 'Quota : 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum';
const MENTION = "À vérifier dans l'arrêté de ton département";
const LIEN = 'Voir la fédération de ton département';

const ESPECES = especesReelles as unknown as Espece[];
const ESPECES_BROCHET_60 = ESPECES.map((e) => (e.code === 'BRO' ? { ...e, tailleMinCm: 60 } : e));

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

const conseil = (surcharge: Partial<Conseil>): Conseil => ({
  typeId: 'shad',
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 10,
  pourquoi: ['Eau froide : une animation lente convient.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
  ...surcharge,
});
const TROIS_CONSEILS: Conseil[] = [
  conseil({ typeId: 'shad', score: 9 }),
  conseil({ typeId: 'ver', score: 7 }),
  conseil({ typeId: 'jig', score: 5 }),
];

interface Reglages {
  maintenant?: Date;
  especes?: Espece[];
  federation?: Federation | undefined;
  explications?: string[];
}

async function afficher(reglages: Reglages = {}) {
  const { maintenant = HORS_FERMETURE, especes = ESPECES, explications = [] } = reglages;
  // `federation: undefined` doit vraiment donner « aucune fédération connue » : pas de valeur par défaut dans ce cas.
  const federation = 'federation' in reglages ? reglages.federation : FEDERATION_49;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(maintenant);
  const demandesFederation: string[] = [];
  const resultat: ResultatConseil = { conseils: TROIS_CONSEILS, explications };
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      {
        provide: CatalogService,
        useValue: {
          federation: async (departement: string) => {
            demandesFederation.push(departement);
            return federation;
          },
          typesDeLeurres: async () => [
            { id: 'shad', nom: 'Shad' },
            { id: 'ver', nom: 'Ver souple finesse' },
            { id: 'jig', nom: 'Jig à jupe' },
          ],
          animations: async () => [{ id: 'tiree', nom: 'Tirée-relâchée' }],
          couleurs: async () => [{ id: 'gardon', nom: 'Gardon' }],
          especes: async () => especes,
        },
      },
      {
        provide: ConditionsService,
        useValue: {
          releve: async (): Promise<ReleveActuel> => ({ conditions: { ...CONDITIONS }, pressionHpa: 1012, moinsPrecis: false }),
        },
      },
      {
        provide: AstroService,
        useValue: {
          soleil: (_lieu: unknown, moment: Date): SoleilDuJour => {
            const jour = moment.toISOString().slice(0, 10);
            return { lever: new Date(`${jour}T06:30:00Z`), coucher: new Date(`${jour}T16:30:00Z`) };
          },
          lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      { provide: MoteurService, useValue: { conseiller: async (): Promise<ResultatConseil> => resultat } },
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
  return { page: fixture.nativeElement as HTMLElement, stabiliser, demandesFederation };
}
type Env = Awaited<ReturnType<typeof afficher>>;

afterEach(() => vi.useRealTimers());

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');
const contient = (texte: string | null | undefined, voulu: string): boolean => compact(texte).includes(compact(voulu));

function bandeau(page: HTMLElement): HTMLElement {
  const titre = [...page.querySelectorAll('h2, h3')].find((t) => t.textContent?.trim() === 'Réglementation');
  const racine = titre?.closest('section, article, ion-card');
  if (!racine) throw new Error('aucun bandeau « Réglementation »');
  return racine as HTMLElement;
}
const cartesConseil = (page: HTMLElement): HTMLElement[] =>
  [...page.querySelectorAll<HTMLElement>('section, article, ion-card')].filter(
    (e) => contient(e.textContent, 'Animation :') && !e.querySelector('section, article, ion-card'),
  );
const boutons = (page: HTMLElement): HTMLElement[] => [...page.querySelectorAll<HTMLElement>('button, ion-button')];
const feuille = (page: HTMLElement): HTMLElement => {
  const f = page.querySelector<HTMLElement>('[role="dialog"]');
  if (!f) throw new Error('aucune feuille ouverte');
  return f;
};
const selecteur = (env: Env, mot: string) =>
  boutons(env.page).find((b) => !b.closest('[role="dialog"]') && compact(b.textContent).startsWith(compact(mot)));
const dansFeuille = (env: Env, texte: string) =>
  [...feuille(env.page).querySelectorAll<HTMLElement>('button, ion-button, [role="radio"], label')].find((e) =>
    compact(e.textContent).startsWith(compact(texte)),
  );
async function toucher(env: Env, element: HTMLElement | undefined): Promise<void> {
  if (!element) throw new Error('élément introuvable');
  element.click();
  await env.stabiliser();
}
async function choisirEspece(env: Env, nom: string): Promise<void> {
  await toucher(env, selecteur(env, 'Espèce'));
  await toucher(env, dansFeuille(env, nom));
}
async function choisirDemain7h(env: Env): Promise<void> {
  await toucher(env, selecteur(env, 'Moment'));
  await toucher(env, dansFeuille(env, 'Demain'));
  const select = feuille(env.page).querySelector<HTMLSelectElement>('select');
  const option = [...(select?.options ?? [])].find((o) => compact(o.textContent) === compact('7 h'));
  if (!select || !option) throw new Error('select Heure introuvable');
  select.value = option.value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await env.stabiliser();
  await toucher(env, dansFeuille(env, 'Valider'));
}

describe('ConseilPage : bandeau « Réglementation », compléments (US 84)', () => {
  it('critère 1 : given l\'écran Conseil affiché hors fermeture, when je regarde le bandeau, then il rappelle le quota « 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum », porte la mention et le lien « Voir la fédération de ton département »', async () => {
    const { page } = await afficher();

    const texte = bandeau(page).textContent;
    expect(contient(texte, QUOTA)).toBe(true);
    expect(contient(texte, MENTION)).toBe(true);
    expect(bandeau(page).querySelector('a')?.textContent?.trim()).toBe(LIEN);
  });

  it('critère 1 : given la catégorie inconnue (position GPS) hors fermeture, when je regarde le bandeau, then il applique la 2e catégorie : « 2e catégorie : Ouvert » et aucune ligne « 1re catégorie »', async () => {
    const { page } = await afficher();

    const texte = bandeau(page).textContent;
    expect(contient(texte, '2e catégorie : Ouvert')).toBe(true);
    expect(contient(texte, '1re catégorie')).toBe(false);
    expect(contient(texte, 'Quota en 2e catégorie')).toBe(false);
  });

  it('critère 2 : given le département 49 détecté, when je regarde le lien « Voir la fédération de ton département », then il ouvre dans un nouvel onglet le site de la fédération de ce département', async () => {
    const { page, demandesFederation } = await afficher();

    expect(demandesFederation).toContain('49');
    const lien = bandeau(page).querySelector('a');
    expect(lien?.textContent?.trim()).toBe(LIEN);
    expect(lien?.getAttribute('href')).toBe(FEDERATION_49.url);
    expect(lien?.getAttribute('target')).toBe('_blank');
    expect(lien?.getAttribute('rel')).toContain('noopener');
  });

  it('critère 2 : given aucune fédération connue pour le département, when je regarde le bandeau, then la mention reste mais il n\'y a aucun lien (pas de repli sur la fédération nationale)', async () => {
    const { page } = await afficher({ federation: undefined });

    expect(contient(bandeau(page).textContent, MENTION)).toBe(true);
    expect(bandeau(page).querySelector('a')).toBeNull();
    expect(bandeau(page).textContent).not.toContain('nationale');
  });

  it('critère 3 : given un moment dans la fermeture du brochet, when je regarde le bandeau, then il indique « Brochet fermé en 2e catégorie » (et plus « jusqu\'au »)', async () => {
    const { page } = await afficher({ maintenant: FERMETURE_BROCHET });

    const texte = bandeau(page).textContent;
    expect(contient(texte, 'Brochet fermé en 2e catégorie')).toBe(true);
    expect(contient(texte, "Brochet fermé jusqu'au")).toBe(false);
    expect(contient(texte, '2e catégorie : Ouvert')).toBe(false);
    expect(contient(texte, '1re catégorie')).toBe(false);
    expect(contient(texte, QUOTA)).toBe(true);
  });

  it('critère 3 : given la veille de la fermeture, when je choisis « Demain 7 h » (premier jour de fermeture), then le bandeau suit le moment choisi et indique « Brochet fermé en 2e catégorie »', async () => {
    const env = await afficher({ maintenant: VEILLE_DE_LA_FERMETURE });
    expect(contient(bandeau(env.page).textContent, 'Brochet fermé en 2e catégorie')).toBe(false);
    expect(contient(bandeau(env.page).textContent, '2e catégorie : Ouvert')).toBe(true);

    await choisirDemain7h(env);

    expect(contient(bandeau(env.page).textContent, 'Brochet fermé en 2e catégorie')).toBe(true);
  });

  it('critère 3 : given la fermeture du brochet et une explication du moteur, when je regarde les 3 cartes, then le pourquoi de chacune se termine par « Brochet fermé : certains leurres sont interdits jusqu\'au 24/04 (si tu es en 2e catégorie) »', async () => {
    const { page } = await afficher({ maintenant: FERMETURE_BROCHET, explications: [EXPLICATION] });

    const cartes = cartesConseil(page);
    expect(cartes).toHaveLength(3);
    for (const carte of cartes) {
      const pourquoi = compact(carte.textContent);
      const base = pourquoi.indexOf(compact('Eau froide : une animation lente convient.'));
      const ajout = pourquoi.indexOf(compact(EXPLICATION));
      expect(base).toBeGreaterThan(-1);
      expect(ajout, 'explication absente de la carte').toBeGreaterThan(base);
    }
  });

  it('critère 3 : given aucune explication du moteur (hors fermeture), when je regarde les cartes, then aucune ne parle de brochet fermé', async () => {
    const { page } = await afficher({ explications: [] });

    for (const carte of cartesConseil(page)) expect(contient(carte.textContent, 'Brochet fermé')).toBe(false);
  });

  it('critère 4 : given la fermeture du brochet et l\'espèce visée « Sandre », when je regarde le bandeau, then il indique « Sandre probablement fermé, vérifie »', async () => {
    const env = await afficher({ maintenant: FERMETURE_BROCHET });
    await choisirEspece(env, 'Sandre');

    const texte = bandeau(env.page).textContent;
    expect(contient(texte, 'Sandre probablement fermé, vérifie')).toBe(true);
    expect(contient(texte, 'Sandre : probablement')).toBe(false);
  });

  it('critère 4 : given la fermeture du brochet et « Toutes les espèces », when je regarde le bandeau, then il indique « Sandre probablement fermé, vérifie » (lu dans le contenu) sans avertissement « Brochet probablement fermé »', async () => {
    const { page } = await afficher({ maintenant: FERMETURE_BROCHET });

    const texte = bandeau(page).textContent;
    expect(contient(texte, 'Sandre probablement fermé, vérifie')).toBe(true);
    expect(contient(texte, 'Brochet probablement fermé')).toBe(false);
  });

  it('critère 4 : given la fermeture du brochet et l\'espèce visée « Perche », when je regarde le bandeau, then aucun avertissement sur le sandre', async () => {
    const env = await afficher({ maintenant: FERMETURE_BROCHET });
    await choisirEspece(env, 'Perche');

    expect(contient(bandeau(env.page).textContent, 'Sandre')).toBe(false);
  });

  it('critère 5 : given le printemps et l\'espèce visée « Black-bass », when je regarde le bandeau, then il indique « Black-bass : vérifie ton département »', async () => {
    const env = await afficher({ maintenant: PRINTEMPS_BROCHET_OUVERT });
    await choisirEspece(env, 'Black-bass');

    expect(contient(bandeau(env.page).textContent, 'Black-bass : vérifie ton département')).toBe(true);
  });

  it('critère 5 : given le printemps et « Toutes les espèces », when je regarde le bandeau, then il indique « Black-bass : vérifie ton département »', async () => {
    const { page } = await afficher({ maintenant: PRINTEMPS_BROCHET_OUVERT });

    expect(contient(bandeau(page).textContent, 'Black-bass : vérifie ton département')).toBe(true);
  });

  it('critère 5 : given le printemps et l\'espèce visée « Perche », ou l\'automne et « Toutes les espèces », when je regarde le bandeau, then aucune alerte « Black-bass »', async () => {
    const env = await afficher({ maintenant: PRINTEMPS_BROCHET_OUVERT });
    await choisirEspece(env, 'Perche');
    expect(contient(bandeau(env.page).textContent, 'Black-bass')).toBe(false);

    TestBed.resetTestingModule();
    vi.useRealTimers();
    const automne = await afficher({ maintenant: HORS_FERMETURE });
    expect(contient(bandeau(automne.page).textContent, 'Black-bass')).toBe(false);
  });

  it('critère 6 : given l\'espèce visée « Brochet » avec une taille minimale de 60 cm dans le contenu, when je regarde les cartes, then chacune affiche « Taille minimale : 60 cm » et le bandeau garde sa ligne', async () => {
    const env = await afficher({ especes: ESPECES_BROCHET_60 });
    await choisirEspece(env, 'Brochet');

    const cartes = cartesConseil(env.page);
    expect(cartes).toHaveLength(3);
    for (const carte of cartes) expect(contient(carte.textContent, 'Taille minimale : 60 cm')).toBe(true);
    expect(contient(bandeau(env.page).textContent, 'Taille minimale : 60 cm')).toBe(true);
  });

  it('critère 6 : given « Toutes les espèces » (même si une fiche a une taille minimale), when je regarde les cartes, then aucune n\'affiche de taille minimale', async () => {
    const { page } = await afficher({ especes: ESPECES_BROCHET_60 });

    for (const carte of cartesConseil(page)) expect(contient(carte.textContent, 'Taille minimale')).toBe(false);
  });

  it('critère 6 : given l\'espèce visée « Sandre » sans taille minimale (tailleMinCm null), when je regarde les cartes, then aucune n\'affiche de taille minimale', async () => {
    const env = await afficher({ especes: ESPECES_BROCHET_60 });
    await choisirEspece(env, 'Sandre');

    const cartes = cartesConseil(env.page);
    expect(cartes).toHaveLength(3);
    for (const carte of cartes) expect(contient(carte.textContent, 'Taille minimale')).toBe(false);
  });
});
