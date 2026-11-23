/*
 * US 4 : ajouter un spot privé depuis le formulaire. Maquette de référence : docs/maquettes/us-4-ajouter-un-spot.html.
 * PLAN §2.4, §3, §4 (cache Firestore, synchronisation au retour du réseau), §5 (geo.service.ts), §7 (users/{uid}/spots).
 *
 * CONTRAT DE LA SOURCE (SOURCE_SPOTS, double dans ce fichier ; calqué sur SourceTackleBox) : `SourceSpots` gagne
 *  - `ecouter(uid, surChangement: (documents: DocumentSpot[]) => void, surErreur): () => void` : écoute en continu `users/{uid}/spots`
 *    (onSnapshot avec `includeMetadataChanges`) ; `DocumentSpot` gagne `enAttente?: boolean` (= `hasPendingWrites`). La page l'utilise
 *    pour sa liste et sa carte quand la source la fournit (sinon elle garde `documents(uid)`, comme les specs de la US 3) ;
 *  - `ajouter(uid, data): Promise<void>` : crée le document dans `users/{uid}/spots` SANS attendre l'accusé du serveur (hors ligne il
 *    ne vient pas) ; `data` est exactement { nom, lat, lng, categorie: 1|2, milieu, departement, prive: true }.
 *
 * CONTRAT DU DOM (neutre sur les balises autres que ceux-ci) :
 *  - le bouton « Ajouter un spot » (hors formulaire) ouvre un `[role="dialog"]` plein écran : titre « Ajouter un spot », `button` « Annuler »
 *    et `button` « Enregistrer » ;
 *  - champ texte « Nom » (`input`, libellé par `aria-label`, `label[for]` ou `label` englobant), placeholder « Ex. : Pont de Cé » ;
 *  - deux `[role="radiogroup"]` nommés « Catégorie » et « Type d'eau » (`aria-label` ou `aria-labelledby`), contenant des `[role="radio"]`
 *    (« 1re catégorie », « 2e catégorie » ; « Rivière », « Lac », « Canal ») ; le choix touché porte `aria-checked="true"` ;
 *  - la carte « Position » : `[role="region"][aria-label="Position"]` (Leaflet) DANS le formulaire. Un `click` sur cet élément pose
 *    (ou déplace) un unique marqueur Leaflet (`.leaflet-marker-icon` dans la région) et la région reflète sa position dans
 *    `data-marqueur-lat` / `data-marqueur-lng` (couture de test, comme `data-centre-*` en US 3 ; absents tant qu'aucun marqueur) ;
 *  - tant qu'aucune position n'est posée : « Touche la carte pour placer le spot. » ; ensuite le département sous la carte, dans un
 *    `[role="status"]` : « Département : 49 Maine-et-Loire » (code, puis nom lu dans departements.json) ; hors France (métropole et DOM) :
 *    un `[role="alert"]` « Département introuvable : place le spot en France » ;
 *  - erreurs : un `[role="alert"]` par champ invalide, sous le champ (celui de « Nom » est désigné par son `aria-describedby`) :
 *    « Donne un nom à ton spot », « Choisis la catégorie », « Choisis le type d'eau », « Place le spot sur la carte » ;
 *    rien n'est enregistré et le formulaire reste ouvert ;
 *  - succès : le formulaire se ferme ; le spot est dans la liste « Mes spots » (« Pont de Cé 2e catégorie · Rivière · Maine-et-Loire (49) »)
 *    et sur la carte « Carte des spots » (marqueur de `title` = nom) ; s'il est `enAttente`, la ligne porte
 *    « Pas encore synchronisé : il le sera au retour du réseau. », retirée quand le serveur confirme.
 * Le tap sur la carte : les tests simulent le clic DOM et fixent seulement la coordonnée que Leaflet déduit du clic
 * (L.Map.prototype.layerPointToLatLng), car jsdom n'a pas de géométrie. Aucun appel réseau : tuiles non chargées par jsdom.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import * as L from 'leaflet';
import { Geolocalisation, GEOLOCALISATION } from '../../core/data/position.service';
import { DocumentSpot, SOURCE_SPOTS } from '../../core/data/spots.service';
import { SpotsPage } from './spots.page';

type DocumentSpotAttente = DocumentSpot & { enAttente?: boolean };

const ETANG: DocumentSpotAttente = {
  id: 's1',
  data: { nom: 'Étang du moulin', lat: 47.5, lng: -0.9, categorie: 2, milieu: 'lac', departement: '49', prive: true },
};
const PONT_DE_CE = { lat: 47.43, lng: -0.52 }; // Maine-et-Loire (49)
const NANTES = { lat: 47.22, lng: -1.55 }; // Loire-Atlantique (44)
const MADRID = { lat: 40.4, lng: -3.7 }; // Espagne
const SAINT_DENIS = { lat: -21.1, lng: 55.5 }; // La Réunion (974)

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');
const texte = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const attendre = () => new Promise<void>((r) => setTimeout(r));

async function ouvrir({ initiaux = [ETANG], horsLigne = false }: { initiaux?: DocumentSpotAttente[]; horsLigne?: boolean } = {}) {
  const ecritures: { uid: string; data: Record<string, unknown> }[] = [];
  let docs = [...initiaux];
  let rappel: ((d: DocumentSpotAttente[]) => void) | null = null;
  const geolocalisation: Geolocalisation = {
    checkPermissions: async () => ({ location: 'denied' }),
    requestPermissions: async () => ({ location: 'denied' }),
    getCurrentPosition: async () => {
      throw Object.assign(new Error('refusée'), { code: 1 });
    },
  };
  const source = {
    uid: async () => 'A',
    documents: async () => [...docs],
    ecouter: (_uid: string, ok: (d: DocumentSpotAttente[]) => void) => {
      rappel = ok;
      ok([...docs]);
      return () => undefined;
    },
    ajouter: async (uid: string, data: Record<string, unknown>) => {
      ecritures.push({ uid, data });
      docs = [...docs, { id: `n${docs.length}`, data, enAttente: horsLigne }];
      rappel?.([...docs]);
    },
  };
  await TestBed.configureTestingModule({
    imports: [SpotsPage],
    providers: [provideIonicAngular(), { provide: GEOLOCALISATION, useValue: geolocalisation }, { provide: SOURCE_SPOTS, useValue: source }],
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
  return {
    page: fixture.nativeElement as HTMLElement,
    stabiliser,
    ecritures,
    synchroniser: () => {
      docs = docs.map((d) => ({ ...d, enAttente: false }));
      rappel?.([...docs]);
    },
  };
}
type Env = Awaited<ReturnType<typeof ouvrir>>;

const boutons = (racine: ParentNode) => [...racine.querySelectorAll<HTMLElement>('button, ion-button')];
const bouton = (racine: ParentNode, libelle: string) => boutons(racine).find((b) => compact(b.textContent) === compact(libelle));
const dialogue = (page: HTMLElement) => page.querySelector<HTMLElement>('[role="dialog"]');
const formulaire = (page: HTMLElement): HTMLElement => {
  const d = dialogue(page);
  if (!d) throw new Error('Le formulaire ([role="dialog"]) n\'est pas ouvert');
  return d;
};
const carteSpots = (page: HTMLElement) => page.querySelector<HTMLElement>('[role="region"][aria-label="Carte des spots"]');
const carteSpotsMarqueurs = (page: HTMLElement) => [...(carteSpots(page)?.querySelectorAll('.leaflet-marker-icon') ?? [])].map((m) => m.getAttribute('title'));
const lignes = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('ul li')].map(texte);
const alertes = (page: HTMLElement) => [...formulaire(page).querySelectorAll('[role="alert"]')].map(texte);
const statut = (page: HTMLElement) => texte(formulaire(page).querySelector('[role="status"]'));
const regionPosition = (page: HTMLElement) => formulaire(page).querySelector<HTMLElement>('[role="region"][aria-label="Position"]');

async function ouvrirFormulaire(env: Env): Promise<void> {
  const b = boutons(env.page).find((x) => !x.closest('[role="dialog"]') && compact(x.textContent) === compact('Ajouter un spot'));
  if (!b) throw new Error('Aucun bouton « Ajouter un spot » hors du formulaire');
  b.click();
  await env.stabiliser();
  await vi.waitFor(() => expect(dialogue(env.page)).not.toBeNull(), { timeout: 2000 });
}

function champNom(page: HTMLElement): HTMLInputElement {
  const f = formulaire(page);
  const trouve = [...f.querySelectorAll<HTMLInputElement>('input')].find((c) => {
    const parLabel = c.id ? f.querySelector(`label[for="${c.id}"]`) : null;
    return compact(c.getAttribute('aria-label') ?? parLabel?.textContent ?? c.closest('label')?.textContent).startsWith('Nom');
  });
  if (!trouve) throw new Error('Aucun champ « Nom » dans le formulaire');
  return trouve;
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

function saisirNom(page: HTMLElement, valeur: string): void {
  const c = champNom(page);
  c.value = valeur;
  c.dispatchEvent(new Event('input', { bubbles: true }));
  c.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Un toucher sur la carte « Position » à la coordonnée donnée. */
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
}

