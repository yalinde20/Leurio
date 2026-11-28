/*
 * US 105 : le leurre de ma boîte sur les cartes du conseil. Maquette : docs/maquettes/us-105-leurre-de-ma-boite.html.
 *
 * Doubles : PositionService, ConditionsService, AstroService, MoteurService, CatalogService (comme conseil.page.top3.spec.ts) et
 * SOURCE_TACKLE_BOX (aucun appel Firebase) : le vrai TackleBoxService lit ce double, donc `leurres()` suit ses instantanés.
 * Le matcher (US 104) n'est pas doublé : la page l'appelle avec la boîte et les types du CatalogService.
 *
 * US 295 : l'écran Conseil n'affiche plus que « Dans ta boîte » ou « Il te manque » dans la carte du coup 01 ; la ligne complète
 * (« Dans ta boîte : Shad 10 cm gardon ») est celle du détail, lue ici dans `ConseilDetailStore.lignes()` qui l'alimente (le libellé en gras
 * est vérifié par conseil-detail.page.boite.spec.ts). Une « carte » de ces tests est donc : le statut visible du coup 01, puis la ligne
 * du coup. Les espaces (y compris insécables) ne comptent pas. Le type porte `article` (« un » / « une », décision A1).
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';
import { ConseilDetailStore } from './conseil-detail.store';

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};
const SOLEIL: SoleilDuJour = {
  lever: new Date('2026-11-09T06:32:00Z'),
  coucher: new Date('2026-11-09T17:01:00Z'),
};
const MAINTENANT = new Date('2026-11-09T12:00:00Z');
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
const RELEVE: ReleveActuel = { conditions: CONDITIONS, pressionHpa: 1012, moinsPrecis: false };

const TYPES = [
  { id: 'shad', nom: 'Shad', article: 'un', zoneNage: 'mi-eau', tailleCm: [7, 12] },
  { id: 'minnow', nom: 'Minnow (jerkbait)', article: 'un', zoneNage: 'mi-eau', tailleCm: [7, 13] },
  { id: 'crankbait', nom: 'Crankbait', article: 'un', zoneNage: 'mi-eau', tailleCm: [4, 8] },
  { id: 'cuiller', nom: 'Cuillère tournante', article: 'une', zoneNage: 'fond', poidsG: [3, 10] },
  {
    id: 'lipless',
    nom: 'Lipless (vibrant sans bavette)',
    article: 'un',
    zoneNage: 'surface',
    poidsG: [7, 21],
  },
  { id: 'ver', nom: 'Ver souple finesse', article: 'un', zoneNage: 'fond' },
] as unknown as TypeLeurre[];
const ANIMATIONS = [{ id: 'tiree', nom: 'Tirée-relâchée' }] as Animation[];
const COULEURS = [
  { id: 'gardon', nom: 'Gardon' },
  { id: 'naturelle', nom: 'Naturelle' },
] as Couleur[];

const conseil = (surcharge: Partial<Conseil>): Conseil => ({
  typeId: 'shad',
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 10,
  pourquoi: ['Première phrase du moteur.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
  ...surcharge,
});
const resultat = (...conseils: Conseil[]): ResultatConseil => ({ conseils, explications: [] });

const leurre = (
  id: string,
  typeId: string,
  tailleCm: number,
  poidsG: number,
  couleur: string,
): DocumentLeurre => ({
  id,
  data: {
    typeId,
    tailleCm,
    poidsG,
    couleur,
    marque: '',
    createdAt: 1000 + Number(id.replace(/\D/g, '') || 0),
  },
  enAttente: false,
});

type Boite = DocumentLeurre[] | 'attente' | 'erreur';

async function afficher(boite: Boite, res: ResultatConseil) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  let rappel: ((d: DocumentLeurre[]) => void) | null = null;
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void, ko: (e: unknown) => void) => {
      rappel = ok;
      if (boite === 'erreur') ko(new Error('lecture refusée'));
      else if (boite !== 'attente') ok([...boite]);
      return () => undefined;
    },
  };
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: source },
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
      { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
      {
        provide: AstroService,
        useValue: {
          soleil: (): SoleilDuJour => SOLEIL,
          lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      { provide: MoteurService, useValue: { conseiller: async () => res } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  const stabiliser = async () => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  await stabiliser();
  return {
    page: fixture.nativeElement as HTMLElement,
    stabiliser,
    nouvelInstantane: async (docs: DocumentLeurre[]) => {
      rappel?.([...docs]);
      await stabiliser();
    },
  };
}

afterEach(() => vi.useRealTimers());

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');
/** Une carte de ces tests : le statut du coup 01 (écran), puis la ligne complète du coup (détail). */
const cartes = (page: HTMLElement): { textContent: string }[] => {
  const store = TestBed.inject(ConseilDetailStore);
  const lignes = store.lignes();
  return store.details().map((_, i) => ({
    textContent: `${i === 0 ? (page.querySelector('#coup-1 .boite')?.textContent ?? '') : ''} ${lignes[i] ? `${lignes[i].libelle} ${lignes[i].texte}` : ''}`,
  }));
};
/** Le statut affiché dans la carte du coup 01 : « Dans ta boîte », « À la place, dans ta boîte » ou « Il te manque ». */
const statutCoupUn = (page: HTMLElement): string => compact(page.querySelector('#coup-1 .boite')?.textContent);
const LIBELLES = ['Dans ta boîte :', 'À la place, dans ta boîte :', 'Il te manque :'].map(compact);
const aUneLigne = (carte: { textContent: string }): boolean =>
  LIBELLES.some((l) => compact(carte.textContent).includes(l));

