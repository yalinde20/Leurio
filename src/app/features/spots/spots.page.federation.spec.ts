/*
 * US 5 : lien vers la fédération du département pour trouver la catégorie. Maquette de référence : docs/maquettes/us-5-lien-federation.html.
 * PLAN §2.4, §5 (federations.json : département → URL fédération), §6.
 *
 * La table vient du contenu (CatalogService.federation / urlFederation), jamais du code : le double de CatalogService de ce fichier
 * ne connaît que le 49 et le 44 ; le 33 est absent de la table. Aucun appel réseau (tuiles non chargées par jsdom).
 *
 * CONTRAT DU DOM (neutre sur les balises autres que ceux-ci) :
 *  - formulaire : un lien (`a[href]`) « Trouver la catégorie sur le site de la fédération » DANS le groupe « Catégorie », donc après le
 *    `[role="radiogroup"]` « Catégorie » et avant celui de « Type d'eau » ; `target="_blank"`, `rel` contenant `noopener` ;
 *  - département absent de la table : pas de lien, et le texte « Pas de lien pour ce département : cherche ta fédération départementale de pêche » ;
 *  - hors de France : l'erreur de la US 4, ni lien ni ce texte ;
 *  - liste « Mes spots » : toucher la ligne d'un spot (bouton) déploie le lien « Site de la fédération » (`target="_blank"`, `rel` avec `noopener`),
 *    hors du bouton ; un seul spot ouvert à la fois ; département absent de la table : pas de lien.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import * as L from 'leaflet';
import { CatalogService } from '../../core/data/catalog.service';
import { Geolocalisation, GEOLOCALISATION } from '../../core/data/position.service';
import { DocumentSpot, SOURCE_SPOTS } from '../../core/data/spots.service';
import { SpotsPage } from './spots.page';

const URL_49 = 'https://federation-49.example.test/';
const URL_44 = 'https://federation-44.example.test/';
const TABLE: Record<string, { departement: string; nom: string; url: string }> = {
  '49': { departement: '49', nom: 'Fédération 49', url: URL_49 },
  '44': { departement: '44', nom: 'Fédération 44', url: URL_44 },
};

const SPOT_49: DocumentSpot = { id: 's1', data: { nom: 'Étang du moulin', lat: 47.5, lng: -0.9, categorie: 2, milieu: 'lac', departement: '49', prive: true } };
const SPOT_44: DocumentSpot = { id: 's2', data: { nom: 'Erdre amont', lat: 47.3, lng: -1.5, categorie: 1, milieu: 'riviere', departement: '44', prive: true } };
const SPOT_33: DocumentSpot = { id: 's3', data: { nom: 'Bassin de Bordeaux', lat: 44.8, lng: -0.6, categorie: 2, milieu: 'lac', departement: '33', prive: true } };

const PONT_DE_CE = { lat: 47.43, lng: -0.52 }; // Maine-et-Loire (49)
const NANTES = { lat: 47.22, lng: -1.55 }; // Loire-Atlantique (44)
const BORDEAUX = { lat: 44.84, lng: -0.58 }; // Gironde (33), absente de la table
const MADRID = { lat: 40.4, lng: -3.7 }; // hors de France

const LIBELLE_FORMULAIRE = 'Trouver la catégorie sur le site de la fédération';
const LIBELLE_LISTE = 'Site de la fédération';
const SANS_LIEN = 'Pas de lien pour ce département : cherche ta fédération départementale de pêche';

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s     ]/g, '');
const texte = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const attendre = () => new Promise<void>((r) => setTimeout(r));

async function ouvrir({ initiaux = [] }: { initiaux?: DocumentSpot[] } = {}) {
  const geolocalisation: Geolocalisation = {
    checkPermissions: async () => ({ location: 'denied' }),
    requestPermissions: async () => ({ location: 'denied' }),
    getCurrentPosition: async () => {
      throw Object.assign(new Error('refusée'), { code: 1 });
    },
  };
  const source = {
    uid: async () => 'A',
    documents: async () => [...initiaux],
    ecouter: (_uid: string, ok: (d: DocumentSpot[]) => void) => {
      ok([...initiaux]);
      return () => undefined;
    },
    ajouter: async () => undefined,
  };
  const catalogue = {
    federation: async (d: string) => TABLE[d],
    urlFederation: async (d: string) => TABLE[d]?.url,
  };
  await TestBed.configureTestingModule({
    imports: [SpotsPage],
    providers: [
      provideIonicAngular(),
      { provide: GEOLOCALISATION, useValue: geolocalisation },
      { provide: SOURCE_SPOTS, useValue: source },
      { provide: CatalogService, useValue: catalogue },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SpotsPage);
  const stabiliser = async () => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      await attendre();
    }
  };
  fixture.autoDetectChanges();
  await stabiliser();
  return { page: fixture.nativeElement as HTMLElement, stabiliser };
}
type Env = Awaited<ReturnType<typeof ouvrir>>;

const boutons = (racine: ParentNode) => [...racine.querySelectorAll<HTMLElement>('button, ion-button')];
const dialogue = (page: HTMLElement) => page.querySelector<HTMLElement>('[role="dialog"]');
const formulaire = (page: HTMLElement): HTMLElement => {
  const d = dialogue(page);
  if (!d) throw new Error('Le formulaire ([role="dialog"]) n\'est pas ouvert');
  return d;
};
const regionPosition = (page: HTMLElement) => formulaire(page).querySelector<HTMLElement>('[role="region"][aria-label="Position"]');

async function ouvrirFormulaire(env: Env): Promise<void> {
  const b = boutons(env.page).find((x) => !x.closest('[role="dialog"]') && compact(x.textContent) === compact('Ajouter un spot'));
  if (!b) throw new Error('Aucun bouton « Ajouter un spot » hors du formulaire');
  b.click();
  await env.stabiliser();
  await vi.waitFor(() => expect(dialogue(env.page)).not.toBeNull(), { timeout: 2000 });
}

function groupe(page: HTMLElement, nom: string): HTMLElement {
  const f = formulaire(page);
  const trouve = [...f.querySelectorAll<HTMLElement>('[role="radiogroup"]')].find((g) => {
    const ref = g.getAttribute('aria-labelledby');
    const libelle = g.getAttribute('aria-label') ?? (ref ? texte(f.querySelector(`#${CSS.escape(ref)}`)) : '');
    return compact(libelle) === compact(nom);
  });
  if (!trouve) throw new Error(`Aucun [role="radiogroup"] nommé « ${nom} »`);
  return trouve;
}
const radio = (page: HTMLElement, nomGroupe: string, choix: string) => {
  const r = [...groupe(page, nomGroupe).querySelectorAll<HTMLElement>('[role="radio"]')].find((x) => compact(x.textContent) === compact(choix));
  if (!r) throw new Error(`Aucun choix « ${choix} » dans « ${nomGroupe} »`);
  return r;
};
const champNom = (page: HTMLElement) => formulaire(page).querySelector<HTMLInputElement>('input[type="text"]')!;

async function toucher(env: Env, lieu: { lat: number; lng: number }): Promise<void> {
  const region = regionPosition(env.page);
  if (!region) throw new Error('Aucune carte « Position » dans le formulaire');
  const espion = vi.spyOn(L.Map.prototype, 'layerPointToLatLng').mockReturnValue(L.latLng(lieu.lat, lieu.lng));
  try {
    region.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
  } finally {
    espion.mockRestore();
  }
  await env.stabiliser();
  // Le département est cherché dans le contenu (asynchrone) : on laisse la résolution se faire.
  await attendre();
  await env.stabiliser();
}

/** Les liens dont le nom accessible contient le libellé. */
const liens = (racine: ParentNode, libelle: string) => [...racine.querySelectorAll<HTMLAnchorElement>('a')].filter((a) => compact(a.textContent).includes(compact(libelle)));
const lienFormulaire = (page: HTMLElement) => liens(formulaire(page), LIBELLE_FORMULAIRE)[0];

