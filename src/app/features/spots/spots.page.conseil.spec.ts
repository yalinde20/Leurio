/*
 * US 7 : ouvrir le conseil pour un spot et emplacement « Préparer ma sortie ». Maquette de référence : docs/maquettes/us-7-voir-le-conseil.html.
 * PLAN §2.1, §3, §8.
 * US 15 remplace « Bientôt disponible » (note de la story) : les tests « critère 3 » de la fin du fichier décrivent le comportement de l'US 15.
 *
 * Les tests passent par l'app réelle (App + routes) : onglet « Spots », tap sur une ligne, boutons, onglet « Conseil ». Aucun mécanisme
 * interne n'est imposé (service, paramètre d'URL...) : on observe l'écran et ce que reçoivent les doubles.
 *
 * Contrat du DOM (neutre sur les balises autres que ceux-ci) :
 *  - dans `app-spots`, le `li` du spot ouvert contient, HORS du `button` de la ligne, deux `button` dont le texte est « Voir le conseil » et
 *    « Préparer ma sortie », placés après le lien « Site de la fédération » (ou après le bandeau « Fermé » en 1re catégorie hors saison) ;
 *    les autres lignes n'en ont pas ;
 *  - « Préparer ma sortie » (US 15, remplace « Bientôt disponible ») : sans réseau, un élément `[role="alert"]` « Pas de réseau : prépare ta
 *    sortie avant de partir » dans le `li` du spot ouvert, sous les boutons ; on reste sur `/spots`, aucune requête (fetch, XMLHttpRequest,
 *    sendBeacon), aucun appel à la position ni à l'écriture des spots ; le message disparaît quand on ouvre un autre spot ;
 *  - « Voir le conseil » : l'URL devient `/conseil` ; dans `app-conseil` le bouton « Lieu » affiche « Pont de Cé » ; la position vient de
 *    `PositionService.positionSpot` (pas de GPS), `ConditionsService.releve` reçoit `lieu` et `spot: { categorie, departement }` du spot ;
 *    le moment et l'espèce choisis sont gardés ; le lieu n'est pas mémorisé (une nouvelle app repart sur « Ma position »).
 * Doubles : SOURCE_SPOTS (le vrai SpotsService lit dessus), PositionService, CatalogService, ConditionsService, AstroService, MoteurService.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, Espece, Federation, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, DemandeConditions, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition, Spot } from '../../core/data/position.service';
import { DocumentSpot, SOURCE_SPOTS } from '../../core/data/spots.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const JUIN = new Date('2026-06-20T10:00:00Z');
const FEVRIER = new Date('2026-02-15T10:00:00Z');

const GUE: DocumentSpot = { id: 's1', data: { nom: 'Gué de la Sarthe', lat: 47.8, lng: -0.3, categorie: 1, milieu: 'riviere', departement: '49', prive: true } };
const PONT_DE_CE: DocumentSpot = { id: 's2', data: { nom: 'Pont de Cé', lat: 47.43, lng: -0.52, categorie: 2, milieu: 'riviere', departement: '49', prive: true } };
const SEVRE: DocumentSpot = { id: 's3', data: { nom: 'La Sèvre à Clisson', lat: 47.09, lng: -1.28, categorie: 2, milieu: 'riviere', departement: '44', prive: true } };

const FEDERATIONS: Record<string, Pick<Federation, 'departement' | 'nom' | 'url'>> = {
  '49': { departement: '49', nom: 'Fédération de pêche du Maine-et-Loire', url: 'https://fedepeche49.fr' },
  '44': { departement: '44', nom: 'Fédération de pêche de Loire-Atlantique', url: 'https://fedepeche44.fr' },
};

const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'lame', nom: 'Lame vibrante' },
] as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tirée-relâchée' },
  { id: 'dandine', nom: 'Dandine' },
] as Animation[];
const COULEURS = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];
const ESPECES = [
  { code: 'SAN', nom: 'Sandre', postes: ['fond'] },
  { code: 'BRO', nom: 'Brochet', postes: ['herbiers'] },
] as unknown as Espece[];

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
/** Le top 3 de la position GPS (Shad) et celui d'un spot (Lame vibrante) : on voit lequel est affiché. */
const TOP_GPS: ResultatConseil = { conseils: [conseil({ typeId: 'shad' }), conseil({ typeId: 'shad', score: 8 }), conseil({ typeId: 'shad', score: 7 })], explications: [] };
const TOP_SPOT: ResultatConseil = {
  conseils: [conseil({ typeId: 'lame', techniqueId: 'dandine' }), conseil({ typeId: 'lame', techniqueId: 'dandine', score: 8 }), conseil({ typeId: 'lame', techniqueId: 'dandine', score: 7 })],
  explications: [],
};

