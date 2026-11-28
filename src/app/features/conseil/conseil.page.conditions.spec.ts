/*
 * US 64 : carte « Conditions » de l'écran Conseil. Maquette de référence : docs/maquettes/us-64-carte-conditions.html.
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
 * US 295 : la « carte Conditions » est répartie entre l'écran (température de l'eau, sa source, la mention datée, l'état de chargement) et la feuille
 * « Conditions » ouverte par la ligne météo (Débit, Pression, Ciel, Vent, Lune, Heures légales : libellé puis valeur). Ces tests lisent les deux.
 * Les espaces (y compris insécables) ne comptent pas. Les heures sont affichées en heure de Paris.
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
  // La feuille « Conditions » s'ouvre par la ligne météo, quand elle existe.
  if (page.querySelector('.meteo')) await ouvrirConditions(ecranDe(fixture));
  return { fixture, page, appelsReleve, lieuxSoleil };
}

/** Le texte de ce que la carte « Conditions » montrait : l'écran (eau, source, mention, état) et la feuille « Conditions » ouverte. */
function texteCarte(page: HTMLElement): string {
  const morceaux = [...page.querySelectorAll<HTMLElement>('.etat, .eau, app-feuille-conseil [role="dialog"]')];
  expect(morceaux.length, 'ni état, ni eau, ni feuille « Conditions »').toBeGreaterThan(0);
  return compact(morceaux.map((m) => m.textContent).join(' '));
}

