/*
 * US 87 : choisir un spot enregistré comme lieu du conseil. Maquette de référence : docs/maquettes/us-87-spot-lieu-du-conseil.html.
 *
 * Contrat du DOM (neutre sur les balises autres que ceux-ci) :
 *  - un `button` dont le texte commence par « Lieu » et contient la valeur choisie (« Ma position » au départ), `aria-haspopup="dialog"`,
 *    actif même quand la localisation est refusée ;
 *  - un tap dessus ouvre, dans la page, un `[role="dialog"]` titré « Lieu du conseil » avec un `[role="radiogroup"]` de `[role="radio"]` :
 *    « Ma position » puis chaque spot de `SpotsService.mesSpots()` par son nom, en ordre alphabétique ; `aria-checked` marque le choisi ;
 *  - sans spot : seulement « Ma position » et le texte « Aucun spot enregistré » (pas une option) ;
 *  - un tap sur une ligne la choisit et ferme la feuille ; « Annuler » ferme sans rien changer ;
 *  - un spot choisi : `PositionService.positionSpot(spot)` (pas de GPS), `ConditionsService.releve({ lieu, spot: { categorie, departement } })`,
 *    fédération du département du spot, bandeau « Réglementation » avec la catégorie du spot.
 * Doubles : SpotsService, PositionService, ConditionsService, AstroService, CatalogService, MoteurService. Aucun appel à Firebase.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, Federation, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, DemandeConditions, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition, Spot } from '../../core/data/position.service';
import { SpotEnregistre, SpotsService } from '../../core/data/spots.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';
import { ouvrirReglementation, temperatureAffichee, textesDesCoups } from './conseil.page.aides';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';

const NANTES: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.22,
  longitude: -1.55,
  precisionM: 10,
  departement: '44',
};
const REFUSEE: ResultatPosition = { disponible: false, motif: 'position refusée' };
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-11T06:32:00Z'), coucher: new Date('2026-11-11T17:01:00Z') };
const DANS_LES_HEURES = new Date('2026-11-11T12:00:00Z');

const ETANG: SpotEnregistre = { id: 's1', nom: 'Étang du moulin', lat: 47.5, lng: -0.9, categorie: 2, departement: '49' };
const SEVRE: SpotEnregistre = { id: 's2', nom: 'La Sèvre à Clisson', lat: 47.09, lng: -1.28, categorie: 1, departement: '44' };
const LOIRE: SpotEnregistre = { id: 's3', nom: 'Loire, pont de Montjean', lat: 47.39, lng: -0.86, categorie: 2, departement: '49' };
/** Volontairement dans le désordre : la feuille les range par ordre alphabétique. */
const SPOTS = [LOIRE, SEVRE, ETANG];

const FEDERATIONS: Record<string, Pick<Federation, 'departement' | 'nom' | 'url'>> = {
  '44': { departement: '44', nom: 'Fédération de pêche de Loire-Atlantique', url: 'https://fedepeche44.fr' },
  '49': { departement: '49', nom: 'Fédération de pêche du Maine-et-Loire', url: 'https://fedepeche49.fr' },
};

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'jig', nom: 'Jig à jupe' },
  { id: 'ver', nom: 'Ver souple finesse' },
  { id: 'lame', nom: 'Lame vibrante' },
] as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tirée-relâchée' },
  { id: 'gratte', nom: 'Gratté' },
  { id: 'dropshot', nom: 'Drop shot' },
  { id: 'dandine', nom: 'Dandine' },
] as Animation[];
const COULEURS = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];

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
/** Top 3 de la position GPS (Shad, Jig, Ver) et top 3 d'un spot (Lame, Dandine...) : on voit lequel est affiché. */
const TOP_GPS: ResultatConseil = {
  conseils: [
    conseil({ typeId: 'shad', techniqueId: 'tiree', score: 9 }),
    conseil({ typeId: 'jig', techniqueId: 'gratte', score: 7 }),
    conseil({ typeId: 'ver', techniqueId: 'dropshot', score: 5 }),
  ],
  explications: [],
};
const TOP_SPOT: ResultatConseil = {
  conseils: [
    conseil({ typeId: 'lame', techniqueId: 'dandine', score: 9 }),
    conseil({ typeId: 'ver', techniqueId: 'dropshot', score: 7 }),
    conseil({ typeId: 'jig', techniqueId: 'gratte', score: 5 }),
  ],
  explications: [],
};

