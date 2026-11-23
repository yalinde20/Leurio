/*
 * US 3 : onglet « Spots », carte et liste de mes spots. Maquette de référence : docs/maquettes/us-3-onglet-spots.html.
 * Critères 1 à 5 et 7 ici (Vitest, jsdom, doubles) ; critère 6 (couleurs du thème) dans e2e/spots-carte.spec.ts.
 *
 * Contrat que l'implémentation doit fournir (le reste du DOM est libre) :
 *  - la carte est un `[role="region"][aria-label="Carte des spots"]` (Leaflet + tuiles OpenStreetMap) ; elle porte l'attribution
 *    « © contributeurs OpenStreetMap » dans un `.leaflet-control-attribution` ;
 *  - un marqueur par spot : un `.leaflet-marker-icon` dont l'attribut `title` est le nom du spot (option `title` de L.marker) ;
 *  - LA COUTURE POUR LE CENTRAGE : la région de la carte reflète l'état de la carte Leaflet dans trois attributs, remis à jour après
 *    chaque déplacement (événement `moveend`, et une première fois à l'initialisation) : `data-centre-lat`, `data-centre-lng`
 *    (centre, degrés décimaux) et `data-zoom` (niveau de zoom). Les tests ne lisent jamais Leaflet lui-même ;
 *  - la liste « Mes spots » : un titre « Mes spots », puis `ul > li > button` par spot, triés par ordre alphabétique, dont le texte contient
 *    le nom puis « 2e catégorie · Lac · Maine-et-Loire (49) » (catégorie · type d'eau en capitale initiale · nom du département (49)) ;
 *  - sans spot : le texte « Aucun spot pour l'instant » et un `button` « Ajouter un spot » ;
 *  - un tap sur une ligne centre la carte sur le marqueur de ce spot (`data-centre-*` égaux à lat/lng du spot).
 * Doubles : SOURCE_SPOTS (Firestore) et GEOLOCALISATION (GPS). Aucun appel réseau : jsdom ne charge pas les tuiles.
 * `milieu` est lu par SpotsService (PLAN §7) : 'riviere' | 'lac' | 'canal'.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { Geolocalisation, GEOLOCALISATION } from '../../core/data/position.service';
import { DocumentSpot, SOURCE_SPOTS } from '../../core/data/spots.service';
import { SpotsPage } from './spots.page';

const doc = (id: string, nom: string, lat: number, lng: number, categorie: 1 | 2, milieu: string, departement: string): DocumentSpot => ({
  id,
  data: { nom, lat, lng, categorie, milieu, departement, prive: true },
});
const ETANG = doc('s1', 'Étang du moulin', 47.5, -0.9, 2, 'lac', '49');
const SEVRE = doc('s2', 'La Sèvre à Clisson', 47.09, -1.28, 1, 'riviere', '44');
const CANAL_B = doc('b1', 'Canal de Nantes à Brest', 47.7, -1.8, 2, 'canal', '44');
const ROCHE_B = doc('b2', 'Roche secrète', 45.1, 5.7, 1, 'riviere', '38');

const GPS_ANGERS = { latitude: 47.47, longitude: -0.55 };

interface Reglages {
  uid?: string | null;
  /** Documents par utilisateur : la source ne rend que ceux de l'uid demandé, comme Firestore. */
  parUid?: Record<string, DocumentSpot[]>;
  gps?: 'autorise' | 'refuse';
  documents?: (uid: string) => Promise<DocumentSpot[]>;
}

