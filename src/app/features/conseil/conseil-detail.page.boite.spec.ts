/*
 * US 105, critère 4 : le détail d'un conseil affiche la même ligne « Dans ta boîte » / « À la place, dans ta boîte » / « Il te manque »
 * que la carte. Maquette : docs/maquettes/us-105-leurre-de-ma-boite.html (le détail montre la ligne dans la carte du leurre conseillé,
 * sous ses caractéristiques, avant « Pourquoi ce conseil »).
 * Mêmes doubles et même parcours que conseil.page.detail.spec.ts (App + routes) ; la boîte est lue par le vrai TackleBoxService
 * sur un double de SOURCE_TACKLE_BOX.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import {
  Animation,
  CatalogService,
  Couleur,
  Espece,
  TypeLeurre,
} from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { compact, liensDesCoups, ouvrirAutresCoups } from './conseil.page.aides';

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
const MAINTENANT = new Date('2026-11-09T13:00:00Z');
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
  {
    id: 'shad',
    nom: 'Shad',
    article: 'un',
    zoneNage: 'mi-eau',
    tailleCm: [7, 12],
    poidsTeteG: [5, 10],
  },
  { id: 'minnow', nom: 'Minnow (jerkbait)', article: 'un', zoneNage: 'mi-eau', tailleCm: [7, 13] },
  { id: 'crankbait', nom: 'Crankbait', article: 'un', zoneNage: 'mi-eau', tailleCm: [4, 8] },
  { id: 'cuiller', nom: 'Cuillère tournante', article: 'une', zoneNage: 'fond', poidsG: [3, 10] },
] as unknown as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tirée-relâchée', geste: 'g', vitesse: 'v', erreurAEviter: 'e' },
] as unknown as Animation[];
const COULEURS = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];
const ESPECES = [
  { code: 'SAN', nom: 'Sandre', postes: ['cassures', 'fond'] },
] as unknown as Espece[];

const conseil = (surcharge: Partial<Conseil>): Conseil => ({
  typeId: 'shad',
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 10,
  pourquoi: ['Par eau froide, prends un modèle plutôt petit.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
  ...surcharge,
});
// Carte 1 : le shad de la boîte ; carte 2 : substitution par le crankbait ; carte 3 : il manque une cuillère tournante.
const TOP3: ResultatConseil = {
  conseils: [
    conseil({ score: 9 }),
    conseil({ typeId: 'minnow', score: 7, taille: { valeur: 5, unite: 'cm' } }),
    conseil({ typeId: 'cuiller', score: 5, taille: { valeur: 5, unite: 'g' } }),
  ],
  explications: [],
};

const doc = (
  id: string,
  typeId: string,
  tailleCm: number,
  poidsG: number,
  couleur: string,
): DocumentLeurre => ({
  id,
  data: { typeId, tailleCm, poidsG, couleur, marque: '', createdAt: 1000 },
  enAttente: false,
});
const BOITE = [doc('a1', 'shad', 10, 12, 'gardon'), doc('a2', 'crankbait', 6, 8, 'perche')];

async function ouvrirLApp(boite: DocumentLeurre[] | 'erreur' = BOITE) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  let rappel: ((d: DocumentLeurre[]) => void) | null = null;
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void, ko: (e: unknown) => void) => {
      rappel = ok;
      if (boite === 'erreur') ko(new Error('lecture refusée'));
      else ok([...boite]);
      return () => undefined;
    },
  };
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideIonicAngular(),
      provideRouter(routes),
      { provide: SOURCE_TACKLE_BOX, useValue: source },
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      {
        provide: CatalogService,
        useValue: {
          federation: async () => undefined,
          especes: async () => ESPECES,
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
      { provide: MoteurService, useValue: { conseiller: async () => TOP3 } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(App);
  const page = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  const router = TestBed.inject(Router);
  router.setUpLocationChangeListener();
  await router.navigateByUrl('/conseil');
  await stabiliser();
  return {
    page,
    stabiliser,
    nouvelInstantane: async (d: DocumentLeurre[]) => {
      rappel?.([...d]);
      await stabiliser();
    },
  };
}
type Env = Awaited<ReturnType<typeof ouvrirLApp>>;

beforeEach(() =>
  localStorage.setItem(
    'leurio.onboarding',
    JSON.stringify({ niveau: 'debutant', especesFavorites: [] }),
  ),
);
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

/** Touche le coup de ce rang : le « 01 » de la rivière, ou le « 02 » et le « 03 » de la feuille « 2 autres coups » (US 295). */
async function ouvrirDetail(env: Env, rang: number): Promise<void> {
  if (rang > 1) await ouvrirAutresCoups(env);
  const lien = liensDesCoups(env.page).find((l) => compact(l.textContent).startsWith(`0${rang}`));
  if (!lien) throw new Error(`Pas de coup n° ${rang}`);
  lien.click();
  await env.stabiliser();
}
const detailOuvert = (page: HTMLElement): boolean =>
  compact(page.textContent).includes(compact('Détail du conseil'));