describe('SpotsPage : lien vers la fédération du département (US 5)', () => {
  // Date du jour fixée en saison : hors saison, un spot de 1re catégorie porte le bandeau « Fermé » de l'US 6 et son propre lien
  // (décision du propriétaire, US 6). Ce spec ne dépend plus de la date réelle.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 20, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('critère 1 : given le formulaire avec une position en Maine-et-Loire (49, dans la table), when le département est détecté, then « Trouver la catégorie sur le site de la fédération » s\'affiche dans le groupe Catégorie et pointe vers l\'URL de la fédération du 49', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);

    await toucher(env, PONT_DE_CE);

    await vi.waitFor(() => expect(lienFormulaire(env.page)).toBeDefined(), { timeout: 2000 });
    const lien = lienFormulaire(env.page);
    expect(lien.getAttribute('href')).toBe(URL_49);
    const categorie = groupe(env.page, 'Catégorie');
    const milieu = groupe(env.page, 'Type d\'eau');
    expect(categorie.compareDocumentPosition(lien) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(milieu.compareDocumentPosition(lien) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(texte(formulaire(env.page))).not.toContain(SANS_LIEN);
  });

  it('critère 1 : given le lien affiché pour le 49, when le repère est déplacé en Loire-Atlantique (44), then le lien pointe vers la fédération du 44', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    await toucher(env, PONT_DE_CE);
    await vi.waitFor(() => expect(lienFormulaire(env.page)?.getAttribute('href')).toBe(URL_49), { timeout: 2000 });

    await toucher(env, NANTES);

    await vi.waitFor(() => expect(lienFormulaire(env.page)?.getAttribute('href')).toBe(URL_44), { timeout: 2000 });
    expect(liens(formulaire(env.page), LIBELLE_FORMULAIRE)).toHaveLength(1);
  });

  it('critère 2 : given le lien affiché, when l\'utilisateur le touche, then il s\'ouvre hors de l\'app (target _blank, rel noopener) et le formulaire garde sa saisie', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    const nom = champNom(env.page);
    nom.value = 'Pont de Cé';
    nom.dispatchEvent(new Event('input', { bubbles: true }));
    nom.dispatchEvent(new Event('change', { bubbles: true }));
    radio(env.page, 'Catégorie', '2e catégorie').click();
    radio(env.page, 'Type d\'eau', 'Rivière').click();
    await env.stabiliser();
    await toucher(env, PONT_DE_CE);
    await vi.waitFor(() => expect(lienFormulaire(env.page)).toBeDefined(), { timeout: 2000 });
    const lien = lienFormulaire(env.page);

    expect(lien.getAttribute('target')).toBe('_blank');
    expect(lien.getAttribute('rel') ?? '').toContain('noopener');
    // jsdom n'implémente pas la navigation : on neutralise l'ouverture et on observe le formulaire après le toucher.
    const neutraliser = (e: Event) => e.preventDefault();
    document.addEventListener('click', neutraliser);
    try {
      lien.click();
      await env.stabiliser();
    } finally {
      document.removeEventListener('click', neutraliser);
    }

    expect(dialogue(env.page)).not.toBeNull();
    expect(champNom(env.page).value).toBe('Pont de Cé');
    expect(radio(env.page, 'Catégorie', '2e catégorie').getAttribute('aria-checked')).toBe('true');
    expect(radio(env.page, 'Type d\'eau', 'Rivière').getAttribute('aria-checked')).toBe('true');
    const region = regionPosition(env.page)!;
    expect(Number(region.dataset['marqueurLat'])).toBeCloseTo(PONT_DE_CE.lat, 5);
    expect(Number(region.dataset['marqueurLng'])).toBeCloseTo(PONT_DE_CE.lng, 5);
    expect(lienFormulaire(env.page)).toBeDefined();
  });

  it('critère 3 : given le formulaire sans position posée, when l\'utilisateur regarde le champ Catégorie, then aucun lien vers la fédération n\'est affiché (il n\'apparaît qu\'une fois la position posée)', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);

    expect(liens(formulaire(env.page), LIBELLE_FORMULAIRE)).toHaveLength(0);
    expect(texte(formulaire(env.page))).not.toContain(LIBELLE_FORMULAIRE);
    expect(texte(formulaire(env.page))).not.toContain(SANS_LIEN);

    // Contrôle de la cause : le même formulaire, une fois la position posée, montre le lien.
    await toucher(env, PONT_DE_CE);
    await vi.waitFor(() => expect(lienFormulaire(env.page)).toBeDefined(), { timeout: 2000 });
  });

  it('critère 4 : given un département détecté absent de la table (33), when le département est détecté, then aucun lien n\'est affiché et « Pas de lien pour ce département : cherche ta fédération départementale de pêche » apparaît', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);

    await toucher(env, BORDEAUX);

    await vi.waitFor(() => expect(texte(formulaire(env.page))).toContain(SANS_LIEN), { timeout: 2000 });
    expect(liens(formulaire(env.page), LIBELLE_FORMULAIRE)).toHaveLength(0);
    expect(texte(formulaire(env.page))).toContain('Département : 33');
  });

  it('critère 4 : given une position hors de France, when le département est détecté, then l\'erreur de la US 4 reste seule : ni lien ni « Pas de lien pour ce département »', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    // Contrôle de la cause : une position en France dans la table montre bien le lien.
    await toucher(env, PONT_DE_CE);
    await vi.waitFor(() => expect(lienFormulaire(env.page)).toBeDefined(), { timeout: 2000 });

    await toucher(env, MADRID);

    await vi.waitFor(() => expect(liens(formulaire(env.page), LIBELLE_FORMULAIRE)).toHaveLength(0), { timeout: 2000 });
    expect(texte(formulaire(env.page))).toContain('Département introuvable : place le spot en France');
    expect(texte(formulaire(env.page))).not.toContain(SANS_LIEN);
  });

  it('critère 5 : given un spot du 49 dans la liste « Mes spots », when l\'utilisateur touche sa ligne, then le lien « Site de la fédération » du 49 s\'affiche (target _blank, rel noopener), hors du bouton de la ligne', async () => {
    const env = await ouvrir({ initiaux: [SPOT_49, SPOT_44] });
    expect(liens(env.page, LIBELLE_LISTE)).toHaveLength(0);

    const ligne = boutons(env.page).find((b) => texte(b).startsWith('Étang du moulin'))!;
    expect(ligne).toBeDefined();
    ligne.click();
    await env.stabiliser();

    await vi.waitFor(() => expect(liens(env.page, LIBELLE_LISTE)).toHaveLength(1), { timeout: 2000 });
    const lien = liens(env.page, LIBELLE_LISTE)[0];
    expect(lien.getAttribute('href')).toBe(URL_49);
    expect(lien.getAttribute('target')).toBe('_blank');
    expect(lien.getAttribute('rel') ?? '').toContain('noopener');
    expect(lien.closest('button')).toBeNull();
    expect(ligne.getAttribute('aria-current')).toBe('true');
  });

  it('critère 5 : given un spot du 49 ouvert, when l\'utilisateur touche un spot du 44, then un seul lien reste affiché, celui du 44', async () => {
    const env = await ouvrir({ initiaux: [SPOT_49, SPOT_44] });
    boutons(env.page).find((b) => texte(b).startsWith('Étang du moulin'))!.click();
    await env.stabiliser();
    await vi.waitFor(() => expect(liens(env.page, LIBELLE_LISTE)).toHaveLength(1), { timeout: 2000 });

    boutons(env.page).find((b) => texte(b).startsWith('Erdre amont'))!.click();
    await env.stabiliser();

    await vi.waitFor(() => expect(liens(env.page, LIBELLE_LISTE).map((a) => a.getAttribute('href'))).toEqual([URL_44]), { timeout: 2000 });
  });

  it('critère 5 : given un spot dont le département (33) n\'est pas dans la table, when l\'utilisateur touche sa ligne, then aucun lien « Site de la fédération » n\'est affiché', async () => {
    const env = await ouvrir({ initiaux: [SPOT_49, SPOT_33] });
    // Contrôle de la cause : le spot du 49 montre bien son lien.
    boutons(env.page).find((b) => texte(b).startsWith('Étang du moulin'))!.click();
    await env.stabiliser();
    await vi.waitFor(() => expect(liens(env.page, LIBELLE_LISTE)).toHaveLength(1), { timeout: 2000 });

    boutons(env.page).find((b) => texte(b).startsWith('Bassin de Bordeaux'))!.click();
    await env.stabiliser();
    await attendre();
    await env.stabiliser();

    expect(liens(env.page, LIBELLE_LISTE)).toHaveLength(0);
  });
});