async function ouvrir({ uid = 'A', parUid = {}, gps = 'refuse', documents }: Reglages = {}) {
  const lectures: string[] = [];
  const geolocalisation: Geolocalisation = {
    checkPermissions: async () => ({ location: gps === 'autorise' ? 'granted' : 'denied' }),
    requestPermissions: async () => ({ location: gps === 'autorise' ? 'granted' : 'denied' }),
    getCurrentPosition: async () => {
      if (gps !== 'autorise') throw Object.assign(new Error('refusée'), { code: 1 });
      return { coords: { ...GPS_ANGERS, accuracy: 10 } };
    },
  };
  await TestBed.configureTestingModule({
    imports: [SpotsPage],
    providers: [
      provideIonicAngular(),
      { provide: GEOLOCALISATION, useValue: geolocalisation },
      {
        provide: SOURCE_SPOTS,
        useValue: {
          uid: async () => uid,
          documents:
            documents ??
            (async (u: string) => {
              lectures.push(u);
              return parUid[u] ?? [];
            }),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SpotsPage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return { page: fixture.nativeElement as HTMLElement, lectures, fixture };
}

const carte = (page: HTMLElement) => page.querySelector<HTMLElement>('[role="region"][aria-label="Carte des spots"]');
const marqueurs = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('.leaflet-marker-icon')];
const lignes = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('ul li button')];
const centre = (page: HTMLElement) => {
  const c = carte(page);
  return { lat: Number(c?.dataset['centreLat']), lng: Number(c?.dataset['centreLng']), zoom: Number(c?.dataset['zoom']) };
};
const texte = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const attendre = (verifie: () => void) => vi.waitFor(verifie, { timeout: 2000 });

describe('SpotsPage : carte et liste de mes spots (US 3)', () => {
  it('critère 1 : given un utilisateur qui a deux spots enregistrés, when il ouvre l\'onglet « Spots », then une carte OpenStreetMap affiche un marqueur par spot', async () => {
    const { page } = await ouvrir({ parUid: { A: [SEVRE, ETANG] } });

    await attendre(() => expect(marqueurs(page)).toHaveLength(2));
    expect(carte(page)).not.toBeNull();
    expect(marqueurs(page).map((m) => m.getAttribute('title')).sort()).toEqual(['La Sèvre à Clisson', 'Étang du moulin']);
    expect(page.querySelector('.leaflet-control-attribution')?.textContent).toContain('© contributeurs OpenStreetMap');
  });

  it('critère 1 : given un utilisateur qui a deux spots enregistrés, when il ouvre l\'onglet « Spots », then la liste sous la carte affiche le nom, la catégorie, le type d\'eau et le département de chaque spot', async () => {
    const { page } = await ouvrir({ parUid: { A: [SEVRE, ETANG] } });

    await attendre(() => expect(lignes(page)).toHaveLength(2));
    // Ordre alphabétique : « Étang du moulin » (É range avec E) avant « La Sèvre à Clisson ».
    expect(texte(page.querySelector('ion-content')!)).toContain('Mes spots');
    expect(lignes(page).map(texte)).toEqual([
      'Étang du moulin 2e catégorie · Lac · Maine-et-Loire (49)',
      'La Sèvre à Clisson 1re catégorie · Rivière · Loire-Atlantique (44)',
    ]);
    // La liste est sous la carte.
    const c = carte(page)!;
    expect(c.compareDocumentPosition(lignes(page)[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('critère 1 : given un spot de type canal, when il ouvre l\'onglet « Spots », then la liste écrit « Canal »', async () => {
    const { page } = await ouvrir({ parUid: { A: [doc('c1', 'Canal du Midi', 43.6, 1.5, 2, 'canal', '31')] } });

    await attendre(() => expect(lignes(page)).toHaveLength(1));
    expect(texte(lignes(page)[0])).toContain('2e catégorie · Canal · Haute-Garonne (31)');
  });

  it('critère 2 : given un utilisateur sans aucun spot, when il ouvre l\'onglet « Spots », then la carte s\'affiche et la liste montre « Aucun spot pour l\'instant » avec le bouton « Ajouter un spot »', async () => {
    const { page } = await ouvrir({ parUid: { A: [] } });

    await attendre(() => expect(texte(page)).toContain('Aucun spot pour l\'instant'));
    expect(carte(page)).not.toBeNull();
    expect(marqueurs(page)).toHaveLength(0);
    expect(page.querySelector('ul li button')).toBeNull();
    const ajouter = [...page.querySelectorAll('button')].find((b) => texte(b) === 'Ajouter un spot');
    expect(ajouter).toBeDefined();
  });

  it('critère 2 : given la lecture des spots en cours puis en échec, when il ouvre l\'onglet « Spots », then la liste dit « Chargement des spots… » puis « Tes spots ne sont pas disponibles pour le moment. » et la carte reste affichée', async () => {
    let echouer!: (e: Error) => void;
    const { page, fixture } = await ouvrir({
      documents: () => new Promise<DocumentSpot[]>((_, rejette) => (echouer = rejette)),
    });
    expect(texte(page)).toContain('Chargement des spots…');
    expect(carte(page)).not.toBeNull();

    echouer(new Error('hors service'));
    await fixture.whenStable();
    await attendre(() => expect(texte(page)).toContain('Tes spots ne sont pas disponibles pour le moment.'));
    expect(carte(page)).not.toBeNull();
  });

  it('critère 3 : given l\'onglet « Spots » ouvert, when l\'utilisateur touche un spot de la liste, then la carte se centre sur le marqueur de ce spot', async () => {
    const { page } = await ouvrir({ parUid: { A: [SEVRE, ETANG] } });
    await attendre(() => expect(lignes(page)).toHaveLength(2));

    lignes(page).find((l) => texte(l).startsWith('La Sèvre'))!.click();
    await attendre(() => {
      expect(centre(page).lat).toBeCloseTo(47.09, 3);
      expect(centre(page).lng).toBeCloseTo(-1.28, 3);
    });

    lignes(page).find((l) => texte(l).startsWith('Étang'))!.click();
    await attendre(() => {
      expect(centre(page).lat).toBeCloseTo(47.5, 3);
      expect(centre(page).lng).toBeCloseTo(-0.9, 3);
    });
  });

  it('critère 4 : given l\'utilisateur a autorisé la géolocalisation, when il ouvre l\'onglet « Spots » sans spot enregistré, then la carte est centrée sur sa position', async () => {
    const { page } = await ouvrir({ gps: 'autorise', parUid: { A: [] } });

    await attendre(() => {
      expect(centre(page).lat).toBeCloseTo(GPS_ANGERS.latitude, 3);
      expect(centre(page).lng).toBeCloseTo(GPS_ANGERS.longitude, 3);
    });
    expect(centre(page).zoom).toBeGreaterThanOrEqual(10); // échelle d'une commune, pas d'un pays
  });

  it('critère 5 : given l\'utilisateur a refusé la géolocalisation et n\'a aucun spot, when il ouvre l\'onglet « Spots », then la carte montre la France entière', async () => {
    const { page } = await ouvrir({ gps: 'refuse', parUid: { A: [] } });

    await attendre(() => expect(texte(page)).toContain('Aucun spot pour l\'instant'));
    const { lat, lng, zoom } = centre(page);
    // Centre quelque part au milieu de la France métropolitaine (Corse comprise) et zoom d'un pays entier.
    expect(lat).toBeGreaterThan(42);
    expect(lat).toBeLessThan(50);
    expect(lng).toBeGreaterThan(-2);
    expect(lng).toBeLessThan(6);
    expect(zoom).toBeLessThanOrEqual(6);
    expect(zoom).toBeGreaterThanOrEqual(4);
  });

  it('critère 7 : given des spots appartenant à un autre utilisateur, when l\'utilisateur ouvre l\'onglet « Spots », then aucun de ces spots n\'apparaît, ni sur la carte ni dans la liste', async () => {
    const { page, lectures } = await ouvrir({ uid: 'A', parUid: { A: [ETANG], B: [CANAL_B, ROCHE_B] } });

    await attendre(() => expect(lignes(page)).toHaveLength(1));
    expect(lectures).toEqual(['A']);
    expect(lignes(page).map((l) => texte(l))).toEqual(['Étang du moulin 2e catégorie · Lac · Maine-et-Loire (49)']);
    expect(marqueurs(page).map((m) => m.getAttribute('title'))).toEqual(['Étang du moulin']);
    expect(texte(page)).not.toContain('Canal de Nantes à Brest');
    expect(texte(page)).not.toContain('Roche secrète');
  });
});
