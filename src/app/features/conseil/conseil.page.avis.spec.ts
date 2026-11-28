/*
 * US 88 : donner un avis 👍 / 👎 sur un conseil (PLAN §2.1, §7, §8.6, §10).
 * Maquette de référence : docs/maquettes/us-88-avis-sur-un-conseil.html.
 *
 * CONTRAT (la couture que l'implémentation doit fournir) :
 *  - src/app/core/data/feedback.service.ts exporte `SOURCE_FEEDBACK` (InjectionToken<SourceFeedback>, providedIn root, fabrique =
 *    creerSourceFeedbackFirebase(inject(Injector))) et
 *      interface SourceFeedback { envoyer(feedback: Record<string, unknown>): Promise<void> }
 *    `envoyer` crée UN document dans la collection `feedback` ; le double des tests enregistre le document reçu.
 *  - Chaque carte du top 3 porte, au-dessus de « Voir le détail », « Ce conseil t'a aidé ? » et deux boutons
 * « 👍 » (aria-label « Oui, ce conseil m'a aidé ») et « 👎 » (aria-label « Non, ce conseil ne m'a pas aidé »).
 *  - Le tap envoie UN document { conseilId: string non vide (distinct par carte), typeId, techniqueId, utile: boolean,
 *    conditions: { tempEau, vent arrondis à l'entier ; debitTendance, pressionTendance48h tels quels ; departement ; sans lat/lng },
 *    date: instant arrondi à l'heure (chaîne ISO ou Date) } et rien d'autre (pas d'uid, pas de latitude, pas de longitude).
 *  - Le tap ne passe pas par `await` du réseau : la carte affiche « Merci pour ton retour ! » (role="status") tout de suite, même si
 *    `envoyer` ne se résout jamais (hors ligne) ou échoue. Le tap n'ouvre pas le détail. Les autres cartes ne changent pas.
 * Doubles : comme conseil.page.top3.spec.ts ; aucun accès réseau.
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { SOURCE_FEEDBACK } from '../../core/data/feedback.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { compact, ecranDe, ouvrirAutresCoups, stabiliser } from './conseil.page.aides';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-09T06:32:00Z'), coucher: new Date('2026-11-09T17:01:00Z') };
const MAINTENANT = new Date('2026-11-09T12:34:56.789Z');
const HEURE_RONDE = new Date('2026-11-09T12:00:00.000Z');

const CONDITIONS: Conditions = {
  tempEau: 11.6,
  sourceTempEau: 'capteur',
  debitTendance: 'normal',
  pressionTendance48h: -8,
  nuages: 80,
  vent: 14.4,
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
const COULEURS = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];

const conseil = (surcharge: Partial<Conseil>): Conseil => ({
  typeId: 'shad',
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 10,
  pourquoi: ['Une phrase.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
  ...surcharge,
});
const TOP3: ResultatConseil = {
  conseils: [
    conseil({ typeId: 'shad', techniqueId: 'tiree', score: 9 }),
    conseil({ typeId: 'jig', techniqueId: 'gratte', score: 7 }),
    conseil({ typeId: 'ver', techniqueId: 'dropshot', score: 5 }),
  ],
  explications: [],
};

type Envoi = (feedback: Record<string, unknown>) => Promise<void>;

async function afficher(envoyer: Envoi = async () => undefined) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  const envois: Record<string, unknown>[] = [];
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_FEEDBACK, useValue: { envoyer: (f: Record<string, unknown>) => (envois.push(f), envoyer(f)) } },
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      {
        provide: CatalogService,
        useValue: { federation: async () => undefined, typesDeLeurres: async () => TYPES, animations: async () => ANIMATIONS, couleurs: async () => COULEURS },
      },
      { provide: ConditionsService, useValue: { releve: async () => RELEVE } },
      { provide: AstroService, useValue: { soleil: (): SoleilDuJour => SOLEIL, lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
      { provide: MoteurService, useValue: { conseiller: async () => TOP3 } },
    ],
  }).compileComponents();
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ConseilPage);
  const attendre = () => stabiliser(fixture);
  await attendre();
  // Les avis des coups 02 et 03 sont dans la feuille « 2 autres coups » : on l'ouvre pour avoir les trois.
  await ouvrirAutresCoups(ecranDe(fixture));
  return { page: fixture.nativeElement as HTMLElement, envois, navigate, attendre };
}

afterEach(() => vi.useRealTimers());

/** Les trois lignes d'avis : celle du coup 01 (rivière), puis celles des coups 02 et 03 (feuille « 2 autres coups »). */
const cartes = (page: HTMLElement): HTMLElement[] => [...page.querySelectorAll<HTMLElement>('app-avis-coup')];
const OUI = "Oui, ce conseil m'a aidé";
const NON = "Non, ce conseil ne m'a pas aidé";
const bouton = (carte: HTMLElement, label: string) =>
  [...carte.querySelectorAll<HTMLElement>('button, ion-button')].find((b) => b.getAttribute('aria-label') === label);
