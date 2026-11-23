/*
 * US 88 : donner un avis üëç / üëé sur un conseil (PLAN  ß2.1,  ß7,  ß8.6,  ß10).
 * Maquette de r√©f√©rence : docs/maquettes/us-88-avis-sur-un-conseil.html.
 *
 * CONTRAT (la couture que l'impl√©mentation doit fournir) :
 *  - src/app/core/data/feedback.service.ts exporte `SOURCE_FEEDBACK` (InjectionToken<SourceFeedback>, providedIn root, fabrique =
 *    creerSourceFeedbackFirebase(inject(Injector))) et
 *      interface SourceFeedback { envoyer(feedback: Record<string, unknown>): Promise<void> }
 *    `envoyer` cr√©e UN document dans la collection `feedback` ; le double des tests enregistre le document re√ßu.
 *  - Chaque carte du top 3 porte, au-dessus de  ´ Voir le d√©tail  ª,  ´ Ce conseil t'a aid√© ?  ª et deux boutons
 *     ´ üëç  ª (aria-label  ´ Oui, ce conseil m'a aid√©  ª) et  ´ üëé  ª (aria-label  ´ Non, ce conseil ne m'a pas aid√©  ª).
 *  - Le tap envoie UN document { conseilId: string non vide (distinct par carte), typeId, techniqueId, utile: boolean,
 *    conditions: { tempEau, vent arrondis √  l'entier ; debitTendance, pressionTendance48h tels quels ; departement ; sans lat/lng },
 *    date: instant arrondi √  l'heure (cha√Æne ISO ou Date) } et rien d'autre (pas d'uid, pas de latitude, pas de longitude).
 *  - Le tap ne passe pas par `await` du r√©seau : la carte affiche  ´ Merci pour ton retour !  ª (role="status") tout de suite, m√™me si
 *    `envoyer` ne se r√©sout jamais (hors ligne) ou √©choue. Le tap n'ouvre pas le d√©tail. Les autres cartes ne changent pas.
 * Doubles : comme conseil.page.top3.spec.ts ; aucun acc√®s r√©seau.
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
  { id: 'jig', nom: 'Jig √  jupe' },
  { id: 'ver', nom: 'Ver souple finesse' },
] as TypeLeurre[];
const ANIMATIONS = [
  { id: 'tiree', nom: 'Tir√©e-rel√¢ch√©e' },
  { id: 'gratte', nom: 'Gratt√©' },
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
  const attendre = async () => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  await attendre();
  return { page: fixture.nativeElement as HTMLElement, envois, navigate, attendre };
}

afterEach(() => vi.useRealTimers());

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s   ]/g, '');

function cartes(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>('section, article, ion-card')].filter(
    (e) => compact(e.textContent).includes(compact('Animation :')) && !e.querySelector('section, article, ion-card'),
  );
}
const OUI = "Oui, ce conseil m'a aid√©";
const NON = "Non, ce conseil ne m'a pas aid√©";
const bouton = (carte: HTMLElement, label: string) =>
  [...carte.querySelectorAll<HTMLElement>('button, ion-button')].find((b) => b.getAttribute('aria-label') === label);
const MERCI = compact('Merci pour ton retour !');

describe('ConseilPage : avis üëç / üëé sur un conseil (US 88)', () => {
  it("crit√®re 1 : given l'√©cran Conseil montre 3 cartes, when je regarde une carte, then elle affiche  ´ Ce conseil t'a aid√© ?  ª avec un bouton  ´ üëç  ª et un bouton  ´ üëé  ª", async () => {
    const { page } = await afficher();

    const liste = cartes(page);
    expect(liste).toHaveLength(3);
    for (const carte of liste) {
      expect(compact(carte.textContent)).toContain(compact("Ce conseil t'a aid√© ?"));
      expect(compact(bouton(carte, OUI)?.textContent), 'bouton üëç').toBe('üëç');
      expect(compact(bouton(carte, NON)?.textContent), 'bouton üëé').toBe('üëé');
    }
  });

  it('crit√®re 1 : given une carte, when je la regarde, then la ligne d\'avis est au-dessus de  ´ Voir le d√©tail  ª', async () => {
    const { page } = await afficher();

    const carte = cartes(page)[0];
    const avis = bouton(carte, OUI);
    const detail = [...carte.querySelectorAll<HTMLElement>('button')].find((b) => compact(b.textContent).includes(compact('Voir le d√©tail')));
    expect(avis, 'bouton üëç').toBeDefined();
    expect(detail, 'bouton Voir le d√©tail').toBeDefined();
    expect(avis!.compareDocumentPosition(detail!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("crit√®re 2 : given une carte de conseil, when je touche  ´ üëç  ª, then un document feedback est cr√©√© avec conseilId, typeId, techniqueId, utile √  vrai, les conditions arrondies et la date", async () => {
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

  it('crit√®re 2 : given trois cartes, when je donne un avis sur chacune, then les conseilId sont distincts', async () => {
    const { page, envois } = await afficher();

    for (const carte of cartes(page)) bouton(carte, OUI)?.click();

    expect(envois).toHaveLength(3);
    expect(new Set(envois.map((e) => e['conseilId'])).size).toBe(3);
  });

  it("crit√®re 2 : given une carte de conseil, when je touche  ´ üëç  ª, then la carte affiche  ´ Merci pour ton retour !  ª (role status) √  la place des boutons, sans ouvrir le d√©tail, et les autres cartes sont inchang√©es", async () => {
    const { page, navigate, attendre } = await afficher();
    const [premiere, deuxieme, troisieme] = cartes(page);

    bouton(premiere, OUI)?.click();
    await attendre();

    const apres = cartes(page);
    expect(compact(apres[0].textContent)).toContain(MERCI);
    expect(apres[0].querySelector('[role="status"]')?.textContent).toContain('Merci pour ton retour !');
    expect(compact(apres[0].textContent)).not.toContain(compact("Ce conseil t'a aid√© ?"));
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

  it("crit√®re 3 : given une carte de conseil, when je touche  ´ üëé  ª, then un document feedback est cr√©√© avec utile √  faux et la carte affiche  ´ Merci pour ton retour !  ª", async () => {
    const { page, envois, navigate, attendre } = await afficher();

    bouton(cartes(page)[2], NON)?.click();
    await attendre();

    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatchObject({ typeId: 'ver', techniqueId: 'dropshot', utile: false });
    expect(compact(cartes(page)[2].textContent)).toContain(MERCI);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("crit√®re 3 : given une carte avec avis donn√©, when je regarde de nouveau la carte, then un seul document a √©t√© cr√©√© pour cette carte", async () => {
    const { page, envois, attendre } = await afficher();

    bouton(cartes(page)[0], NON)?.click();
    await attendre();

    expect(bouton(cartes(page)[0], OUI)).toBeUndefined();
    expect(envois).toHaveLength(1);
  });

  it("crit√®re 4 : given j'envoie un avis, when on lit le document feedback cr√©√©, then il ne contient ni uid ni latitude ni longitude, ni aucun autre champ que conseilId, typeId, techniqueId, utile, conditions et date", async () => {
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

  it("crit√®re 4 : given des conditions √  d√©cimales, when j'envoie un avis, then la temp√©rature de l'eau et le vent sont arrondis √  l'entier et la date √  l'heure", async () => {
    const { page, envois } = await afficher();

    bouton(cartes(page)[0], NON)?.click();

    const conditions = envois[0]['conditions'] as Record<string, unknown>;
    expect(conditions['tempEau']).toBe(12);
    expect(conditions['vent']).toBe(14);
    expect(new Date(envois[0]['date'] as string).toISOString()).toBe('2026-11-09T12:00:00.000Z');
  });

  it("crit√®re 5 : given je n'ai pas de r√©seau (l'envoi ne se termine jamais), when je touche  ´ üëç  ª, then la carte affiche  ´ Merci pour ton retour !  ª sans erreur ni attente", async () => {
    const { page, envois, attendre } = await afficher(() => new Promise<void>(() => undefined));

    bouton(cartes(page)[0], OUI)?.click();
    await attendre();

    expect(envois).toHaveLength(1);
    expect(compact(cartes(page)[0].textContent)).toContain(MERCI);
    expect(compact(page.textContent)).not.toMatch(/erreur|r√©essaie|√©chec|chargement/i);
  });

  it("crit√®re 5 : given l'envoi est refus√© ou √©choue, when je touche  ´ üëé  ª, then la carte affiche quand m√™me  ´ Merci pour ton retour !  ª sans message d'erreur", async () => {
    const { page, attendre } = await afficher(() => Promise.reject(new Error('hors ligne')));

    bouton(cartes(page)[0], NON)?.click();
    await attendre();

    expect(compact(cartes(page)[0].textContent)).toContain(MERCI);
    expect(compact(page.textContent)).not.toMatch(/erreur|r√©essaie|√©chec/i);
  });

  it("crit√®re 3 : given une carte, when je touche deux fois de suite le bouton avant le rendu suivant, then un seul document est cr√©√© pour cette carte", async () => {
    const { page, envois } = await afficher();
    const carte = cartes(page)[0];
    const oui = bouton(carte, OUI);

    oui?.click();
    oui?.click();
    bouton(carte, NON)?.click();

    expect(envois).toHaveLength(1);
  });

  it("accessibilit√© : given une carte, when je touche üëç, then le focus passe sur le remerciement de cette carte", async () => {
    const { page, attendre } = await afficher();

    bouton(cartes(page)[0], OUI)?.click();
    await attendre();

    const merci = cartes(page)[0].querySelector<HTMLElement>('[role="status"]');
    expect(merci?.textContent).toContain('Merci pour ton retour !');
    expect(document.activeElement).toBe(merci);
  });
});