const SHAD_GARDON = leurre('a1', 'shad', 10, 12, 'gardon');
const CRANK_PERCHE = leurre('a2', 'crankbait', 6, 8, 'perche');

describe('Conseil : le leurre de ma boîte sur les cartes (US 105)', () => {
  it("critère 1 : given ma boîte contient un shad de 10 cm gardon et le conseil est un shad, when l'écran Conseil s'affiche, then la carte affiche « Dans ta boîte : Shad 10 cm gardon »", async () => {
    const { page } = await afficher([SHAD_GARDON], resultat(conseil({})));

    const [carte] = cartes(page);
    expect(compact(carte.textContent)).toContain(compact('Dans ta boîte : Shad 10 cm gardon'));
    expect(compact(carte.textContent)).not.toContain(compact('Il te manque'));
  });

  it("critère 1 : given une ligne de boîte, when je regarde le coup 01, then il affiche « Dans ta boîte » dans sa carte, sans le détail du leurre", async () => {
    const { page } = await afficher([SHAD_GARDON], resultat(conseil({})));

    expect(statutCoupUn(page)).toBe(compact('Dans ta boîte'));
    expect(compact(page.querySelector('#coup-1')?.textContent)).not.toContain(compact('10 cm gardon Dans'));
  });

  it("critère 3 : given le matcher ne trouve rien, when je regarde le coup 01, then il affiche « Il te manque » dans sa carte", async () => {
    const { page } = await afficher([], resultat(conseil({})));

    expect(statutCoupUn(page)).toBe(compact('Il te manque'));
  });

  it("critère 1 : given un leurre de 7,5 cm dans la boîte, when l'écran s'affiche, then la taille est en format français « 7,5 cm » et la couleur est celle saisie", async () => {
    const { page } = await afficher(
      [leurre('a1', 'shad', 7.5, 9, 'Noir Pailleté')],
      resultat(conseil({})),
    );

    expect(compact(cartes(page)[0].textContent)).toContain(
      compact('Dans ta boîte : Shad 7,5 cm Noir Pailleté'),
    );
  });

  it("critère 1 : given un leurre dont le type a un poids dans le contenu, when l'écran s'affiche, then la ligne donne son poids en g et non sa taille", async () => {
    const { page } = await afficher(
      [leurre('a1', 'cuiller', 6, 7, 'argent')],
      resultat(
        conseil({ typeId: 'cuiller', couleur: 'gardon', taille: { valeur: 5, unite: 'g' } }),
      ),
    );

    const texte = compact(cartes(page)[0].textContent);
    expect(texte).toContain(compact('Dans ta boîte : Cuillère tournante 7 g argent'));
    expect(texte).not.toContain(compact('6 cm argent'));
  });

  it("critère 2 : given le matcher rend une substitution (pas de minnow, un crankbait de la même zone de nage), when l'écran s'affiche, then la carte affiche « À la place, dans ta boîte : Crankbait 6 cm perche »", async () => {
    const { page } = await afficher(
      [SHAD_GARDON, CRANK_PERCHE],
      resultat(conseil({}), conseil({ typeId: 'minnow', taille: { valeur: 5, unite: 'cm' } })),
    );

    const [carteShad, carteMinnow] = cartes(page);
    expect(compact(carteShad.textContent)).toContain(compact('Dans ta boîte : Shad 10 cm gardon'));
    expect(compact(carteMinnow.textContent)).toContain(
      compact('À la place, dans ta boîte : Crankbait 6 cm perche'),
    );
    expect(compact(carteMinnow.textContent)).not.toContain(compact('Il te manque'));
  });

  it("critère 3 : given le matcher ne trouve rien, when l'écran s'affiche, then la carte affiche « Il te manque : un shad 7–12 cm couleur gardon » (article du contenu, plage, couleur conseillée)", async () => {
    const { page } = await afficher([], resultat(conseil({})));

    const texte = compact(cartes(page)[0].textContent);
    expect(texte).toContain(compact('Il te manque : un shad 7–12 cm couleur gardon'));
    expect(texte).not.toContain(compact('Dans ta boîte'));
  });

  it('critère 3 : given un type féminin du contenu (« une »), when il manque, then la ligne dit « une cuillère tournante 3–10 g couleur gardon » (plage en g, initiale en minuscule)', async () => {
    const { page } = await afficher(
      [],
      resultat(conseil({ typeId: 'cuiller', taille: { valeur: 5, unite: 'g' } })),
    );

    expect(compact(cartes(page)[0].textContent)).toContain(
      compact('Il te manque : une cuillère tournante 3–10 g couleur gardon'),
    );
  });

  it('critère 3 : given un nom de type avec parenthèses, when il manque, then seule la première lettre passe en minuscule', async () => {
    const { page } = await afficher(
      [],
      resultat(
        conseil({ typeId: 'lipless', taille: { valeur: 10, unite: 'g' } }),
        conseil({ typeId: 'minnow', taille: { valeur: 10, unite: 'cm' } }),
      ),
    );

    const [lipless, minnow] = cartes(page).map((c) => compact(c.textContent));
    expect(lipless).toContain(
      compact('Il te manque : un lipless (vibrant sans bavette) 7–21 g couleur gardon'),
    );
    expect(minnow).toContain(compact('Il te manque : un minnow (jerkbait) 7–13 cm couleur gardon'));
  });

  it("critère 3 : given un type sans plage de taille dans le contenu, when il manque, then la ligne n'a pas de plage : « Il te manque : un ver souple finesse couleur naturelle »", async () => {
    const { page } = await afficher(
      [],
      resultat(conseil({ typeId: 'ver', couleur: 'naturelle', taille: null })),
    );

    const texte = compact(cartes(page)[0].textContent);
    expect(texte).toContain(compact('Il te manque : un ver souple finesse couleur naturelle'));
    expect(texte).not.toMatch(/\d–\d/);
  });

  it("critère 3 : given une couleur conseillée absente du contenu, when il manque un leurre, then la ligne affiche l'identifiant de la couleur", async () => {
    const { page } = await afficher([], resultat(conseil({ couleur: 'rose-fluo' })));

    expect(compact(cartes(page)[0].textContent)).toContain(
      compact('Il te manque : un shad 7–12 cm couleur rose-fluo'),
    );
  });

  it('critère 5 : given le conseil affichait « Il te manque », when la boîte reçoit un shad (ajout puis retour sur Conseil), then la carte affiche « Dans ta boîte : Shad 10 cm gardon »', async () => {
    const env = await afficher([], resultat(conseil({})));
    expect(compact(cartes(env.page)[0].textContent)).toContain(compact('Il te manque : un shad'));

    await env.nouvelInstantane([SHAD_GARDON]);

    const texte = compact(cartes(env.page)[0].textContent);
    expect(texte).toContain(compact('Dans ta boîte : Shad 10 cm gardon'));
    expect(texte).not.toContain(compact('Il te manque'));
  });

  it("critère 1 : given la boîte pas encore lue, when l'écran s'affiche, then les cartes n'ont aucune ligne de boîte, puis la ligne apparaît au premier instantané", async () => {
    const env = await afficher('attente', resultat(conseil({}), conseil({ typeId: 'minnow' })));

    expect(cartes(env.page)).toHaveLength(2);
    expect(cartes(env.page).some(aUneLigne)).toBe(false);

    await env.nouvelInstantane([SHAD_GARDON]);
    expect(compact(cartes(env.page)[0].textContent)).toContain(
      compact('Dans ta boîte : Shad 10 cm gardon'),
    );
  });

  it("critère 6 : given la boîte en erreur de lecture, when l'écran s'affiche, then les cartes n'ont aucune ligne de boîte (pas de « Il te manque » par défaut), puis la ligne apparaît quand la lecture reprend", async () => {
    const env = await afficher('erreur', resultat(conseil({}), conseil({ typeId: 'minnow' })));

    expect(cartes(env.page)).toHaveLength(2);
    expect(cartes(env.page).some(aUneLigne)).toBe(false);
    expect(compact(env.page.textContent)).not.toContain(compact('Il te manque'));

    await env.nouvelInstantane([SHAD_GARDON]);
    expect(compact(cartes(env.page)[0].textContent)).toContain(
      compact('Dans ta boîte : Shad 10 cm gardon'),
    );
  });

  it("critère 6 : given une boîte lue depuis le cache (documents en attente de synchronisation), when l'écran s'affiche, then la ligne est calculée sans message de plus", async () => {
    const { page } = await afficher([{ ...SHAD_GARDON, enAttente: true }], resultat(conseil({})));

    const texte = compact(cartes(page)[0].textContent);
    expect(texte).toContain(compact('Dans ta boîte : Shad 10 cm gardon'));
    expect(texte).not.toContain(compact('Pas encore synchronisé'));
  });
});