interface Reglages {
  position?: ResultatPosition;
  mesSpots?: () => Promise<SpotEnregistre[]>;
}

async function afficher({ position = NANTES, mesSpots = async () => SPOTS }: Reglages = {}) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(DANS_LES_HEURES);
  const appels = {
    positionGps: 0,
    positionSpot: [] as Spot[],
    releves: [] as DemandeConditions[],
    federations: [] as string[],
    moteur: [] as Conditions[],
  };
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: SpotsService, useValue: { mesSpots } },
      {
        provide: PositionService,
        useValue: {
          positionGps: async () => {
            appels.positionGps++;
            return position;
          },
          positionSpot: async (spot: Spot): Promise<ResultatPosition> => {
            appels.positionSpot.push(spot);
            return {
              disponible: true,
              source: 'spot',
              latitude: spot.lat,
              longitude: spot.lng,
              precisionM: null,
              departement: spot.departement,
            };
          },
        },
      },
      {
        provide: CatalogService,
        useValue: {
          federation: async (departement: string) => {
            appels.federations.push(departement);
            return FEDERATIONS[departement];
          },
          typesDeLeurres: async () => TYPES,
          animations: async () => ANIMATIONS,
          couleurs: async () => COULEURS,
          especes: async () => [],
        },
      },
      {
        provide: ConditionsService,
        useValue: {
          // Le double reproduit le vrai : catégorie et département viennent du spot s'il est donné.
          releve: async (demande: DemandeConditions): Promise<ReleveActuel> => {
            appels.releves.push(demande);
            const duSpot = demande.spot !== undefined;
            return {
              conditions: {
                tempEau: duSpot ? 10.5 : 11.5,
                sourceTempEau: 'capteur',
                debitTendance: 'normal',
                pressionTendance48h: -8,
                nuages: 80,
                vent: 12,
                moment: 'jour',
                saison: 'automne',
                categorie: demande.spot?.categorie ?? null,
                departement: demande.spot?.departement ?? '44',
                niveau: 'debutant',
              },
              pressionHpa: 1012,
              moinsPrecis: false,
            };
          },
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
            appels.moteur.push(conditions);
            return conditions.categorie === null ? TOP_GPS : TOP_SPOT;
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
  return { page: fixture.nativeElement as HTMLElement, appels, stabiliser };
}
type Env = Awaited<ReturnType<typeof afficher>>;

afterEach(() => vi.useRealTimers());

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');

function boutonLieu(page: HTMLElement): HTMLButtonElement {
  const bouton = [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => compact(b.textContent).startsWith(compact('Lieu')));
  if (!bouton) throw new Error('aucun bouton « Lieu »');
  return bouton;
}
const feuille = (page: HTMLElement): HTMLElement | null => page.querySelector<HTMLElement>('app-lieu-feuille [role="dialog"]');
const lignes = (page: HTMLElement): HTMLElement[] => [...(feuille(page)?.querySelectorAll<HTMLElement>('[role="radiogroup"] [role="radio"]') ?? [])];
const noms = (page: HTMLElement): string[] => lignes(page).map((l) => (l.textContent ?? '').replace(/[✓\s\u00a0\u202f]+$/g, '').trim());
/** Les trois coups (01, puis 02 et 03 par la feuille « 2 autres coups »), en texte compact. */
const cartesConseil = (env: Env): Promise<string[]> => textesDesCoups(env);
/** Le bandeau « Réglementation » : la feuille de la ligne d'état. */
async function bandeau(env: Env): Promise<HTMLElement> {
  await ouvrirReglementation(env);
  const racine = env.page.querySelector<HTMLElement>('app-bandeau-reglementation');
  if (!racine) throw new Error('aucun bandeau « Réglementation »');
  return racine;
}

async function ouvrir(env: Env) {
  boutonLieu(env.page).click();
  await env.stabiliser();
}
async function choisir(env: Env, nom: string) {
  const ligne = lignes(env.page).find((l) => compact(l.textContent).startsWith(compact(nom)));
  if (!ligne) throw new Error(`aucune ligne « ${nom} »`);
  ligne.click();
  await env.stabiliser();
}

describe('ConseilPage : spot enregistré comme lieu du conseil (US 87)', () => {
  it('critère 1 : given j\'ai des spots enregistrés, when j\'ouvre le sélecteur de lieu, then il propose « Ma position » et chacun de mes spots par son nom', async () => {
    const env = await afficher();

    const bouton = boutonLieu(env.page);
    expect(bouton.getAttribute('aria-haspopup')).toBe('dialog');
    expect(compact(bouton.textContent)).toContain(compact('Ma position'));
    expect(feuille(env.page), 'la feuille est fermée au départ').toBeNull();

    await ouvrir(env);
    const dialogue = feuille(env.page);
    expect(dialogue, 'aucun role="dialog"').not.toBeNull();
    expect(env.page.querySelector('ion-modal')).toBeNull();
    expect(compact(dialogue!.textContent)).toContain(compact('Lieu du conseil'));
    expect(noms(env.page)).toEqual(['Ma position', 'Étang du moulin', 'La Sèvre à Clisson', 'Loire, pont de Montjean']);
    expect(lignes(env.page)[0].getAttribute('aria-checked')).toBe('true');
    expect(lignes(env.page).slice(1).every((l) => l.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('critère 1 : given la page, when elle s\'affiche, then le sélecteur « Lieu » est placé avant le sélecteur « Moment »', async () => {
    const { page } = await afficher();

    const boutons = [...page.querySelectorAll<HTMLButtonElement>('button')].map((b) => compact(b.textContent));
    const iLieu = boutons.findIndex((t) => t.startsWith(compact('Lieu')));
    const iMoment = boutons.findIndex((t) => t.startsWith(compact('Moment')));
    expect(iLieu).toBeGreaterThan(-1);
    expect(iLieu).toBeLessThan(iMoment);
  });

  it('critère 1 : given la feuille ouverte, when je touche « Annuler », then elle se ferme sans changer le lieu ni les conseils', async () => {
    const env = await afficher();
    const relevesAvant = env.appels.releves.length;
    await ouvrir(env);
    const annuler = [...feuille(env.page)!.querySelectorAll<HTMLElement>('button')].find((b) => compact(b.textContent) === compact('Annuler'));
    expect(annuler, 'aucun bouton « Annuler »').toBeDefined();
    annuler!.click();
    await env.stabiliser();

    expect(feuille(env.page)).toBeNull();
    expect(compact(boutonLieu(env.page).textContent)).toContain(compact('Ma position'));
    expect(env.appels.releves).toHaveLength(relevesAvant);
  });

  it('critère 2 : given le sélecteur de lieu est ouvert, when je choisis le spot « Étang du moulin », then le sélecteur affiche « Étang du moulin » et les conditions, le conseil et le bandeau sont ceux de ce spot', async () => {
    const env = await afficher();
    const gpsAvant = env.appels.positionGps;
    await ouvrir(env);
    await choisir(env, 'Étang du moulin');

    expect(feuille(env.page), 'la feuille se ferme au choix').toBeNull();
    expect(compact(boutonLieu(env.page).textContent)).toContain(compact('Étang du moulin'));
    expect(compact(boutonLieu(env.page).textContent)).not.toContain(compact('Ma position'));

    // Position : celle du spot, sans nouvelle demande au GPS.
    expect(env.appels.positionSpot).toEqual([expect.objectContaining({ nom: 'Étang du moulin', lat: 47.5, lng: -0.9, departement: '49' })]);
    expect(env.appels.positionGps).toBe(gpsAvant);

    // Conditions : relevé aux coordonnées du spot, avec sa catégorie et son département.
    const dernier = env.appels.releves.at(-1)!;
    expect(dernier.lieu).toEqual({ latitude: 47.5, longitude: -0.9 });
    expect(dernier.spot).toEqual({ categorie: 2, departement: '49' });
    expect(temperatureAffichee(env.page)).toBe(compact('10,5 °C'));

    // Conseil : le top 3 du spot.
    const cartes = await cartesConseil(env);
    expect(cartes).toHaveLength(3);
    expect(cartes[0]).toContain(compact('Lame vibrante'));
    expect(env.appels.moteur.at(-1)?.departement).toBe('49');

    // Bandeau : fédération du département du spot, catégorie du spot (2e : « Pêche : Ouvert » et non « 2e catégorie »).
    expect(env.appels.federations.at(-1)).toBe('49');
    const texteBandeau = compact((await bandeau(env)).textContent);
    expect(texteBandeau).toContain(compact('Pêche : Ouvert'));
    expect(texteBandeau).not.toContain(compact('2e catégorie'));
    const liens = [...(await bandeau(env)).querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(liens).toEqual(['https://fedepeche49.fr']);
  });

  it('critère 2 : given « Étang du moulin » choisi, when je rouvre la liste, then c\'est la ligne cochée', async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Étang du moulin');
    await ouvrir(env);

    const cochees = lignes(env.page).filter((l) => l.getAttribute('aria-checked') === 'true');
    expect(cochees).toHaveLength(1);
    expect(compact(cochees[0].textContent)).toContain(compact('Étang du moulin'));
  });

  it('critère 2 : given un spot choisi, when je rechoisis « Ma position », then le GPS est redemandé et les conditions sont celles de la position', async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Étang du moulin');
    const gpsAvant = env.appels.positionGps;
    await ouvrir(env);
    await choisir(env, 'Ma position');

    expect(compact(boutonLieu(env.page).textContent)).toContain(compact('Ma position'));
    expect(env.appels.positionGps).toBe(gpsAvant + 1);
    const dernier = env.appels.releves.at(-1)!;
    expect(dernier.spot).toBeUndefined();
    expect(dernier.lieu).toEqual({ latitude: NANTES.disponible ? NANTES.latitude : 0, longitude: NANTES.disponible ? NANTES.longitude : 0 });
    expect(temperatureAffichee(env.page)).toBe(compact('11,5 °C'));
  });

  it('critère 2 : given un spot choisi, when une nouvelle page s\'ouvre (nouvelle ouverture de l\'app), then le lieu repart sur « Ma position »', async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'Étang du moulin');
    TestBed.resetTestingModule();
    vi.useRealTimers();

    const neuf = await afficher();
    expect(compact(boutonLieu(neuf.page).textContent)).toContain(compact('Ma position'));
    expect(neuf.appels.positionSpot).toHaveLength(0);
  });

  it('critère 3 : given je n\'ai aucun spot enregistré, when j\'ouvre le sélecteur de lieu, then il propose seulement « Ma position » et affiche « Aucun spot enregistré »', async () => {
    const env = await afficher({ mesSpots: async () => [] });
    await ouvrir(env);

    expect(noms(env.page)).toEqual(['Ma position']);
    const dialogue = feuille(env.page)!;
    expect(compact(dialogue.textContent)).toContain(compact('Aucun spot enregistré'));
    expect(lignes(env.page).some((l) => compact(l.textContent).includes(compact('Aucun spot enregistré')))).toBe(false);
  });

  it('critère 3 : given la lecture des spots échoue, when j\'ouvre le sélecteur de lieu, then « Ma position » reste proposée avec « Tes spots ne sont pas disponibles pour le moment. »', async () => {
    const env = await afficher({
      mesSpots: async () => {
        throw new Error('hors ligne');
      },
    });
    await ouvrir(env);

    expect(noms(env.page)).toEqual(['Ma position']);
    expect(compact(feuille(env.page)!.textContent)).toContain(compact('Tes spots ne sont pas disponibles pour le moment.'));
  });

  it('critère 3 : given la lecture des spots est en cours, when j\'ouvre le sélecteur de lieu, then « Chargement des spots… » s\'affiche sous « Ma position »', async () => {
    const env = await afficher({ mesSpots: () => new Promise<SpotEnregistre[]>(() => undefined) });
    await ouvrir(env);

    expect(noms(env.page)).toEqual(['Ma position']);
    expect(compact(feuille(env.page)!.textContent)).toContain(compact('Chargement des spots…'));
  });

  it('critère 4 : given la localisation est refusée et j\'ai un spot, when je choisis ce spot, then les 3 conseils s\'affichent pour ce spot', async () => {
    const env = await afficher({ position: REFUSEE });
    expect(compact(env.page.textContent)).toContain(compact('Position introuvable'));
    expect(env.page.querySelectorAll('a.coup')).toHaveLength(0);

    expect(boutonLieu(env.page).disabled, 'le sélecteur « Lieu » reste actif sans GPS').toBe(false);
    await ouvrir(env);
    await choisir(env, 'Étang du moulin');

    expect(compact(env.page.textContent)).not.toContain(compact('Position introuvable'));
    expect(compact(env.page.textContent)).not.toContain(compact('Localisation indisponible'));
    const cartes = await cartesConseil(env);
    expect(cartes).toHaveLength(3);
    expect(cartes[0]).toContain(compact('Lame vibrante'));
    expect(compact(boutonLieu(env.page).textContent)).toContain(compact('Étang du moulin'));
    expect(env.appels.releves.at(-1)!.spot).toEqual({ categorie: 2, departement: '49' });
  });

  it('critère 5 : given le spot choisi est en 1re catégorie et le moment est hors de la saison d\'ouverture (11/11/2026), when l\'écran « Conseil » s\'affiche, then le bandeau réglementation indique « Fermé : 1re catégorie hors saison » au-dessus de « Pêche : Fermé jusqu\'au 13/03 »', async () => {
    const env = await afficher();
    await ouvrir(env);
    await choisir(env, 'La Sèvre à Clisson');

    expect(env.appels.releves.at(-1)!.spot).toEqual({ categorie: 1, departement: '44' });
    const texte = compact((await bandeau(env)).textContent);
    const iAlerte = texte.indexOf(compact('Fermé : 1re catégorie hors saison'));
    const iLigne = texte.indexOf(compact("Pêche : Fermé jusqu'au 13/03"));
    expect(iAlerte, 'alerte absente du bandeau').toBeGreaterThan(-1);
    expect(iLigne, 'ligne « Pêche » absente du bandeau').toBeGreaterThan(-1);
    expect(iAlerte).toBeLessThan(iLigne);
    // 1re catégorie : pas de quota de 2e catégorie.
    expect(texte).not.toContain(compact('Quota'));
    // Le top 3 reste affiché.
    expect(await cartesConseil(env)).toHaveLength(3);
  });

  it('critère 5 : given la position GPS (catégorie inconnue), when l\'écran « Conseil » s\'affiche le 11/11/2026, then le bandeau n\'annonce pas « 1re catégorie hors saison »', async () => {
    const env = await afficher();

    expect(compact((await bandeau(env)).textContent)).not.toContain(compact('1re catégorie hors saison'));
  });
});
