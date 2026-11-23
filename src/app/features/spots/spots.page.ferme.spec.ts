/*
 * US 6 : bandeau « Fermé » sur un spot de 1re catégorie hors saison. Maquette de référence : docs/maquettes/us-6-bandeau-ferme.html.
 * PLAN §6 (1re catégorie ouverte du 2e samedi de mars au 3e dimanche de septembre inclus ; calcul dans core/regulation/calendar.ts), §3.
 *
 * La date du jour est pilotée par `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime` (comme les specs de conditions) :
 * l'écran lit la date courante, le calcul est fait par core/regulation, pas par l'écran.
 *
 * CONTRAT DU DOM (neutre sur les balises ; `role="note"` est la piste de la maquette mais les tests lisent le texte) :
 *  - sous la ligne de chaque spot de 1re catégorie fermé, même sans l'ouvrir : « Fermé : la 1re catégorie est hors saison »,
 *    « Réouverture le <jour de semaine> <jour> <mois> <année> », « À vérifier dans l'arrêté de ton département »,
 *    puis le lien « Site de la fédération » (target _blank, rel noopener, href = URL du département) ;
 *  - spot ouvert : un seul lien « Site de la fédération » dans son <li> (pas de doublon avec celui de l'US 5) ;
 *  - département absent de la table : « Pas de lien pour ce département : cherche ta fédération départementale de pêche » à la place du lien ;
 *  - 2e catégorie : jamais de bandeau.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService } from '../../core/data/catalog.service';
import { Geolocalisation, GEOLOCALISATION } from '../../core/data/position.service';
import { DocumentSpot, SOURCE_SPOTS } from '../../core/data/spots.service';
import { SpotsPage } from './spots.page';

const URL_49 = 'https://federation-49.example.test/';
const TABLE: Record<string, { departement: string; nom: string; url: string }> = {
  '49': { departement: '49', nom: 'Fédération 49', url: URL_49 },
};

const SPOT_1RE: DocumentSpot = { id: 's1', data: { nom: 'Gué de la Sarthe', lat: 47.5, lng: -0.5, categorie: 1, milieu: 'riviere', departement: '49', prive: true } };
const SPOT_2E: DocumentSpot = { id: 's2', data: { nom: 'Pont de Cé', lat: 47.43, lng: -0.52, categorie: 2, milieu: 'riviere', departement: '49', prive: true } };
const SPOT_1RE_SANS_TABLE: DocumentSpot = { id: 's3', data: { nom: 'Torrent du 99', lat: 46.0, lng: 2.0, categorie: 1, milieu: 'riviere', departement: '99', prive: true } };

const TITRE = 'Fermé : la 1re catégorie est hors saison';
const MENTION = 'À vérifier dans l\'arrêté de ton département';
const LIBELLE_LIEN = 'Site de la fédération';
const SANS_LIEN = 'Pas de lien pour ce département : cherche ta fédération départementale de pêche';

const compact = (t: string | null | undefined): string => (t ?? '').replace(/\s+/g, '');
const texte = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const attendre = () => new Promise<void>((r) => setTimeout(r));

/** Monte la page « Spots » à la date locale donnée (midi), avec les spots donnés. */
async function monter(jour: [number, number, number], initiaux: DocumentSpot[]) {
  TestBed.resetTestingModule();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(jour[0], jour[1] - 1, jour[2], 12, 0, 0));
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
type Env = Awaited<ReturnType<typeof monter>>;

