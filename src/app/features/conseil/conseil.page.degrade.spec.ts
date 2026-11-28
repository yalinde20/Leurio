/*
 * US 65 : carte « Conditions » en mode dégradé. Maquette de référence : docs/maquettes/us-65-carte-conditions-mode-degrade.html.
 * Mêmes doubles que conseil.page.conditions.spec.ts (US 64). Le badge « Moins précis » et l'invitation « Mesure-la au thermomètre »
 * sont du texte simple (ni bouton ni lien).
 *
 * Ces tests rendent `ConseilPage` et remplacent, par des doubles, les trois services que la page injecte :
 *   - PositionService  : `positionGps()` rend le lieu (la page l'appelle ; lieu = position GPS, moment = maintenant).
 *   - ConditionsService: `releve(demande)` rend un `ReleveActuel`. Pour que la page affiche station, heure de saisie et cas du débit,
 *                        `ReleveActuel` (conditions.service.ts) doit recevoir trois champs optionnels en plus de `mention` :
 *                          stationEau?: { nom: string; distanceKm: number }   // présent si sourceTempEau === 'capteur'
 *                          saisieA?: Date                                      // présent si sourceTempEau === 'saisie'
 *                          debitAbsent?: 'aucune station' | "Hub'Eau indisponible" // dit pourquoi debitTendance vaut 'inconnu'
 *   - AstroService     : `soleil(lieu, jour)` (lever/coucher) et `lune(instant, lieu)` (phase).
 *                        Les heures légales sont calculées par la page avec le vrai `heuresLegales` (core/regulation/legal-hours.ts).
 *
 * Structure attendue (neutre sur les balises) : la carte est un `section`, `article` ou `ion-card` qui contient un titre
 * (h1 à h6 ou `ion-card-title`) « Conditions ». Chaque donnée s'écrit « Libellé : valeur » ; les espaces (y compris insécables) ne comptent pas.
 * Les heures sont affichées en heure de Paris.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService } from '../../core/data/catalog.service';
import { AstroService, LuneDuMoment, NomPhaseLune, SoleilDuJour } from '../../core/data/astro.service';
import { Conditions } from '../../core/engine/conditions';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { Lieu } from '../../core/data/weather-provider';
import { ConseilPage } from './conseil.page';
import { compact, ecranDe, ouvrirConditions, stabiliser } from './conseil.page.aides';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';

type ReleveCarte = ReleveActuel & {
  stationEau?: { nom: string; distanceKm: number };
  saisieA?: Date;
  debitAbsent?: 'aucune station' | "Hub'Eau indisponible";
};

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};

// 6 novembre 2026, heure d'hiver (UTC+1) : lever 7 h 32, coucher 18 h 01, donc heures légales 7 h 02 – 18 h 31.
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-06T06:32:00Z'), coucher: new Date('2026-11-06T17:01:00Z') };

function conditions(surcharge: Partial<Conditions> = {}): Conditions {
  return {
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
  };
}

/** Relevé complet de la maquette (écran 2) : eau mesurée par la station de La Maine, débit normal. */
function releve(surcharge: Partial<ReleveCarte> = {}): ReleveCarte {
  return {
    conditions: conditions(),
    pressionHpa: 1012,
    moinsPrecis: false,
    stationEau: { nom: 'La Maine à Angers', distanceKm: 4 },
    ...surcharge,
  };
}

interface Reglages {
  releve?: ReleveCarte | Promise<ReleveCarte>;
  position?: ResultatPosition;
  lune?: NomPhaseLune;
}