/** « Débit : Normal » se lit « Débit » puis « Normal » ; « Température de l'eau : 11,5 °C » se lit « 11,5 °C » (grand chiffre de l'écran). */
function afficheLigne(page: HTMLElement, ligne: string): void {
  const attendu = ligne.replace(/^Température de l'eau : /, '').replace(' : ', ' ');
  expect(texteCarte(page)).toContain(compact(attendu));
}

describe('ConseilPage : carte « Conditions » (US 64)', () => {
  it("critère 1 : given des conditions complètes avec une eau à 11,5 °C mesurée par la station « La Maine à Angers » à 4 km, when j'ouvre l'onglet Conseil, then une carte titrée « Conditions » affiche « Température de l'eau : 11,5 °C » et la source « Station Hub'Eau La Maine à Angers, à 4 km »", async () => {
    const { page, appelsReleve } = await afficher();

    afficheLigne(page, "Température de l'eau : 11,5 °C");
    afficheLigne(page, "Station Hub'Eau La Maine à Angers, à 4 km");
    // Lieu = position GPS : la page demande les conditions de ce lieu.
    expect(JSON.stringify(appelsReleve)).toContain('47.47');
  });

  it("critère 2 : given une température estimée depuis l'air, when la carte s'affiche, then la source affichée est « Estimée depuis l'air des derniers jours »", async () => {
    const { page } = await afficher({
      releve: releve({ conditions: conditions({ tempEau: 9, sourceTempEau: 'estimation' }), stationEau: undefined }),
    });

    afficheLigne(page, "Température de l'eau : 9 °C");
    afficheLigne(page, "Estimée depuis l'air des derniers jours");
  });

  it("critère 2 : given une température saisie à 7 h 30 (heure de Paris), when la carte s'affiche, then la source affichée est « Mesurée au thermomètre à 7 h 30 »", async () => {
    const { page } = await afficher({
      releve: releve({
        conditions: conditions({ tempEau: 12.4, sourceTempEau: 'saisie' }),
        stationEau: undefined,
        saisieA: new Date('2026-11-06T06:30:00Z'),
      }),
    });

    afficheLigne(page, "Température de l'eau : 12,4 °C");
    afficheLigne(page, 'Mesurée au thermomètre à 7 h 30');
  });

  it("critère 2 : given une température saisie à 7 h 30 en heure d'été, when la carte s'affiche, then l'heure affichée est celle de Paris : « Mesurée au thermomètre à 7 h 30 »", async () => {
    const { page } = await afficher({
      releve: releve({
        conditions: conditions({ tempEau: 17, sourceTempEau: 'saisie' }),
        stationEau: undefined,
        saisieA: new Date('2026-07-15T05:30:00Z'),
      }),
    });

    afficheLigne(page, 'Mesurée au thermomètre à 7 h 30');
  });

  for (const [tendance, libelle] of [
    ['crue', 'En crue'],
    ['normal', 'Normal'],
    ['étiage', "À l'étiage"],
  ] as const) {
    it(`critère 3 : given une tendance du débit « ${tendance} », when la carte s'affiche, then la ligne « Débit » affiche « ${libelle} »`, async () => {
      const { page } = await afficher({ releve: releve({ conditions: conditions({ debitTendance: tendance }) }) });

      afficheLigne(page, `Débit : ${libelle}`);
    });
  }

  it("critère 3 : given aucune station de débit proche, when la carte s'affiche, then la ligne « Débit » affiche « Pas de station proche »", async () => {
    const { page } = await afficher({
      releve: releve({ conditions: conditions({ debitTendance: 'inconnu' }), debitAbsent: 'aucune station' }),
    });

    afficheLigne(page, 'Débit : Pas de station proche');
  });

  it("critère 4 : given une pression de 1012 hPa en baisse de 8 hPa sur 48 h, 80 % de nuages et un vent de 12 km/h, when la carte s'affiche, then elle affiche « Pression : 1012 hPa (−8 hPa en 48 h) », « Ciel : 80 % de nuages » et « Vent : 12 km/h »", async () => {
    const { page } = await afficher();

    // Le moins est U+2212, pas le tiret du clavier.
    afficheLigne(page, 'Pression : 1012 hPa (−8 hPa en 48 h)');
    afficheLigne(page, 'Ciel : 80 % de nuages');
    afficheLigne(page, 'Vent : 12 km/h');
  });

  it("critère 5 : given une pleine lune et des heures légales de 7 h 02 à 18 h 31, when la carte s'affiche, then elle affiche « Lune : Pleine lune » et « Heures légales : 7 h 02 – 18 h 31 »", async () => {
    const { page, lieuxSoleil } = await afficher({ lune: 'Pleine lune' });

    afficheLigne(page, 'Lune : Pleine lune');
    // Le tiret est un demi-cadratin (U+2013).
    afficheLigne(page, 'Heures légales : 7 h 02 – 18 h 31');
    // Le soleil est calculé pour le lieu GPS.
    expect(lieuxSoleil[0]).toMatchObject({ latitude: 47.47, longitude: -0.55 });
  });

  it("critère 6 : given des conditions en cours de récupération, when j'ouvre l'onglet Conseil, then la carte affiche « Chargement des conditions… »", async () => {
    const { page } = await afficher({ releve: new Promise<ReleveCarte>(() => undefined) });

    expect(texteCarte(page)).toContain(compact('Chargement des conditions…'));
    expect(texteCarte(page)).not.toContain(compact('Température de l'));
  });

  // Compléments issus de la maquette validée (écrans 5, 6 et 7).
  it("maquette 3 et 6 : given une eau inconnue, when la carte s'affiche, then « Température de l'eau inconnue » sans source (texte remplacé par la US 65)", async () => {
    const { page } = await afficher({
      releve: releve({ conditions: conditions({ tempEau: null, sourceTempEau: null }), stationEau: undefined }),
    });

    afficheLigne(page, "Température de l'eau inconnue");
  });

  it("maquette 6 : given Hub'Eau et la météo indisponibles, when la carte s'affiche, then débit, pression, ciel et vent disent « Indisponible » et lune et heures légales restent là", async () => {
    const { page } = await afficher({
      releve: {
        conditions: conditions({ tempEau: null, sourceTempEau: null, debitTendance: 'inconnu', pressionTendance48h: null, nuages: null, vent: null }),
        pressionHpa: null,
        moinsPrecis: false,
        debitAbsent: "Hub'Eau indisponible",
      },
    });

    for (const libelle of ['Débit', 'Pression', 'Ciel', 'Vent']) afficheLigne(page, `${libelle} : Indisponible`);
    afficheLigne(page, 'Lune : Pleine lune');
    afficheLigne(page, 'Heures légales : 7 h 02 – 18 h 31');
  });

  it('maquette 5 : given des conditions reprises du cache, when la carte s\'affiche, then la mention datée est écrite sous le titre', async () => {
    const { page } = await afficher({ releve: releve({ mention: 'Conditions du 05/11 à 18 h' }) });

    expect(texteCarte(page)).toContain(compact('Conditions du 05/11 à 18 h'));
  });

  it('maquette 7 : given une position introuvable, when la carte s\'affiche, then elle dit « Position introuvable : autorise la localisation pour voir les conditions. » et ne demande aucune condition', async () => {
    const { page, appelsReleve } = await afficher({ position: { disponible: false, motif: 'position refusée' } });

    expect(compact(page.textContent)).toContain(compact('Position introuvable : autorise la localisation, ou choisis un spot dans « Lieu ».'));
    expect(appelsReleve).toHaveLength(0);
  });
});