interface Reglages {
  date?: Date;
  spots?: DocumentSpot[];
}

async function ouvrirLApp({ date = JUIN, spots = [GUE, PONT_DE_CE] }: Reglages = {}, depart = '/spots') {
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(date);
  const appels = {
    positionGps: 0,
    positionSpot: [] as Spot[],
    releves: [] as DemandeConditions[],
    moteur: [] as Conditions[],
    federations: 0,
    ajouts: 0,
    requetes: [] as string[],
  };
  const jourMs = 24 * 3600 * 1000;
  const soleil = (_lieu: unknown, moment: Date): SoleilDuJour => {
    const minuit = Math.floor(moment.getTime() / jourMs) * jourMs;
    return { lever: new Date(minuit + 3 * 3600 * 1000), coucher: new Date(minuit + 20 * 3600 * 1000) };
  };
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideIonicAngular(),
      provideRouter(routes),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      {
        provide: SOURCE_SPOTS,
        useValue: {
          uid: async () => 'A',
          documents: async () => [...spots],
          ecouter: (_uid: string, ok: (d: DocumentSpot[]) => void) => {
            ok([...spots]);
            return () => undefined;
          },
          ajouter: async () => {
            appels.ajouts++;
          },
        },
      },
      {
        provide: PositionService,
        useValue: {
          positionGps: async () => {
            appels.positionGps++;
            return ANGERS;
          },
          positionSpot: async (spot: Spot): Promise<ResultatPosition> => {
            appels.positionSpot.push(spot);
            return { disponible: true, source: 'spot', latitude: spot.lat, longitude: spot.lng, precisionM: null, departement: spot.departement };
          },
        },
      },
      {
        provide: CatalogService,
        useValue: {
          federation: async (d: string) => {
            appels.federations++;
            return FEDERATIONS[d];
          },
          urlFederation: async (d: string) => FEDERATIONS[d]?.url,
          typesDeLeurres: async () => TYPES,
          animations: async () => ANIMATIONS,
          couleurs: async () => COULEURS,
          especes: async () => ESPECES,
        },
      },
      {
        provide: ConditionsService,
        useValue: {
          releve: async (demande: DemandeConditions & { especeCible?: string }): Promise<ReleveActuel> => {
            appels.releves.push(demande);
            return {
              conditions: {
                tempEau: demande.spot ? 10.5 : 11.5,
                sourceTempEau: 'capteur',
                debitTendance: 'normal',
                pressionTendance48h: -8,
                nuages: 80,
                vent: 12,
                moment: 'jour',
                saison: 'automne',
                categorie: demande.spot?.categorie ?? null,
                departement: demande.spot?.departement ?? '49',
                niveau: 'debutant',
                ...(demande.especeCible !== undefined && demande.especeCible !== 'toutes' ? { especeCible: demande.especeCible } : {}),
              } as Conditions,
              pressionHpa: 1012,
              moinsPrecis: false,
            };
          },
        },
      },
      { provide: AstroService, useValue: { soleil, lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
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
  await router.navigateByUrl(depart);
  await stabiliser();
  return { page, router, appels, stabiliser };
}
type Env = Awaited<ReturnType<typeof ouvrirLApp>>;

let espions: { mockRestore: () => void }[] = [];
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  for (const e of espions) e.mockRestore();
  espions = [];
});