const MERCI = compact('Merci pour ton retour !');

describe('ConseilPage : avis 👍 / 👎 sur un conseil (US 88)', () => {
  it("critère 1 : given l'écran Conseil montre 3 cartes, when je regarde une carte, then elle affiche « Ce conseil t'a aidé ? » avec un bouton « 👍 » et un bouton « 👎 »", async () => {
    const { page } = await afficher();

    const liste = cartes(page);
    expect(liste).toHaveLength(3);
    for (const carte of liste) {
      expect(compact(carte.textContent)).toContain(compact("Ce conseil t'a aidé ?"));
      expect(compact(bouton(carte, OUI)?.textContent), 'bouton 👍').toBe('👍');
      expect(compact(bouton(carte, NON)?.textContent), 'bouton 👎').toBe('👎');
    }
  });

  it("critère 1 : given le coup 01, when je regarde la ligne d'avis, then elle est hors du lien du coup (un tap sur 👍 n'ouvre pas le détail) et sur la ligne de « 2 autres coups »", async () => {
    const { page } = await afficher();

    const avis = cartes(page)[0];
    expect(avis.closest('a'), "l'avis n'est pas dans le lien du coup 01").toBeNull();
    expect(avis.parentElement?.querySelector('#autres-coups'), 'même ligne que « 2 autres coups »').not.toBeNull();
  });

  it("critère 2 : given une carte de conseil, when je touche « 👍 », then un document feedback est créé avec conseilId, typeId, techniqueId, utile à vrai, les conditions arrondies et la date", async () => {
    const { page, envois } = await afficher();

    bouton(cartes(page)[1], OUI)?.click();

    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatchObject({
      typeId: 'jig',
      techniqueId: 'gratte',
      utile: true,
      conditions: { tempEau: 12, vent: 14, debitTendance: 'normal', pressionTendance48h: -8, departement: '49' },
    });
    expect(typeof envois[0]['conseilId']).toBe('string');
    expect((envois[0]['conseilId'] as string).length).toBeGreaterThan(0);
    expect(new Date(envois[0]['date'] as string).getTime()).toBe(HEURE_RONDE.getTime());
  });

  it('critère 2 : given trois cartes, when je donne un avis sur chacune, then les conseilId sont distincts', async () => {
    const { page, envois } = await afficher();

    for (const carte of cartes(page)) bouton(carte, OUI)?.click();

    expect(envois).toHaveLength(3);
    expect(new Set(envois.map((e) => e['conseilId'])).size).toBe(3);
  });

  it("critère 2 : given une carte de conseil, when je touche « 👍 », then la ligne d'avis affiche « Merci pour ton retour ! » (role status) à la place des boutons, sans ouvrir le détail, et les autres cartes sont inchangées", async () => {
    const { page, navigate, attendre } = await afficher();
    const [premiere, deuxieme, troisieme] = cartes(page);

    bouton(premiere, OUI)?.click();
    await attendre();

    const apres = cartes(page);
    expect(compact(apres[0].textContent)).toContain(MERCI);
    expect(apres[0].querySelector('[role="status"]')?.textContent).toContain('Merci pour ton retour !');
    expect(compact(apres[0].textContent)).not.toContain(compact("Ce conseil t'a aidé ?"));
    expect(bouton(apres[0], OUI)).toBeUndefined();
    expect(bouton(apres[0], NON)).toBeUndefined();
    for (const autre of [apres[1], apres[2]]) {
      expect(compact(autre.textContent)).not.toContain(MERCI);
      expect(bouton(autre, OUI)).toBeDefined();
      expect(bouton(autre, NON)).toBeDefined();
    }
    expect(deuxieme).toBeDefined();
    expect(troisieme).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("critère 3 : given une carte de conseil, when je touche « 👎 », then un document feedback est créé avec utile à faux et la carte affiche « Merci pour ton retour ! »", async () => {
    const { page, envois, navigate, attendre } = await afficher();

    bouton(cartes(page)[2], NON)?.click();
    await attendre();

    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatchObject({ typeId: 'ver', techniqueId: 'dropshot', utile: false });
    expect(compact(cartes(page)[2].textContent)).toContain(MERCI);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("critère 3 : given une carte avec avis donné, when je regarde de nouveau la carte, then un seul document a été créé pour cette carte", async () => {
    const { page, envois, attendre } = await afficher();

    bouton(cartes(page)[0], NON)?.click();
    await attendre();

    expect(bouton(cartes(page)[0], OUI)).toBeUndefined();
    expect(envois).toHaveLength(1);
  });

  it("critère 4 : given j'envoie un avis, when on lit le document feedback créé, then il ne contient ni uid ni latitude ni longitude, ni aucun autre champ que conseilId, typeId, techniqueId, utile, conditions et date", async () => {
    const { page, envois } = await afficher();

    bouton(cartes(page)[0], OUI)?.click();

    expect(envois).toHaveLength(1);
    expect(Object.keys(envois[0]).sort()).toEqual(['conditions', 'conseilId', 'date', 'techniqueId', 'typeId', 'utile']);
    const interdits = ['uid', 'lat', 'lng', 'latitude', 'longitude'];
    expect(Object.keys(envois[0]).filter((k) => interdits.includes(k))).toEqual([]);
    const conditions = envois[0]['conditions'] as Record<string, unknown>;
    expect(conditions).toBeTypeOf('object');
    expect(Object.keys(conditions).filter((k) => interdits.includes(k))).toEqual([]);
    expect(JSON.stringify(envois[0])).not.toContain('47.47');
    expect(JSON.stringify(envois[0])).not.toContain('-0.55');
  });

  it("critère 4 : given des conditions à décimales, when j'envoie un avis, then la température de l'eau et le vent sont arrondis à l'entier et la date à l'heure", async () => {
    const { page, envois } = await afficher();

    bouton(cartes(page)[0], NON)?.click();

    const conditions = envois[0]['conditions'] as Record<string, unknown>;
    expect(conditions['tempEau']).toBe(12);
    expect(conditions['vent']).toBe(14);
    expect(new Date(envois[0]['date'] as string).toISOString()).toBe('2026-11-09T12:00:00.000Z');
  });

  it("critère 5 : given je n'ai pas de réseau (l'envoi ne se termine jamais), when je touche « 👍 », then la ligne d'avis affiche « Merci pour ton retour ! » sans erreur ni attente", async () => {
    const { page, envois, attendre } = await afficher(() => new Promise<void>(() => undefined));

    bouton(cartes(page)[0], OUI)?.click();
    await attendre();

    expect(envois).toHaveLength(1);
    expect(compact(cartes(page)[0].textContent)).toContain(MERCI);
    expect(compact(page.textContent)).not.toMatch(/erreur|réessaie|échec|chargement/i);
  });

  it("critère 5 : given l'envoi est refusé ou échoue, when je touche « 👎 », then la carte affiche quand même « Merci pour ton retour ! » sans message d'erreur", async () => {
    const { page, attendre } = await afficher(() => Promise.reject(new Error('hors ligne')));

    bouton(cartes(page)[0], NON)?.click();
    await attendre();

    expect(compact(cartes(page)[0].textContent)).toContain(MERCI);
    expect(compact(page.textContent)).not.toMatch(/erreur|réessaie|échec/i);
  });

  it("critère 3 : given une carte, when je touche deux fois de suite le bouton avant le rendu suivant, then un seul document est créé pour cette carte", async () => {
    const { page, envois } = await afficher();
    const carte = cartes(page)[0];
    const oui = bouton(carte, OUI);

    oui?.click();
    oui?.click();
    bouton(carte, NON)?.click();

    expect(envois).toHaveLength(1);
  });

  it("accessibilité : given une carte, when je touche 👍, then le focus passe sur le remerciement de cette carte", async () => {
    const { page, attendre } = await afficher();

    bouton(cartes(page)[0], OUI)?.click();
    await attendre();

    const merci = cartes(page)[0].querySelector<HTMLElement>('[role="status"]');
    expect(merci?.textContent).toContain('Merci pour ton retour !');
    expect(document.activeElement).toBe(merci);
  });
});
