/*
 * US 81 : le top 3 du moment à la position GPS. Maquette de référence : docs/maquettes/us-81-top-3-du-moment.html.
 *
 * Doubles : PositionService, ConditionsService, AstroService (comme les specs US 64/65), CatalogService (petit contenu :
 * federation, typesDeLeurres, animations, couleurs) et MoteurService (nouveau, src/app/core/data/moteur.service.ts) :
 *   conseiller(conditions: Conditions, moment: Date): Promise<ResultatConseil>
 * La page rend les 3 cartes dans l'ordre rendu par le moteur ; elle traduit les identifiants en noms avec le CatalogService.
 *
 * Structure attendue (neutre sur les balises) : une carte de conseil est un `section`, `article` ou `ion-card` dont le texte
 * contient « Animation : ». Chaque donnée s'écrit « Libellé : valeur » ; les espaces (y compris insécables) ne comptent pas.
 * Le moment est fixé avec de faux timers sur `Date` : les heures légales du double AstroService vont de 6 h 02 à 17 h 31 UTC.
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

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};

// 9 novembre 2026 (UTC+1) : lever 7 h 32, coucher 18 h 01, donc heures légales 7 h 02 – 18 h 31.
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-09T06:32:00Z'), coucher: new Date('2026-11-09T17:01:00Z') };
const DANS_LES_HEURES = new Date('2026-11-09T12:00:00Z'); // 13 h à Paris
const HORS_DES_HEURES = new Date('2026-11-09T20:00:00Z'); // 21 h à Paris

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
  { id: 'shad', nom: 'Shad' },
  { id: 'jig', nom: 'Jig à jupe' },
  { id: 'ver', nom: 'Ver souple finesse' },
] as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tirée-relâchée' },
  { id: 'gratte', nom: 'Gratté' },
  { id: 'dropshot', nom: 'Drop shot' },
] as Animation[];
const COULEURS = [
  { id: 'gardon', nom: 'Gardon' },
  { id: 'chartreuse', nom: 'Chartreuse' },
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

// Dans l'ordre du score, comme le moteur les rend.
const TOP3: ResultatConseil = {
  conseils: [
    conseil({ typeId: 'shad', techniqueId: 'tiree', couleur: 'gardon', taille: { valeur: 8, unite: 'cm' }, score: 9, pourquoi: ["À 11,5 °C, une animation lente lui convient. Autre phrase qui ne doit pas s'afficher."] }),
    conseil({ typeId: 'jig', techniqueId: 'gratte', couleur: 'chartreuse', taille: { valeur: 10, unite: 'g' }, score: 7, pourquoi: ['Le jig passe bien au fond. Deuxième phrase cachée.'] }),
    conseil({ typeId: 'ver', techniqueId: 'dropshot', couleur: 'gardon', taille: { valeur: 6, unite: 'cm' }, score: 5, pourquoi: ['Le ver finesse séduit les perches. Encore une phrase cachée.'] }),
  ],
  explications: [],
};

interface Reglages {
  maintenant?: Date;
  releve?: ReleveActuel;
  position?: ResultatPosition;
  resultat?: ResultatConseil;
}

async function afficher({ maintenant = DANS_LES_HEURES, releve = RELEVE, position = ANGERS, resultat = TOP3 }: Reglages = {}) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(maintenant);
  const appelsMoteur: { conditions: Conditions; moment: Date }[] = [];
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: PositionService, useValue: { positionGps: async () => position } },
      {
        provide: CatalogService,
        useValue: {
          federation: async () => undefined,
          typesDeLeurres: async () => TYPES,
          animations: async () => ANIMATIONS,
          couleurs: async () => COULEURS,
        },
      },
      { provide: ConditionsService, useValue: { releve: async () => releve } },
      {
        provide: AstroService,
        useValue: { soleil: (): SoleilDuJour => SOLEIL, lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) },
      },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async (conditions: Conditions, moment: Date) => {
            appelsMoteur.push({ conditions, moment });
            return resultat;
          },
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  return { page: fixture.nativeElement as HTMLElement, appelsMoteur };
}

afterEach(() => vi.useRealTimers());

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');

/** Les cartes de conseil : les `section`, `article` ou `ion-card` les plus internes dont le texte contient « Animation : ». */
function cartesConseil(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>('section, article, ion-card')].filter(
    (e) => compact(e.textContent).includes(compact('Animation :')) && !e.querySelector('section, article, ion-card'),
  );
}