const LIBELLES = ['Dans ta boîte :', 'À la place, dans ta boîte :', 'Il te manque :'].map(compact);

describe("Détail d'un conseil : le leurre de ma boîte (US 105)", () => {
  it("critère 4 : given le coup 01 affiche « Dans ta boîte », when j'ouvre son détail, then le détail affiche la ligne « Dans ta boîte : Shad 10 cm gardon »", async () => {
    const env = await ouvrirLApp();
    expect(compact(env.page.querySelector('#coup-1')?.textContent)).toContain(compact('Dans ta boîte'));
    await ouvrirDetail(env, 1);

    expect(detailOuvert(env.page)).toBe(true);
    expect(compact(env.page.textContent)).toContain(compact('Dans ta boîte : Shad 10 cm gardon'));
  });

  it('critère 4 : given le détail du shad, when je le lis, then la ligne est sous les caractéristiques (« Où le lancer ») et avant « Pourquoi ce conseil », libellé en gras', async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 1);

    const texte = compact(env.page.textContent);
    const poste = texte.indexOf(compact('Où le lancer : cassures, fond'));
    const ligne = texte.indexOf(compact('Dans ta boîte : Shad 10 cm gardon'));
    const pourquoi = texte.indexOf(compact('Pourquoi ce conseil'));
    expect(poste).toBeGreaterThan(-1);
    expect(ligne).toBeGreaterThan(poste);
    expect(pourquoi).toBeGreaterThan(ligne);
    const gras = [...env.page.querySelectorAll<HTMLElement>('b, strong')].find(
      (e) => compact(e.textContent) === compact('Dans ta boîte :'),
    );
    expect(gras, 'libellé en gras').toBeDefined();
  });

  it("critère 4 : given le coup 02 est une substitution, when j'ouvre son détail, then le détail affiche « À la place, dans ta boîte : Crankbait 6 cm perche »", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 2);

    expect(compact(env.page.textContent)).toContain(
      compact('À la place, dans ta boîte : Crankbait 6 cm perche'),
    );
  });

  it("critère 4 : given le coup 03 manque dans la boîte, when j'ouvre son détail, then le détail affiche « Il te manque : une cuillère tournante 3–10 g couleur gardon »", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 3);

    expect(compact(env.page.textContent)).toContain(
      compact('Il te manque : une cuillère tournante 3–10 g couleur gardon'),
    );
  });

  it("critère 4 : given la boîte en erreur de lecture, when j'ouvre un détail, then il n'a aucune ligne de boîte, puis la ligne apparaît quand la lecture reprend", async () => {
    const env = await ouvrirLApp('erreur');
    await ouvrirDetail(env, 1);

    expect(detailOuvert(env.page)).toBe(true);
    const texte = compact(env.page.textContent);
    expect(LIBELLES.some((l) => texte.includes(l))).toBe(false);

    await env.nouvelInstantane(BOITE);
    expect(compact(env.page.textContent)).toContain(compact('Dans ta boîte : Shad 10 cm gardon'));
  });
});