const boutons = (racine: ParentNode) => [...racine.querySelectorAll<HTMLElement>('button')];
const ligneDe = (env: Env, nom: string): HTMLElement => {
  const b = boutons(env.page).find((x) => texte(x).startsWith(nom));
  if (!b) throw new Error(`Aucune ligne « ${nom} »`);
  return b;
};
/** L'élément de liste (<li>) du spot : sa ligne et ce qui est dessous. */
const elementDe = (env: Env, nom: string): HTMLElement => ligneDe(env, nom).closest('li') as HTMLElement;
const liens = (racine: ParentNode) => [...racine.querySelectorAll<HTMLAnchorElement>('a')].filter((a) => compact(a.textContent).includes(compact(LIBELLE_LIEN)));
const aBandeau = (env: Env) => texte(env.page).includes(TITRE);
const ouvrirSpot = async (env: Env, nom: string) => {
  ligneDe(env, nom).click();
  await env.stabiliser();
};

describe('SpotsPage : bandeau « Fermé » en 1re catégorie hors saison (US 6)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('critère 1 : given un spot de 1re catégorie et le 15 février 2026, when l\'utilisateur voit la liste sans l\'ouvrir, then le bandeau « Fermé : la 1re catégorie est hors saison » s\'affiche sous sa ligne avec la réouverture le samedi 14 mars 2026', async () => {
    const env = await monter([2026, 2, 15], [SPOT_1RE, SPOT_2E]);

    await vi.waitFor(() => expect(texte(elementDe(env, 'Gué de la Sarthe'))).toContain(TITRE), { timeout: 2000 });
    const bandeau = texte(elementDe(env, 'Gué de la Sarthe'));
    expect(bandeau).toContain('Réouverture le samedi 14 mars 2026');
    expect(elementDe(env, 'Gué de la Sarthe').querySelectorAll('[role="note"]').length).toBe(1);
  });

  it('critère 1 : given un spot de 1re catégorie et le 15 février 2026, when l\'utilisateur ouvre le spot, then le bandeau reste affiché avec la réouverture le samedi 14 mars 2026', async () => {
    const env = await monter([2026, 2, 15], [SPOT_1RE]);

    await ouvrirSpot(env, 'Gué de la Sarthe');

    await vi.waitFor(() => expect(texte(elementDe(env, 'Gué de la Sarthe'))).toContain(TITRE), { timeout: 2000 });
    expect(texte(elementDe(env, 'Gué de la Sarthe'))).toContain('Réouverture le samedi 14 mars 2026');
    expect(ligneDe(env, 'Gué de la Sarthe').getAttribute('aria-current')).toBe('true');
  });

  it('critère 1 : given un spot de 1re catégorie le 1er janvier 2026 (début d\'année), when l\'utilisateur voit la liste, then la réouverture est le samedi 14 mars 2026 de la même année', async () => {
    const env = await monter([2026, 1, 1], [SPOT_1RE]);

    await vi.waitFor(() => expect(texte(env.page)).toContain('Réouverture le samedi 14 mars 2026'), { timeout: 2000 });
  });

  it('critère 2 : given un spot de 1re catégorie et le samedi 14 mars 2026 (2e samedi de mars, borne incluse), when l\'utilisateur ouvre le spot, then aucun bandeau « Fermé » (la veille, il y en a un)', async () => {
    const veille = await monter([2026, 3, 13], [SPOT_1RE]);
    await ouvrirSpot(veille, 'Gué de la Sarthe');
    await vi.waitFor(() => expect(aBandeau(veille)).toBe(true), { timeout: 2000 });

    const env = await monter([2026, 3, 14], [SPOT_1RE]);
    await ouvrirSpot(env, 'Gué de la Sarthe');
    await vi.waitFor(() => expect(liens(env.page)).toHaveLength(1), { timeout: 2000 });

    expect(aBandeau(env)).toBe(false);
    expect(texte(env.page)).not.toContain('Réouverture');
  });

  it('critère 2 : given un spot de 1re catégorie et le dimanche 20 septembre 2026 (3e dimanche de septembre, borne incluse), when l\'utilisateur ouvre le spot, then aucun bandeau « Fermé » (le lendemain, il y en a un)', async () => {
    const lendemain = await monter([2026, 9, 21], [SPOT_1RE]);
    await ouvrirSpot(lendemain, 'Gué de la Sarthe');
    await vi.waitFor(() => expect(aBandeau(lendemain)).toBe(true), { timeout: 2000 });

    const env = await monter([2026, 9, 20], [SPOT_1RE]);
    await ouvrirSpot(env, 'Gué de la Sarthe');
    await vi.waitFor(() => expect(liens(env.page)).toHaveLength(1), { timeout: 2000 });

    expect(aBandeau(env)).toBe(false);
  });

  it('critère 2 : given un spot de 1re catégorie et le samedi 20 juin 2026 (milieu de saison), when l\'utilisateur ouvre le spot, then aucun bandeau « Fermé » (en février, il y en a un)', async () => {
    const hiver = await monter([2026, 2, 15], [SPOT_1RE]);
    await vi.waitFor(() => expect(aBandeau(hiver)).toBe(true), { timeout: 2000 });

    const env = await monter([2026, 6, 20], [SPOT_1RE]);
    await ouvrirSpot(env, 'Gué de la Sarthe');
    await vi.waitFor(() => expect(liens(env.page)).toHaveLength(1), { timeout: 2000 });

    expect(aBandeau(env)).toBe(false);
  });

  it('critère 3 : given un spot de 1re catégorie et le lundi 21 septembre 2026 (lendemain du 3e dimanche de septembre), when l\'utilisateur ouvre le spot, then le bandeau « Fermé » s\'affiche avec la réouverture le samedi 13 mars 2027', async () => {
    const env = await monter([2026, 9, 21], [SPOT_1RE]);

    await ouvrirSpot(env, 'Gué de la Sarthe');

    await vi.waitFor(() => expect(texte(elementDe(env, 'Gué de la Sarthe'))).toContain(TITRE), { timeout: 2000 });
    expect(texte(elementDe(env, 'Gué de la Sarthe'))).toContain('Réouverture le samedi 13 mars 2027');
  });

  it('critère 3 : given la liste ouverte le dimanche 20 septembre 2026 sans bandeau, when l\'app revient au premier plan le lundi 21 septembre, then le bandeau « Fermé » apparaît sans attendre un changement de spot', async () => {
    const env = await monter([2026, 9, 20], [SPOT_1RE]);
    await vi.waitFor(() => expect(texte(elementDe(env, 'Gué de la Sarthe'))).toContain('Gué de la Sarthe'), { timeout: 2000 });
    expect(aBandeau(env)).toBe(false);

    vi.setSystemTime(new Date(2026, 8, 21, 8, 0, 0));
    document.dispatchEvent(new Event('visibilitychange'));
    await env.stabiliser();

    await vi.waitFor(() => expect(texte(elementDe(env, 'Gué de la Sarthe'))).toContain('Réouverture le samedi 13 mars 2027'), { timeout: 2000 });
  });

  it('critère 4 : given un spot de 2e catégorie et le 15 février 2026, when l\'utilisateur ouvre le spot, then aucun bandeau « Fermé » de 1re catégorie (le spot de 1re catégorie voisin, lui, en a un)', async () => {
    const env = await monter([2026, 2, 15], [SPOT_1RE, SPOT_2E]);
    // Contrôle de la cause : le spot de 1re catégorie porte bien le bandeau.
    await vi.waitFor(() => expect(texte(elementDe(env, 'Gué de la Sarthe'))).toContain(TITRE), { timeout: 2000 });

    await ouvrirSpot(env, 'Pont de Cé');
    await vi.waitFor(() => expect(liens(elementDe(env, 'Pont de Cé'))).toHaveLength(1), { timeout: 2000 });

    const element = elementDe(env, 'Pont de Cé');
    expect(texte(element)).not.toContain(TITRE);
    expect(texte(element)).not.toContain('Réouverture');
    expect(element.querySelector('[role="note"]')).toBeNull();
  });

  it('critère 4 : given un spot de 2e catégorie, when la date change de saison (15 février, 20 juin, 21 septembre 2026), then jamais de bandeau pour lui', async () => {
    for (const jour of [[2026, 2, 15], [2026, 6, 20], [2026, 9, 21]] as [number, number, number][]) {
      const env = await monter(jour, [SPOT_1RE, SPOT_2E]);
      await env.stabiliser();
      await attendre();
      expect(texte(elementDe(env, 'Pont de Cé'))).not.toContain(TITRE);
    }
    // Contrôle de la cause : à une date hors saison, la 1re catégorie, elle, porte le bandeau.
    const hiver = await monter([2026, 2, 15], [SPOT_1RE, SPOT_2E]);
    await vi.waitFor(() => expect(texte(elementDe(hiver, 'Gué de la Sarthe'))).toContain(TITRE), { timeout: 2000 });
  });

  it('critère 5 : given le bandeau « Fermé » dans la liste, when l\'utilisateur le lit, then il porte « À vérifier dans l\'arrêté de ton département » et le lien « Site de la fédération » du 49 (target _blank, rel noopener)', async () => {
    const env = await monter([2026, 2, 15], [SPOT_1RE]);

    await vi.waitFor(() => expect(liens(elementDe(env, 'Gué de la Sarthe'))).toHaveLength(1), { timeout: 2000 });
    const element = elementDe(env, 'Gué de la Sarthe');
    expect(texte(element)).toContain(TITRE);
    expect(texte(element)).toContain(MENTION);
    const lien = liens(element)[0];
    expect(lien.getAttribute('href')).toBe(URL_49);
    expect(lien.getAttribute('target')).toBe('_blank');
    expect(lien.getAttribute('rel') ?? '').toContain('noopener');
    expect(lien.closest('button')).toBeNull();
    // Le lien est dans le bandeau, pas à côté.
    expect(lien.closest('[role="note"]')).not.toBeNull();
    expect(lien.closest('[role="note"]')?.textContent).toContain('Fermé');
  });

  it('critère 5 : given le spot de 1re catégorie ouvert hors saison, when l\'utilisateur le lit, then exactement un lien « Site de la fédération » (celui du bandeau, pas de doublon avec l\'US 5)', async () => {
    const env = await monter([2026, 2, 15], [SPOT_1RE]);
    await ouvrirSpot(env, 'Gué de la Sarthe');

    await vi.waitFor(() => expect(texte(elementDe(env, 'Gué de la Sarthe'))).toContain(TITRE), { timeout: 2000 });
    await vi.waitFor(() => expect(liens(elementDe(env, 'Gué de la Sarthe'))).toHaveLength(1), { timeout: 2000 });
    await attendre();
    await env.stabiliser();

    const element = elementDe(env, 'Gué de la Sarthe');
    expect(liens(element)).toHaveLength(1);
    expect(liens(element)[0].getAttribute('href')).toBe(URL_49);
    expect(texte(element)).toContain(MENTION);
  });

  it('critère 5 : given un spot de 1re catégorie hors saison dont le département (99) n\'est pas dans la table, when l\'utilisateur lit le bandeau, then « Pas de lien pour ce département : cherche ta fédération départementale de pêche » remplace le lien', async () => {
    const env = await monter([2026, 2, 15], [SPOT_1RE, SPOT_1RE_SANS_TABLE]);
    // Contrôle de la cause : le spot du 49 montre bien son lien dans le bandeau.
    await vi.waitFor(() => expect(liens(elementDe(env, 'Gué de la Sarthe'))).toHaveLength(1), { timeout: 2000 });

    await vi.waitFor(() => expect(texte(elementDe(env, 'Torrent du 99'))).toContain(SANS_LIEN), { timeout: 2000 });
    const element = elementDe(env, 'Torrent du 99');
    expect(texte(element)).toContain(TITRE);
    expect(texte(element)).toContain(MENTION);
    expect(liens(element)).toHaveLength(0);
  });
});