async function afficher({ releve: relevé = releve(), position = ANGERS, lune = 'Pleine lune' }: Reglages = {}) {
  const appelsReleve: unknown[] = [];
  const lieuxSoleil: Lieu[] = [];
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps: async () => position } },
      { provide: CatalogService, useValue: { federation: async () => undefined } },
      {
        provide: ConditionsService,
        useValue: {
          releve: (demande: unknown) => {
            appelsReleve.push(demande);
            return Promise.resolve(relevé);
          },
        },
      },
      {
        provide: AstroService,
        useValue: {
          soleil: (lieu: Lieu): SoleilDuJour => {
            lieuxSoleil.push(lieu);
            return SOLEIL;
          },
          lune: (): LuneDuMoment => ({ phase: lune, fractionEclairee: 1 }),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  await stabiliser(fixture);
  const page = fixture.nativeElement as HTMLElement;
  // US 295 : les conditions complètes sont dans la feuille « Conditions », ouverte par la ligne météo.
  if (page.querySelector('.meteo')) await ouvrirConditions(ecranDe(fixture));
  return { fixture, page, appelsReleve, lieuxSoleil };
}


/** Ce que montrait la carte « Conditions » : la température de l'eau, sa source et la mention datée de l'écran, et la feuille « Conditions » ouverte. */
const zonesConditions = (page: HTMLElement): HTMLElement[] => [...page.querySelectorAll<HTMLElement>('.eau, app-feuille-conseil [role="dialog"]')];

function texteCarte(page: HTMLElement): string {
  const zones = zonesConditions(page);
  expect(zones.length, "ni l'eau, ni la feuille « Conditions »").toBeGreaterThan(0);
  return compact(zones.map((z) => z.textContent).join(' '));
}

/** « Débit : Indisponible » se lit « Débit » puis « Indisponible » (libellé puis valeur). */
function afficheLigne(page: HTMLElement, ligne: string): void {
  expect(texteCarte(page)).toContain(compact(ligne.replace(' : ', ' ')));
}

const textesInteractifs = (page: HTMLElement): string[] =>
  zonesConditions(page).flatMap((z) => [...z.querySelectorAll('button, a, ion-button')].map((e) => e.textContent ?? ''));

describe('ConseilPage : carte « Conditions » en mode dégradé (US 65)', () => {
  it("critère 1 : given des conditions reprises du cache du 27/10 à 18 h, when la carte « Conditions » s'affiche, then elle affiche la mention « Conditions du 27/10 à 18 h »", async () => {
    const { page } = await afficher({ releve: releve({ mention: 'Conditions du 27/10 à 18 h' }) });

    afficheLigne(page, 'Conditions du 27/10 à 18 h');
  });

  it("critère 2 : given des conditions moins précises, when la carte s'affiche, then elle affiche le libellé « Moins précis » et « Indisponible » sur les lignes Pression, Ciel et Vent", async () => {
    const { page } = await afficher({
      releve: releve({
        conditions: conditions({ pressionTendance48h: null, nuages: null, vent: null }),
        pressionHpa: null,
        moinsPrecis: true,
      }),
    });

    afficheLigne(page, 'Moins précis');
    for (const libelle of ['Pression', 'Ciel', 'Vent']) afficheLigne(page, `${libelle} : Indisponible`);
  });

  it("critère 2 : given des conditions moins précises, when la carte s'affiche, then « Moins précis » est un badge sous le titre, en texte simple (ni bouton ni lien)", async () => {
    const { page } = await afficher({
      releve: releve({
        conditions: conditions({ pressionTendance48h: null, nuages: null, vent: null }),
        pressionHpa: null,
        moinsPrecis: true,
      }),
    });

    const badge = zonesConditions(page).flatMap((z) => [...z.querySelectorAll('*')]).find(
      (e) => e.children.length === 0 && compact(e.textContent) === compact('Moins précis'),
    );
    expect(badge, 'aucun élément ne porte seulement « Moins précis »').toBeDefined();
    expect(badge?.closest('dl'), 'le badge est sous le titre, pas dans la liste des données').toBeNull();
    expect(textesInteractifs(page).join(' ')).not.toContain('Moins précis');
  });

  it("US 295 : given une eau seulement estimée depuis l'air (Hub'Eau en panne), when la feuille « Conditions » s'affiche, then le badge « Moins précis » y est", async () => {
    const { page } = await afficher({
      releve: releve({ conditions: conditions({ tempEau: 9, sourceTempEau: 'estimation' }), stationEau: undefined, moinsPrecis: false }),
    });

    expect(texteCarte(page)).toContain(compact('Moins précis'));
  });

  it("critère 2 (contraire) : given des conditions précises (moinsPrecis: false), when la carte s'affiche, then aucun libellé « Moins précis » n'apparaît", async () => {
    const { page } = await afficher({ releve: releve({ moinsPrecis: false }) });

    expect(texteCarte(page)).not.toContain(compact('Moins précis'));
  });

  it("critère 3 : given une température de l'eau inconnue, when la carte s'affiche, then elle affiche « Température de l'eau inconnue » et l'invitation « Mesure-la au thermomètre »", async () => {
    const { page } = await afficher({
      releve: releve({ conditions: conditions({ tempEau: null, sourceTempEau: null }), stationEau: undefined }),
    });

    afficheLigne(page, "Température de l'eau inconnue");
    afficheLigne(page, 'Mesure-la au thermomètre');
    expect(texteCarte(page)).not.toContain(compact('Inconnue'));
  });

  it("critère 3 : given une température de l'eau inconnue, when la carte s'affiche, then l'invitation est un texte simple : aucun bouton ni lien", async () => {
    const { page } = await afficher({
      releve: releve({ conditions: conditions({ tempEau: null, sourceTempEau: null }), stationEau: undefined }),
    });

    expect(texteCarte(page)).toContain(compact('Mesure-la au thermomètre'));
    expect(textesInteractifs(page).map(compact).join('')).not.toContain(compact('Mesure-la'));
  });

  it("critère 3 (contraire) : given une température de l'eau connue, when la carte s'affiche, then ni « Température de l'eau inconnue » ni l'invitation n'apparaissent", async () => {
    const { page } = await afficher();

    expect(texteCarte(page)).not.toContain(compact("Température de l'eau inconnue"));
    expect(texteCarte(page)).not.toContain(compact('Mesure-la au thermomètre'));
  });

  it("critère 4 : given une tendance du débit indisponible pour cause de panne Hub'Eau, when la carte s'affiche, then la ligne « Débit » affiche « Indisponible »", async () => {
    const { page } = await afficher({
      releve: releve({ conditions: conditions({ debitTendance: 'inconnu' }), debitAbsent: "Hub'Eau indisponible" }),
    });

    afficheLigne(page, 'Débit : Indisponible');
  });
});
