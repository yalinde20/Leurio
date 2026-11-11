/*
 * US 89 : l'onboarding en 3 pages. Maquette de référence : docs/maquettes/us-89-onboarding-3-pages.html.
 *
 * Contrat : src/app/features/onboarding/onboarding.page.ts exporte `OnboardingPage` (composant standalone, plein écran).
 *   - Page 1 : titre « Leurio, ton conseil de pêche au leurre », la phrase « La carte de pêche est obligatoire. » puis, sous elle,
 *     le lien « cartedepeche.fr » (https://www.cartedepeche.fr, nouvel onglet), bouton « Suivant ».
 *   - Page 2 : titre « Tes espèces et ton niveau » ; une case à cocher par espèce de `CatalogService.especes()` (dans l'ordre du contenu) ;
 *     un groupe de choix (radio) « Débutant » / « Intermédiaire », aucun choisi au départ ; « Suivant » sans niveau : on reste là,
 *     message « Choisis ton niveau. » (role="alert").
 *   - Page 3 : titre « Pourquoi ta position ? », boutons « Autoriser la localisation » (appelle `PositionService.positionGps()`) et « Plus tard »
 *     (n'appelle pas le GPS, met `OnboardingStore.localisationDifferee` à true). Dans les deux cas : `terminer({ niveau, especesFavorites })`
 *     (codes des espèces), puis navigation vers /conseil. Pas de bouton « Passer » ni « Retour ».
 * Les cases, choix et boutons se trouvent par leur rôle (checkbox, radio, button) ou leur équivalent Ionic (ion-checkbox, ion-radio, ion-button).
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService } from '../../core/data/catalog.service';
import { OnboardingStore } from '../../core/data/onboarding.store';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { OnboardingPage } from './onboarding.page';

// Trois espèces dont une inventée : la liste vient du contenu, elle n'est pas écrite dans la page.
const ESPECES = [
  { code: 'BRO', nom: 'Brochet' },
  { code: 'TRU', nom: 'Truite des lacs' },
  { code: 'SAN', nom: 'Sandre' },
];

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const REFUSEE: ResultatPosition = { disponible: false, motif: 'position refusée' };

const SEL_CASE = '[role="checkbox"], ion-checkbox, input[type="checkbox"]';
const SEL_CHOIX = '[role="radio"], ion-radio, input[type="radio"]';
const SEL_BOUTON = 'button, ion-button, [role="button"]';

const sansImbrication = (page: HTMLElement, selecteur: string): HTMLElement[] =>
  [...page.querySelectorAll<HTMLElement>(selecteur)].filter((e) => !e.parentElement?.closest(selecteur));
const texte = (e: Element | null | undefined): string => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();

async function afficher(position: ResultatPosition | Promise<ResultatPosition> = ANGERS) {
  localStorage.clear();
  const appelsGps: number[] = [];
  await TestBed.configureTestingModule({
    imports: [OnboardingPage],
    providers: [
      provideIonicAngular(),
      provideRouter([]),
      { provide: CatalogService, useValue: { especes: async () => ESPECES } },
      {
        provide: PositionService,
        useValue: {
          positionGps: () => {
            appelsGps.push(1);
            return Promise.resolve(position);
          },
        },
      },
    ],
  }).compileComponents();
  const router = TestBed.inject(Router);
  const navigations: unknown[] = [];
  vi.spyOn(router, 'navigate').mockImplementation(async (commandes) => {
    navigations.push(commandes);
    return true;
  });
  vi.spyOn(router, 'navigateByUrl').mockImplementation(async (url) => {
    navigations.push(url);
    return true;
  });
  const store = TestBed.inject(OnboardingStore);
  const terminer = vi.spyOn(store, 'terminer');
  const fixture = TestBed.createComponent(OnboardingPage);
  const page = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await stabiliser();

  const boutons = () => sansImbrication(page, SEL_BOUTON);
  const bouton = (nom: string): HTMLElement => {
    const b = boutons().find((e) => texte(e) === nom);
    expect(b, `bouton « ${nom} » (présents : ${boutons().map(texte).join(' | ')})`).toBeDefined();
    return b!;
  };
  const toucher = async (e: HTMLElement) => {
    e.click();
    await stabiliser();
  };
  const titre = () => texte(page.querySelector('h1, h2, h3, ion-title, [role="heading"]'));
  const allerPage2 = async () => toucher(bouton('Suivant'));
  const choisirNiveau = async (nom: 'Débutant' | 'Intermédiaire') => {
    const choix = sansImbrication(page, SEL_CHOIX).find((e) => texte(e).startsWith(nom));
    expect(choix, `choix de niveau « ${nom} »`).toBeDefined();
    await toucher(choix!);
  };
  const cocher = async (nom: string) => {
    const c = sansImbrication(page, SEL_CASE).find((e) => texte(e).includes(nom));
    expect(c, `case « ${nom} »`).toBeDefined();
    await toucher(c!);
  };
  const allerPage3 = async (niveau: 'Débutant' | 'Intermédiaire' = 'Débutant') => {
    await allerPage2();
    await choisirNiveau(niveau);
    await toucher(bouton('Suivant'));
  };
  const versConseil = () => navigations.some((n) => n === '/conseil' || (Array.isArray(n) && n.length === 1 && n[0] === '/conseil'));
  return { page, store, terminer, appelsGps, navigations, boutons, bouton, toucher, titre, allerPage2, allerPage3, choisirNiveau, cocher, versConseil, stabiliser };
}

describe('OnboardingPage (US 89)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("critère 1 : given je lance l'app pour la première fois, when elle s'ouvre, then la page 1 explique ce que fait Leurio et propose un bouton « Suivant »", async () => {
    const { page, titre, bouton } = await afficher();

    expect(titre()).toBe('Leurio, ton conseil de pêche au leurre');
    expect(texte(page)).toContain('quel leurre et quelle animation utiliser');
    expect(texte(bouton('Suivant'))).toBe('Suivant');
  });

  it("critère 1 : given la page 1, when je la regarde, then elle n'a ni bouton pour passer l'onboarding ni bouton retour", async () => {
    const { boutons } = await afficher();

    expect(boutons().map(texte)).toEqual(['Suivant']);
  });

  it("critère 2 : given la page 1 est affichée, when je regarde le lien « cartedepeche.fr », then il pointe vers https://www.cartedepeche.fr dans un nouvel onglet, sous la phrase « La carte de pêche est obligatoire. »", async () => {
    const { page } = await afficher();

    const lien = [...page.querySelectorAll('a')].find((a) => texte(a) === 'cartedepeche.fr');
    expect(lien, 'lien « cartedepeche.fr »').toBeDefined();
    expect(lien!.getAttribute('href')).toBe('https://www.cartedepeche.fr');
    expect(lien!.getAttribute('target')).toBe('_blank');
    expect(lien!.getAttribute('rel') ?? '').toContain('noopener');
    const phrase = [...page.querySelectorAll('p, span, div, li')].find((e) => texte(e) === 'La carte de pêche est obligatoire.');
    expect(phrase, 'phrase « La carte de pêche est obligatoire. »').toBeDefined();
    expect(phrase!.compareDocumentPosition(lien!) & Node.DOCUMENT_POSITION_FOLLOWING, 'le lien suit la phrase').toBeTruthy();
  });

  it("critère 3 : given la page 2 est affichée, when je la regarde, then elle liste chaque espèce du contenu à cocher, dans l'ordre, et propose les niveaux « Débutant » et « Intermédiaire » sans en choisir un", async () => {
    const { page, titre, allerPage2 } = await afficher();

    await allerPage2();

    expect(titre()).toBe('Tes espèces et ton niveau');
    const cases = sansImbrication(page, SEL_CASE);
    expect(cases.map(texte)).toEqual(ESPECES.map((e) => e.nom));
    const choix = sansImbrication(page, SEL_CHOIX);
    expect(choix.map((c) => texte(c).split(' ')[0])).toEqual(['Débutant', 'Intermédiaire']);
    const coches = [...cases, ...choix].filter((e) => e.getAttribute('aria-checked') === 'true' || (e as HTMLInputElement).checked === true || e.hasAttribute('checked'));
    expect(coches).toEqual([]);
  });

  it("critère 4 : given la page 2 est affichée et aucun niveau n'est choisi, when je touche « Suivant », then je reste sur la page 2 avec le message « Choisis ton niveau. »", async () => {
    const { page, titre, allerPage2, bouton, toucher, terminer, appelsGps, versConseil } = await afficher();
    await allerPage2();
    expect(page.querySelector('[role="alert"]')).toBeNull();

    await toucher(bouton('Suivant'));

    expect(titre()).toBe('Tes espèces et ton niveau');
    expect(texte(page.querySelector('[role="alert"]'))).toBe('Choisis ton niveau.');
    expect(terminer).not.toHaveBeenCalled();
    expect(appelsGps).toHaveLength(0);
    expect(versConseil()).toBe(false);
  });

  it("critère 4 : given le message « Choisis ton niveau. » affiché, when je choisis un niveau, then le message disparaît", async () => {
    const { page, allerPage2, bouton, toucher, choisirNiveau } = await afficher();
    await allerPage2();
    await toucher(bouton('Suivant'));
    expect(page.querySelector('[role="alert"]')).not.toBeNull();

    await choisirNiveau('Intermédiaire');

    expect(page.querySelector('[role="alert"]')).toBeNull();
  });

  it("critère 4 : given la page 2 sans aucune espèce cochée mais un niveau choisi, when je touche « Suivant », then j'arrive à la page 3 (les espèces sont facultatives)", async () => {
    const { titre, allerPage3 } = await afficher();

    await allerPage3('Débutant');

    expect(titre()).toBe('Pourquoi ta position ?');
  });

  it("critère 5 : given la page 3 qui explique pourquoi Leurio utilise la position, when je touche « Autoriser la localisation » et que j'accepte la demande du téléphone, then le choix est gardé (niveau et espèces) et j'arrive sur l'écran « Conseil » sans position différée", async () => {
    const { page, store, titre, cocher, allerPage2, choisirNiveau, bouton, toucher, terminer, appelsGps, versConseil } = await afficher(ANGERS);
    await allerPage2();
    await cocher('Sandre');
    await cocher('Brochet');
    await choisirNiveau('Intermédiaire');
    await toucher(bouton('Suivant'));
    expect(titre()).toBe('Pourquoi ta position ?');
    expect(texte(page)).toContain('Leurio a besoin de savoir où tu pêches');
    expect(appelsGps).toHaveLength(0);

    await toucher(bouton('Autoriser la localisation'));

    expect(appelsGps).toHaveLength(1);
    expect(terminer).toHaveBeenCalledTimes(1);
    expect(terminer).toHaveBeenCalledWith({ niveau: 'intermediaire', especesFavorites: expect.arrayContaining(['BRO', 'SAN']) });
    expect(terminer.mock.calls[0][0].especesFavorites).toHaveLength(2);
    expect(store.localisationDifferee).toBe(false);
    expect(versConseil()).toBe(true);
  });

  it("critère 6 : given la page 3 est affichée, when je touche « Plus tard », then le choix est gardé, le GPS n'est pas appelé, la position est différée et j'arrive sur l'écran « Conseil »", async () => {
    const { store, allerPage3, bouton, toucher, terminer, appelsGps, versConseil } = await afficher(ANGERS);
    await allerPage3('Débutant');

    await toucher(bouton('Plus tard'));

    expect(appelsGps).toHaveLength(0);
    expect(terminer).toHaveBeenCalledWith({ niveau: 'debutant', especesFavorites: [] });
    expect(store.localisationDifferee).toBe(true);
    expect(versConseil()).toBe(true);
  });

  it("critère 6 : given la page 3 est affichée, when je touche « Autoriser la localisation » et que je refuse la demande du téléphone, then le choix est gardé et j'arrive quand même sur l'écran « Conseil »", async () => {
    const { allerPage3, bouton, toucher, terminer, appelsGps, versConseil } = await afficher(REFUSEE);
    await allerPage3('Débutant');

    await toucher(bouton('Autoriser la localisation'));

    expect(appelsGps).toHaveLength(1);
    expect(terminer).toHaveBeenCalledWith({ niveau: 'debutant', especesFavorites: [] });
    expect(versConseil()).toBe(true);
  });

  it("critère 7 : given les pages 1 et 2, when je les parcours, then le GPS n'est pas appelé et l'onboarding n'est pas marqué terminé avant la fin de la page 3", async () => {
    const { allerPage2, choisirNiveau, bouton, toucher, appelsGps, terminer, store, titre } = await afficher(ANGERS);
    expect(appelsGps).toHaveLength(0);

    await allerPage2();
    await choisirNiveau('Débutant');
    await toucher(bouton('Suivant'));

    expect(titre()).toBe('Pourquoi ta position ?');
    expect(appelsGps).toHaveLength(0);
    expect(terminer).not.toHaveBeenCalled();
    expect(store.lire()).toBeNull();
  });

  it("critère 1 : given l'onboarding quitté au milieu (page 2 atteinte), when l'app est relancée, then il recommence à la page 1", async () => {
    const { allerPage2, choisirNiveau } = await afficher();
    await allerPage2();
    await choisirNiveau('Débutant');
    TestBed.resetTestingModule();

    const relance = await afficher();

    expect(relance.titre()).toBe('Leurio, ton conseil de pêche au leurre');
  });
});