describe('ConseilPage : top 3 du moment (US 81)', () => {
  it("critère 1 : given la position autorisée et un moment dans les heures légales, when l'écran Conseil s'affiche, then la carte « Conditions » et 3 cartes de conseil sont affichées sans aucun tap", async () => {
    const { page, appelsMoteur } = await afficher();

    expect(compact(page.textContent)).toContain(compact('Conditions'));
    expect(compact(page.textContent)).toContain(compact("Température de l'eau : 11,5 °C"));
    expect(cartesConseil(page)).toHaveLength(3);
    expect(compact(page.textContent)).toContain(compact('Ton top 3'));
    expect(appelsMoteur).toHaveLength(1);
  });

  it('critère 1 : given les conditions du relevé, when le top 3 est demandé, then le moteur reçoit les conditions du relevé et le moment présent', async () => {
    const { appelsMoteur } = await afficher();

    expect(appelsMoteur[0]?.conditions).toEqual(CONDITIONS);
    expect(appelsMoteur[0]?.moment.getTime()).toBe(DANS_LES_HEURES.getTime());
  });

  it("critère 2 : given les conditions récupérées, when l'écran s'affiche, then la carte « Conditions » montre eau, débit, pression, ciel, vent, lune et heures légales à côté des cartes de conseil", async () => {
    const { page } = await afficher();

    const texte = compact(page.textContent);
    for (const ligne of [
      "Température de l'eau : 11,5 °C",
      'Débit : Normal',
      'Pression : 1012 hPa',
      'Ciel : 80 % de nuages',
      'Vent : 12 km/h',
      'Lune : Premier croissant',
      'Heures légales : 7 h 02 – 18 h 31',
    ]) {
      expect(texte, ligne).toContain(compact(ligne));
    }
    expect(cartesConseil(page)).toHaveLength(3);
  });

  it("critère 3 : given un top 3 du moteur, when l'écran s'affiche, then chaque carte montre le type, l'animation, la couleur, la taille ou le poids, et la première phrase du pourquoi", async () => {
    const { page } = await afficher();

    const cartes = cartesConseil(page).map((c) => compact(c.textContent));
    expect(cartes).toHaveLength(3);
    const attendu = [
      ['Shad', 'Animation : Tirée-relâchée', 'Couleur : Gardon', 'Taille : 8 cm', "À 11,5 °C, une animation lente lui convient."],
      ['Jig à jupe', 'Animation : Gratté', 'Couleur : Chartreuse', 'Poids : 10 g', 'Le jig passe bien au fond.'],
      ['Ver souple finesse', 'Animation : Drop shot', 'Couleur : Gardon', 'Taille : 6 cm', 'Le ver finesse séduit les perches.'],
    ];
    attendu.forEach((lignes, i) => {
      for (const ligne of lignes) expect(cartes[i], `carte ${i + 1} : ${ligne}`).toContain(compact(ligne));
    });
  });

  it("critère 3 : given un pourquoi de plusieurs phrases, when l'écran s'affiche, then seule la première phrase est affichée", async () => {
    const { page } = await afficher();

    expect(cartesConseil(page)).toHaveLength(3);
    const texte = compact(page.textContent);
    expect(texte).toContain(compact('Le jig passe bien au fond.'));
    expect(texte).not.toContain(compact('Deuxième phrase'));
    expect(texte).not.toContain(compact('Autre phrase'));
  });

  it("critère 3 : given un top 3 du moteur, when l'écran s'affiche, then les cartes suivent l'ordre du moteur, numérotées 1, 2, 3", async () => {
    const { page } = await afficher();

    const cartes = cartesConseil(page).map((c) => compact(c.textContent));
    expect(cartes[0]).toContain('Shad');
    expect(cartes[1]).toContain(compact('Jig à jupe'));
    expect(cartes[2]).toContain(compact('Ver souple finesse'));
    cartes.forEach((c, i) => expect(c.startsWith(String(i + 1)), `rang de la carte ${i + 1}`).toBe(true));
  });

  it("critère 3 : given un top 3 rendu dans l'ordre inverse, when l'écran s'affiche, then la page ne le réordonne pas", async () => {
    const { page } = await afficher({ resultat: { conseils: [...TOP3.conseils].reverse(), explications: [] } });

    const cartes = cartesConseil(page).map((c) => compact(c.textContent));
    expect(cartes[0]).toContain(compact('Ver souple finesse'));
    expect(cartes[2]).toContain('Shad');
  });

  it("critère 4 : given un moment hors des heures légales, when l'écran s'affiche, then aucune carte de conseil n'est affichée et l'avertissement donne les heures légales du jour", async () => {
    const { page } = await afficher({ maintenant: HORS_DES_HEURES });

    const texte = compact(page.textContent);
    expect(texte).toContain(compact('Hors des heures légales : pas de pêche aux carnassiers la nuit.'));
    expect(texte).toContain(compact("Heures légales aujourd'hui : 7 h 02 – 18 h 31"));
    expect(cartesConseil(page)).toHaveLength(0);
    expect(texte).toContain(compact("Température de l'eau : 11,5 °C"));
  });

  it("critère 4 (contraire) : given un moment dans les heures légales, when l'écran s'affiche, then l'avertissement « Hors des heures légales » n'apparaît pas", async () => {
    const { page } = await afficher();

    expect(cartesConseil(page)).toHaveLength(3);
    expect(compact(page.textContent)).not.toContain(compact('Hors des heures légales'));
  });

  it("critère 5 : given aucune source de conditions, when l'écran s'affiche, then les 3 cartes s'affichent avec une seule mention « Conseil moins précis »", async () => {
    const { page } = await afficher({ releve: { ...RELEVE, moinsPrecis: true } });

    expect(cartesConseil(page)).toHaveLength(3);
    const mentions = page.textContent?.split('Conseil moins précis').length ?? 1;
    expect(mentions - 1).toBe(1);
  });

  it("critère 5 (contraire) : given des conditions précises, when l'écran s'affiche, then la mention « Conseil moins précis » n'apparaît pas", async () => {
    const { page } = await afficher();

    expect(cartesConseil(page)).toHaveLength(3);
    expect(compact(page.textContent)).not.toContain(compact('Conseil moins précis'));
  });

  it("critère 6 : given la localisation refusée ou indisponible, when l'écran s'affiche, then le message « Localisation indisponible : … » remplace les cartes de conseil et le moteur n'est pas appelé", async () => {
    for (const position of [
      { disponible: false, raison: 'refusée' },
      { disponible: false, raison: 'indisponible' },
    ]) {
      TestBed.resetTestingModule();
      const { page, appelsMoteur } = await afficher({ position: position as unknown as ResultatPosition });

      const texte = compact(page.textContent);
      expect(texte).toContain(compact('Localisation indisponible : active la localisation ou choisis un spot enregistré.'));
      expect(texte).toContain(compact('Position introuvable : autorise la localisation pour voir les conditions.'));
      expect(cartesConseil(page)).toHaveLength(0);
      expect(appelsMoteur).toHaveLength(0);
      vi.useRealTimers();
    }
  });

  it("critère 6 (contraire) : given la position disponible, when l'écran s'affiche, then le message « Localisation indisponible » n'apparaît pas", async () => {
    const { page } = await afficher();

    expect(cartesConseil(page)).toHaveLength(3);
    expect(compact(page.textContent)).not.toContain(compact('Localisation indisponible'));
  });

  it("critère 7 : given l'écran affiché, when je le regarde, then un bouton « Préparer ma sortie » est visible, désactivé et sans action", async () => {
    const { page } = await afficher();

    const bouton = [...page.querySelectorAll<HTMLElement>('button, ion-button')].find((b) => compact(b.textContent) === compact('Préparer ma sortie'));
    expect(bouton, 'aucun bouton « Préparer ma sortie »').toBeDefined();
    const desactive = bouton!.hasAttribute('disabled') || bouton!.getAttribute('aria-disabled') === 'true';
    expect(desactive).toBe(true);
  });

  it("critère 7 : given la position indisponible, when l'écran s'affiche, then le bouton « Préparer ma sortie » est quand même visible", async () => {
    const { page } = await afficher({ position: { disponible: false, raison: 'refusée' } as unknown as ResultatPosition });

    expect(compact(page.textContent)).toContain(compact('Préparer ma sortie'));
  });

  it("critère 3 : given le moteur qui n'a pas encore répondu, when l'écran s'affiche, then « Calcul du conseil… » est affiché", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(DANS_LES_HEURES);
    await TestBed.configureTestingModule({
      imports: [ConseilPage],
      providers: [
        provideIonicAngular(),
        { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
        { provide: CatalogService, useValue: { federation: async () => undefined, typesDeLeurres: async () => TYPES, animations: async () => ANIMATIONS, couleurs: async () => COULEURS } },
        { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
        { provide: AstroService, useValue: { soleil: (): SoleilDuJour => SOLEIL, lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
        { provide: MoteurService, useValue: { conseiller: () => new Promise<ResultatConseil>(() => undefined) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ConseilPage);
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }

    expect(compact((fixture.nativeElement as HTMLElement).textContent)).toContain(compact('Calcul du conseil…'));
  });
});