interface Saisie {
  nom?: string;
  categorie?: string;
  milieu?: string;
  lieu?: { lat: number; lng: number };
}
async function remplir(env: Env, { nom, categorie, milieu, lieu }: Saisie): Promise<void> {
  if (nom !== undefined) saisirNom(env.page, nom);
  if (categorie) radio(env.page, 'Catégorie', categorie).click();
  if (milieu) radio(env.page, 'Type d\'eau', milieu).click();
  await env.stabiliser();
  if (lieu) await toucher(env, lieu);
}
const COMPLET: Saisie = { nom: 'Pont de Cé', categorie: '2e catégorie', milieu: 'Rivière', lieu: PONT_DE_CE };

async function enregistrer(env: Env): Promise<void> {
  const b = bouton(formulaire(env.page), 'Enregistrer');
  if (!b) throw new Error('Aucun bouton « Enregistrer »');
  b.click();
  await env.stabiliser();
}

describe('SpotsPage : formulaire d\'ajout d\'un spot privé (US 4)', () => {
  it('critère 1 : given l\'onglet « Spots » ouvert, when l\'utilisateur touche « Ajouter un spot », then un formulaire s\'ouvre avec Nom, Catégorie, Type d\'eau, la carte Position et Enregistrer', async () => {
    const env = await ouvrir();
    expect(dialogue(env.page)).toBeNull();

    await ouvrirFormulaire(env);

    const f = formulaire(env.page);
    expect(texte(f)).toContain('Ajouter un spot');
    expect(champNom(env.page).placeholder).toBe('Ex. : Pont de Cé');
    expect([...groupe(env.page, 'Catégorie').querySelectorAll('[role="radio"]')].map(texte)).toEqual(['1re catégorie', '2e catégorie']);
    expect([...groupe(env.page, 'Type d\'eau').querySelectorAll('[role="radio"]')].map(texte)).toEqual(['Rivière', 'Lac', 'Canal']);
    expect(regionPosition(env.page)).not.toBeNull();
    expect(texte(f)).toContain('Touche la carte pour placer le spot.');
    expect(bouton(f, 'Enregistrer')).toBeDefined();
    expect(bouton(f, 'Annuler')).toBeDefined();
  });

  it('critère 2 : given le formulaire ouvert, when l\'utilisateur touche la carte Position, then un marqueur est posé à cet endroit et « Département : 49 Maine-et-Loire » s\'affiche sous la carte', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);

    await toucher(env, PONT_DE_CE);

    const region = regionPosition(env.page)!;
    expect(region.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1);
    expect(Number(region.dataset['marqueurLat'])).toBeCloseTo(PONT_DE_CE.lat, 5);
    expect(Number(region.dataset['marqueurLng'])).toBeCloseTo(PONT_DE_CE.lng, 5);
    expect(statut(env.page)).toBe('Département : 49 Maine-et-Loire');
  });

  it('critère 2 : given le formulaire ouvert, when l\'utilisateur touche la carte à La Réunion (DOM), then le département détecté est « Département : 974 La Réunion »', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);

    await toucher(env, SAINT_DENIS);

    expect(statut(env.page)).toBe('Département : 974 La Réunion');
    expect(alertes(env.page)).not.toContain('Département introuvable : place le spot en France');
  });

  it('critère 3 : given un marqueur déjà posé, when l\'utilisateur touche un autre endroit, then le marqueur se déplace et le département est mis à jour', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    await toucher(env, PONT_DE_CE);

    await toucher(env, NANTES);

    const region = regionPosition(env.page)!;
    expect(region.querySelectorAll('.leaflet-marker-icon')).toHaveLength(1);
    expect(Number(region.dataset['marqueurLat'])).toBeCloseTo(NANTES.lat, 5);
    expect(Number(region.dataset['marqueurLng'])).toBeCloseTo(NANTES.lng, 5);
    expect(statut(env.page)).toBe('Département : 44 Loire-Atlantique');
  });

  it('critère 4 : given une position hors de France, when le département est détecté, then « Département introuvable : place le spot en France » s\'affiche et « Enregistrer » refuse l\'enregistrement', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    await remplir(env, { ...COMPLET, lieu: MADRID });

    expect(alertes(env.page)).toContain('Département introuvable : place le spot en France');

    await enregistrer(env);

    expect(env.ecritures).toEqual([]);
    expect(dialogue(env.page)).not.toBeNull();
    expect(alertes(env.page)).toContain('Département introuvable : place le spot en France');
    expect(lignes(env.page)).toHaveLength(1);
  });

  it('critère 5 : given le formulaire rempli (Pont de Cé, 2e catégorie, Rivière, une position), when l\'utilisateur touche « Enregistrer », then le spot apparaît dans la liste et sur la carte, enregistré privé avec ses champs', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    await remplir(env, COMPLET);

    await enregistrer(env);

    expect(env.ecritures).toEqual([
      { uid: 'A', data: { nom: 'Pont de Cé', lat: PONT_DE_CE.lat, lng: PONT_DE_CE.lng, categorie: 2, milieu: 'riviere', departement: '49', prive: true } },
    ]);
    expect(dialogue(env.page)).toBeNull();
    expect(lignes(env.page)).toEqual(['Étang du moulin 2e catégorie · Lac · Maine-et-Loire (49)', 'Pont de Cé 2e catégorie · Rivière · Maine-et-Loire (49)']);
    await vi.waitFor(() => expect(carteSpotsMarqueurs(env.page).sort()).toEqual(['Pont de Cé', 'Étang du moulin']), { timeout: 2000 });
  });

  it('critère 5 : given un spot en 1re catégorie sur un lac, when l\'utilisateur l\'enregistre, then le document porte la catégorie 1 et le milieu lac', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    await remplir(env, { nom: 'Étang bleu', categorie: '1re catégorie', milieu: 'Lac', lieu: NANTES });

    await enregistrer(env);

    expect(env.ecritures.map((e) => e.data)).toEqual([
      { nom: 'Étang bleu', lat: NANTES.lat, lng: NANTES.lng, categorie: 1, milieu: 'lac', departement: '44', prive: true },
    ]);
  });

  it('critère 6 : given le champ Nom vide, when l\'utilisateur touche « Enregistrer », then rien n\'est enregistré et « Donne un nom à ton spot » s\'affiche sous le champ', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    await remplir(env, { ...COMPLET, nom: undefined });

    await enregistrer(env);

    expect(env.ecritures).toEqual([]);
    expect(dialogue(env.page)).not.toBeNull();
    const champ = champNom(env.page);
    const id = champ.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    const erreur = formulaire(env.page).querySelector(`#${CSS.escape(id!)}`);
    expect(erreur?.getAttribute('role')).toBe('alert');
    expect(texte(erreur)).toBe('Donne un nom à ton spot');
  });

  it('critère 6 : given un nom fait d\'espaces, when l\'utilisateur touche « Enregistrer », then rien n\'est enregistré et « Donne un nom à ton spot » s\'affiche', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    await remplir(env, { ...COMPLET, nom: '   ' });

    await enregistrer(env);

    expect(env.ecritures).toEqual([]);
    expect(alertes(env.page)).toContain('Donne un nom à ton spot');
  });

  it.each([
    { champ: 'la catégorie', saisie: { ...COMPLET, categorie: undefined }, message: 'Choisis la catégorie' },
    { champ: 'le type d\'eau', saisie: { ...COMPLET, milieu: undefined }, message: 'Choisis le type d\'eau' },
    { champ: 'la position', saisie: { ...COMPLET, lieu: undefined }, message: 'Place le spot sur la carte' },
  ] as { champ: string; saisie: Saisie; message: string }[])('critère 7 : given $champ non choisi(e), when l\'utilisateur touche « Enregistrer », then rien n\'est enregistré et « $message » s\'affiche', async ({ saisie, message }) => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    await remplir(env, saisie);

    await enregistrer(env);

    expect(env.ecritures).toEqual([]);
    expect(dialogue(env.page)).not.toBeNull();
    expect(alertes(env.page)).toEqual([message]);
  });

  it('critère 7 : given ni catégorie, ni type d\'eau, ni position, when l\'utilisateur touche « Enregistrer », then les trois messages s\'affichent et rien n\'est enregistré', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    await remplir(env, { nom: 'Pont de Cé' });

    await enregistrer(env);

    expect(env.ecritures).toEqual([]);
    expect(alertes(env.page)).toEqual(['Choisis la catégorie', 'Choisis le type d\'eau', 'Place le spot sur la carte']);
  });

  it('critère 8 : given le formulaire ouvert et rempli, when l\'utilisateur touche « Annuler », then le formulaire se ferme et aucun spot n\'est ajouté', async () => {
    const env = await ouvrir();
    await ouvrirFormulaire(env);
    await remplir(env, COMPLET);

    bouton(formulaire(env.page), 'Annuler')!.click();
    await env.stabiliser();

    expect(dialogue(env.page)).toBeNull();
    expect(env.ecritures).toEqual([]);
    expect(lignes(env.page)).toEqual(['Étang du moulin 2e catégorie · Lac · Maine-et-Loire (49)']);
    expect(carteSpotsMarqueurs(env.page)).toEqual(['Étang du moulin']);
  });

  it('critère 9 : given l\'appareil sans réseau, when l\'utilisateur enregistre un spot valide, then il apparaît aussitôt avec « Pas encore synchronisé : il le sera au retour du réseau. », mention retirée au retour du réseau sans nouvelle action', async () => {
    const mention = compact('Pas encore synchronisé : il le sera au retour du réseau.');
    const env = await ouvrir({ horsLigne: true });
    await ouvrirFormulaire(env);
    await remplir(env, COMPLET);

    await enregistrer(env);

    expect(dialogue(env.page)).toBeNull();
    const ligne = [...env.page.querySelectorAll('ul li')].find((l) => texte(l).startsWith('Pont de Cé'));
    expect(ligne).toBeDefined();
    expect(compact(ligne!.textContent)).toContain(mention);
    const autre = [...env.page.querySelectorAll('ul li')].find((l) => texte(l).startsWith('Étang'));
    expect(compact(autre!.textContent)).not.toContain(mention);

    env.synchroniser();
    await env.stabiliser();

    expect(compact(env.page.textContent)).not.toContain(mention);
    expect(lignes(env.page)).toHaveLength(2);
    expect(env.ecritures).toHaveLength(1);
  });
});