/** Espionne tout ce qui peut sortir sur le réseau ; les URL demandées s'ajoutent à `appels.requetes`. */
function surveillerLeReseau(env: Env): void {
  const fetchEspion = vi.spyOn(globalThis, 'fetch').mockImplementation(async (entree) => {
    env.appels.requetes.push(`fetch ${String(entree)}`);
    return new Response('{}');
  });
  const ouvertureXhr = vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(function (_methode: string, url: string | URL) {
    env.appels.requetes.push(`xhr ${String(url)}`);
  } as never);
  const baliseEspion = typeof navigator.sendBeacon === 'function' ? vi.spyOn(navigator, 'sendBeacon').mockImplementation((url) => {
    env.appels.requetes.push(`beacon ${String(url)}`);
    return true;
  }) : null;
  espions.push(fetchEspion, ouvertureXhr, ...(baliseEspion ? [baliseEspion] : []));
}

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');
const pageSpots = (env: Env): HTMLElement => {
  const p = env.page.querySelector<HTMLElement>('app-spots');
  if (!p) throw new Error('la page « Spots » n\'est pas affichée');
  return p;
};
const pageConseil = (env: Env): HTMLElement => {
  const p = env.page.querySelector<HTMLElement>('app-conseil');
  if (!p) throw new Error('la page « Conseil » n\'est pas affichée');
  return p;
};
const lignesSpots = (env: Env): HTMLLIElement[] => [...pageSpots(env).querySelectorAll<HTMLLIElement>('ul.liste > li, ul > li')];
function ligne(env: Env, nom: string): HTMLLIElement {
  const li = lignesSpots(env).find((l) => compact(l.querySelector('button')?.textContent).startsWith(compact(nom)));
  if (!li) throw new Error(`aucune ligne « ${nom} »`);
  return li;
}
const boutonsActions = (li: HTMLElement): HTMLButtonElement[] =>
  [...li.querySelectorAll<HTMLButtonElement>('button')].filter((b) => ['Voir le conseil', 'Préparer ma sortie'].includes((b.textContent ?? '').trim()));
function action(li: HTMLElement, libelle: string): HTMLButtonElement {
  const b = boutonsActions(li).find((x) => (x.textContent ?? '').trim() === libelle);
  if (!b) throw new Error(`aucun bouton « ${libelle} » dans la ligne`);
  return b;
}
async function ouvrirSpot(env: Env, nom: string): Promise<HTMLLIElement> {
  const li = ligne(env, nom);
  li.querySelector('button')!.click();
  await env.stabiliser();
  return ligne(env, nom);
}
const boutonLieu = (env: Env): HTMLButtonElement => {
  const b = [...pageConseil(env).querySelectorAll<HTMLButtonElement>('button')].find((x) => compact(x.textContent).startsWith(compact('Lieu')));
  if (!b) throw new Error('aucun bouton « Lieu »');
  return b;
};
const boutonConseil = (env: Env, libelle: string): HTMLButtonElement => {
  const b = [...pageConseil(env).querySelectorAll<HTMLButtonElement>('button')].find((x) => compact(x.textContent).startsWith(compact(libelle)));
  if (!b) throw new Error(`aucun bouton « ${libelle} »`);
  return b;
};
const cartesConseil = (env: Env): HTMLElement[] =>
  [...pageConseil(env).querySelectorAll<HTMLElement>('section, article, ion-card')].filter(
    (e) => compact(e.textContent).includes(compact('Animation :')) && !e.querySelector('section, article, ion-card'),
  );

describe('SpotsPage : ouvrir le conseil pour un spot (US 7)', () => {
  it('critère 1 : given un spot ouvert, when je regarde les actions, then les boutons « Voir le conseil » et « Préparer ma sortie » sont affichés dans sa ligne, hors du bouton de la ligne, sous le lien « Site de la fédération »', async () => {
    const env = await ouvrirLApp();
    const li = await ouvrirSpot(env, 'Pont de Cé');

    const boutons = boutonsActions(li);
    expect(boutons.map((b) => (b.textContent ?? '').trim())).toEqual(['Voir le conseil', 'Préparer ma sortie']);
    const boutonLigne = li.querySelector('button')!;
    expect(boutons.every((b) => !boutonLigne.contains(b))).toBe(true);
    // Positive control : le lien de la fédération (US 5) est bien là, et les boutons le suivent.
    const lien = [...li.querySelectorAll('a')].find((a) => compact(a.textContent) === compact('Site de la fédération'));
    expect(lien, 'lien « Site de la fédération » absent').toBeDefined();
    expect(lien!.compareDocumentPosition(boutons[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('critère 1 : given un spot ouvert, when je regarde les autres lignes, then elles ne montrent pas les boutons', async () => {
    const env = await ouvrirLApp();
    await ouvrirSpot(env, 'Pont de Cé');

    expect(boutonsActions(ligne(env, 'Pont de Cé'))).toHaveLength(2);
    expect(boutonsActions(ligne(env, 'Gué de la Sarthe'))).toHaveLength(0);
  });

  it('critère 1 : given aucun spot ouvert, when je regarde la liste, then aucun bouton « Voir le conseil » ni « Préparer ma sortie » n\'est affiché', async () => {
    const env = await ouvrirLApp();

    expect(lignesSpots(env)).toHaveLength(2);
    expect(boutonsActions(pageSpots(env))).toHaveLength(0);
    // Positive control : une fois un spot ouvert, ils apparaissent.
    await ouvrirSpot(env, 'Pont de Cé');
    expect(boutonsActions(pageSpots(env))).toHaveLength(2);
  });

  it('critère 1 : given un spot de 1re catégorie ouvert hors saison (15/02/2026), when je regarde les actions, then elles sont affichées sous le bandeau « Fermé »', async () => {
    const env = await ouvrirLApp({ date: FEVRIER });
    const li = await ouvrirSpot(env, 'Gué de la Sarthe');

    const bandeau = li.querySelector<HTMLElement>('[role="note"]');
    expect(bandeau, 'bandeau « Fermé » absent').not.toBeNull();
    expect(compact(bandeau!.textContent)).toContain(compact('Fermé'));
    const boutons = boutonsActions(li);
    expect(boutons.map((b) => (b.textContent ?? '').trim())).toEqual(['Voir le conseil', 'Préparer ma sortie']);
    expect(boutons.every((b) => !bandeau!.contains(b))).toBe(true);
    expect(bandeau!.compareDocumentPosition(boutons[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('critère 2 : given le spot « Pont de Cé » ouvert, when je touche « Voir le conseil », then l\'onglet « Conseil » s\'ouvre avec « Pont de Cé » comme lieu', async () => {
    const env = await ouvrirLApp();
    const li = await ouvrirSpot(env, 'Pont de Cé');
    action(li, 'Voir le conseil').click();
    await env.stabiliser();

    expect(env.router.url).toBe('/conseil');
    expect(compact(boutonLieu(env).textContent)).toContain(compact('Pont de Cé'));
    expect(compact(boutonLieu(env).textContent)).not.toContain(compact('Ma position'));
  });

  it('critère 2 : given le spot « Pont de Cé » ouvert, when je touche « Voir le conseil », then le conseil est calculé avec la position, la catégorie et le département du spot', async () => {
    const env = await ouvrirLApp();
    const gpsAvant = env.appels.positionGps;
    const li = await ouvrirSpot(env, 'Pont de Cé');
    action(li, 'Voir le conseil').click();
    await env.stabiliser();

    expect(env.appels.positionSpot).toEqual([expect.objectContaining({ nom: 'Pont de Cé', lat: 47.43, lng: -0.52, departement: '49' })]);
    expect(env.appels.positionGps).toBe(gpsAvant);
    const dernier = env.appels.releves.at(-1)!;
    expect(dernier.lieu).toEqual({ latitude: 47.43, longitude: -0.52 });
    expect(dernier.spot).toEqual({ categorie: 2, departement: '49' });
    expect(env.appels.moteur.at(-1)).toMatchObject({ categorie: 2, departement: '49' });
    const cartes = cartesConseil(env).map((c) => compact(c.textContent));
    expect(cartes).toHaveLength(3);
    expect(cartes[0]).toContain(compact('Lame vibrante'));
  });

  it('critère 2 : given l\'écran « Conseil » déjà affiché sur « Ma position » puis l\'onglet « Spots », when je touche « Voir le conseil » d\'un spot, then le lieu passe de « Ma position » au spot', async () => {
    const env = await ouvrirLApp({}, '/conseil');
    expect(compact(boutonLieu(env).textContent)).toContain(compact('Ma position'));
    await env.router.navigateByUrl('/spots');
    await env.stabiliser();
    const li = await ouvrirSpot(env, 'Pont de Cé');
    action(li, 'Voir le conseil').click();
    await env.stabiliser();

    expect(env.router.url).toBe('/conseil');
    expect(compact(boutonLieu(env).textContent)).toContain(compact('Pont de Cé'));
    expect(env.appels.releves.at(-1)!.spot).toEqual({ categorie: 2, departement: '49' });
  });

  it('critère 2 : given un autre spot ouvert (La Sèvre à Clisson, Loire-Atlantique), when je touche « Voir le conseil », then le conseil utilise sa position, sa catégorie et son département', async () => {
    const env = await ouvrirLApp({ spots: [GUE, PONT_DE_CE, SEVRE] });
    const li = await ouvrirSpot(env, 'La Sèvre à Clisson');
    action(li, 'Voir le conseil').click();
    await env.stabiliser();

    expect(compact(boutonLieu(env).textContent)).toContain(compact('La Sèvre à Clisson'));
    expect(env.appels.releves.at(-1)).toMatchObject({ lieu: { latitude: 47.09, longitude: -1.28 }, spot: { categorie: 2, departement: '44' } });
  });

  it('critère 2 : given une espèce choisie sur l\'écran « Conseil », when je touche « Voir le conseil » d\'un spot, then l\'espèce et le moment gardent leur valeur', async () => {
    const env = await ouvrirLApp({}, '/conseil');
    boutonConseil(env, 'Espèce').click();
    await env.stabiliser();
    const sandre = [...pageConseil(env).querySelectorAll<HTMLElement>('[role="dialog"] [role="radio"]')].find((l) => compact(l.textContent).startsWith(compact('Sandre')));
    expect(sandre, 'aucune ligne « Sandre »').toBeDefined();
    sandre!.click();
    await env.stabiliser();
    const moment = compact(boutonConseil(env, 'Moment').textContent);
    expect(compact(boutonConseil(env, 'Espèce').textContent)).toContain(compact('Sandre'));

    await env.router.navigateByUrl('/spots');
    await env.stabiliser();
    const li = await ouvrirSpot(env, 'Pont de Cé');
    action(li, 'Voir le conseil').click();
    await env.stabiliser();

    expect(compact(boutonLieu(env).textContent)).toContain(compact('Pont de Cé'));
    expect(compact(boutonConseil(env, 'Espèce').textContent)).toContain(compact('Sandre'));
    expect(compact(boutonConseil(env, 'Moment').textContent)).toBe(moment);
    expect(env.appels.moteur.at(-1)).toMatchObject({ especeCible: 'SAN' });
  });

  it('critère 2 : given « Pont de Cé » choisi par « Voir le conseil », when l\'app est rouverte, then le lieu repart sur « Ma position »', async () => {
    const env = await ouvrirLApp();
    const li = await ouvrirSpot(env, 'Pont de Cé');
    action(li, 'Voir le conseil').click();
    await env.stabiliser();
    expect(compact(boutonLieu(env).textContent)).toContain(compact('Pont de Cé'));
    TestBed.resetTestingModule();
    vi.useRealTimers();

    const neuf = await ouvrirLApp({}, '/conseil');
    expect(compact(boutonLieu(neuf).textContent)).toContain(compact('Ma position'));
    expect(neuf.appels.positionSpot).toHaveLength(0);
  });

  // US 15 remplace « Bientôt disponible » (note de la story) : les trois tests ci-dessous gardent ce que protégeait l'ancien critère 3
  // (rester sur « Spots », message dans le li du spot ouvert sous les boutons, message qui disparaît à l'ouverture d'un autre spot),
  // avec le comportement de l'US 15. Le détail de la préparation est dans spots.page.sortie.spec.ts.
  const horsLigne = () => espions.push(vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false));

  it('critère 3 : given un spot ouvert sans réseau, when je touche « Préparer ma sortie », then « Pas de réseau : prépare ta sortie avant de partir » (role="alert") s\'affiche sous les boutons, « Bientôt disponible » n\'existe plus et on reste sur l\'onglet « Spots »', async () => {
    const env = await ouvrirLApp();
    horsLigne();
    const li = await ouvrirSpot(env, 'Pont de Cé');
    expect(li.querySelector('[role="status"], [role="alert"]'), 'le message est absent avant le tap').toBeNull();
    action(li, 'Préparer ma sortie').click();
    await env.stabiliser();

    const apres = ligne(env, 'Pont de Cé');
    const alerte = apres.querySelector<HTMLElement>('[role="alert"]');
    expect(alerte, 'aucun role="alert" dans la ligne').not.toBeNull();
    expect(compact(alerte!.textContent)).toBe(compact('Pas de réseau : prépare ta sortie avant de partir'));
    const boutons = boutonsActions(apres);
    expect(boutons).toHaveLength(2);
    expect(boutons[1].compareDocumentPosition(alerte!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(compact(pageSpots(env).textContent)).not.toContain(compact('Bientôt disponible'));
    expect(env.router.url).toBe('/spots');
  });

  it('critère 3 : given un spot ouvert sans réseau, when je touche « Préparer ma sortie », then rien n\'est téléchargé (aucune requête, ni position, ni écriture des spots)', async () => {
    const env = await ouvrirLApp();
    horsLigne();
    const li = await ouvrirSpot(env, 'Pont de Cé');
    surveillerLeReseau(env);
    const avant = {
      gps: env.appels.positionGps,
      spot: env.appels.positionSpot.length,
      ajouts: env.appels.ajouts,
      releves: env.appels.releves.length,
      moteur: env.appels.moteur.length,
      federations: env.appels.federations,
    };
    action(li, 'Préparer ma sortie').click();
    await env.stabiliser();

    // Positive control : l'action a bien eu lieu (le message est affiché), sinon l'absence de requête ne prouve rien.
    expect(compact(ligne(env, 'Pont de Cé').querySelector('[role="alert"]')?.textContent)).toBe(compact('Pas de réseau : prépare ta sortie avant de partir'));
    expect(env.appels.requetes).toEqual([]);
    expect(env.appels.positionGps).toBe(avant.gps);
    expect(env.appels.positionSpot).toHaveLength(avant.spot);
    expect(env.appels.ajouts).toBe(avant.ajouts);
    expect(env.appels.releves).toHaveLength(avant.releves);
    expect(env.appels.moteur).toHaveLength(avant.moteur);
    expect(env.appels.federations).toBe(avant.federations);
  });

  it('critère 3 : given le message de « Préparer ma sortie » affiché, when j\'ouvre un autre spot, then le message disparaît', async () => {
    const env = await ouvrirLApp();
    horsLigne();
    const li = await ouvrirSpot(env, 'Pont de Cé');
    action(li, 'Préparer ma sortie').click();
    await env.stabiliser();
    expect(compact(ligne(env, 'Pont de Cé').querySelector('[role="alert"]')?.textContent)).toBe(compact('Pas de réseau : prépare ta sortie avant de partir'));

    await ouvrirSpot(env, 'Gué de la Sarthe');

    expect(compact(pageSpots(env).textContent)).not.toContain(compact('Pas de réseau'));
    expect(pageSpots(env).querySelector('[role="alert"]')).toBeNull();
    expect(boutonsActions(ligne(env, 'Gué de la Sarthe'))).toHaveLength(2);
    expect(boutonsActions(ligne(env, 'Pont de Cé'))).toHaveLength(0);
  });
});
