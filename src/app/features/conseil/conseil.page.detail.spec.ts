/*
 * US 86 : ouvrir le détail d'un conseil. Maquette de référence : docs/maquettes/us-86-detail-d-un-conseil.html (PLAN §3, §8.3).
 *
 * Les tests passent par l'app réelle (App + routes), pour ne dépendre d'aucun composant privé : écran « Conseil » (3 cartes),
 * tap sur une carte, détail, fiche animation, retour. Aucune URL n'est imposée.
 *
 * Contrat du DOM supposé (neutre sur les balises) :
 *  - Une carte de conseil (`section`, `article` ou `ion-card` le plus interne dont le texte contient « Animation : ») porte une
 *    ligne « Voir le détail » ; le tap sur cet élément (ou sur la carte) ouvre le détail.
 *  - Le détail : un titre « Détail du conseil » ; les lignes « Couleur : », « Taille : » ou « Poids : », « Poids de tête : »
 *    (seulement pour un type qui a `poidsTeteG`), « Où le lancer : » ; une liste `li` avec une phrase par entrée de `pourquoi` ;
 *    un bouton « Voir l'animation » ; un bouton de retour dont le texte est « Conseil » (le dock n'est pas affiché dans le détail).
 *  - La fiche animation : un titre avec le nom de l'animation, « Le geste », « Vitesse », « Erreur à éviter » (intitulés renommés par l'US 8), pas
 *    d'encadré « La vidéo de l'animation arrive bientôt. » (retiré, décision du propriétaire à l'US 9) et un bouton de retour « Détail ».
 *  - Le retour (bouton « Conseil » ou retour du navigateur) ne rappelle ni ConditionsService ni MoteurService.
 * Temps : faux timers sur `Date`. Maintenant = lundi 9 novembre 2026, 14 h à Paris. Demain 10 h = 2026-11-10T09:00Z.
 */
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { Animation, CatalogService, Couleur, Espece, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil, ResultatConseil } from '../../core/engine/scorer';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { compact, liensDesCoups, ouvrirAutresCoups, ouvrirConditions, textesDesCoups } from './conseil.page.aides';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };
const LEVER = new Date('2026-11-09T06:32:00Z');
const COUCHER = new Date('2026-11-09T17:01:00Z');
const JOUR_MS = 24 * 3600 * 1000;
/** Même lever et même coucher chaque jour : heures légales 7 h 02 – 18 h 31 à Paris. */
function soleilDu(moment: Date): SoleilDuJour {
  const jours = Math.floor(moment.getTime() / JOUR_MS) - Math.floor(LEVER.getTime() / JOUR_MS);
  return { lever: new Date(LEVER.getTime() + jours * JOUR_MS), coucher: new Date(COUCHER.getTime() + jours * JOUR_MS) };
}
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
  { id: 'shad', nom: 'Shad', poidsTeteG: [5, 10] },
  { id: 'lipless', nom: 'Lipless (vibrant sans bavette)' },
  { id: 'minnow', nom: 'Minnow (jerkbait)' },
] as unknown as TypeLeurre[];
const ANIMATIONS = [
  {
    id: 'tiree',
    nom: 'Tirée-relâchée',
    geste: 'Laisse le leurre toucher le fond puis lève la canne.',
    vitesse: 'Lente, avec une pause au fond à chaque tirée',
    erreurAEviter: 'Laisser le fil détendu pendant la descente.',
  },
  { id: 'twitching', nom: 'Twitching', geste: 'Donne de petits coups de canne secs.', vitesse: 'Rapide et saccadée', erreurAEviter: 'Trop de pauses.' },
] as unknown as Animation[];
const COULEURS = [{ id: 'gardon', nom: 'Gardon' }] as Couleur[];
const ESPECES = [
  { code: 'SAN', nom: 'Sandre', postes: ['cassures', 'fond', 'piles de pont'] },
  { code: 'BRO', nom: 'Brochet', postes: ['herbiers', 'bordures', 'bois noyés', 'cassures'] },
] as unknown as Espece[];

const SIX_PHRASES = [
  "À 11,5 °C, l'activité du poisson (sandre) est ralentie : une animation lente lui convient.",
  "En automne, c'est un leurre et une animation de saison (shad, tirée-relâchée).",
  'En eau claire (étiage), prends une couleur naturelle, comme gardon, pour ne pas effrayer le poisson.',
  'Par eau froide, prends un modèle plutôt petit, autour de 8 cm.',
  "À l'aube, la lumière est faible : c'est le moment d'un leurre adapté (shad).",
  'Indice : la pression baisse (−6 hPa en 48 h), le poisson est souvent plus actif avant une perturbation.',
];

const conseil = (surcharge: Partial<Conseil>): Conseil => ({
  typeId: 'shad',
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 10,
  pourquoi: SIX_PHRASES,
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
  ...surcharge,
});

const TOP3: ResultatConseil = {
  conseils: [
    conseil({ score: 9 }),
    conseil({ typeId: 'lipless', especeCode: 'SAN', taille: { valeur: 10, unite: 'g' }, score: 7, pourquoi: ['Par eau froide, prends un modèle plutôt léger, autour de 10 g.'] }),
    conseil({ typeId: 'minnow', techniqueId: 'twitching', especeCode: 'BRO', taille: { valeur: 11.5, unite: 'cm' }, score: 5, pourquoi: [] }),
  ],
  explications: [],
};

async function ouvrirLApp() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  const appelsMoteur: Date[] = [];
  const appelsReleve: unknown[] = [];
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      provideRouter(routes),
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
      {
        provide: ConditionsService,
        useValue: {
          releve: async (...args: unknown[]) => {
            appelsReleve.push(args);
            return RELEVE;
          },
        },
      },
      { provide: AstroService, useValue: { soleil: (_lieu: unknown, moment: Date): SoleilDuJour => soleilDu(moment), lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async (_c: Conditions, moment: Date) => {
            appelsMoteur.push(moment);
            return TOP3;
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
  // Au démarrage de l'app, le routeur suit le retour du navigateur ; TestBed ne passe pas par cet amorçage.
  const router = TestBed.inject(Router);
  router.setUpLocationChangeListener();
  await router.navigateByUrl('/conseil');
  await stabiliser();
  return { page, stabiliser, appelsMoteur, appelsReleve };
}
type Env = Awaited<ReturnType<typeof ouvrirLApp>>;

// US 89 : l'onboarding est terminé (fixture), l'app s'ouvre sur le Conseil.
beforeEach(() => localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] })));
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});


/** Le texte des trois coups de l'écran Conseil (01 dans la rivière, 02 et 03 dans la feuille « 2 autres coups »). */
const top3 = (env: Env): Promise<string[]> => textesDesCoups(env);

/** Touche le coup de ce rang : le « 01 » de la rivière, ou le « 02 » et le « 03 » de la feuille « 2 autres coups ». */
async function ouvrirDetail(env: Env, rang: number): Promise<void> {
  if (rang > 1) await ouvrirAutresCoups(env);
  const lien = liensDesCoups(env.page).find((l) => compact(l.textContent).startsWith(`0${rang}`));
  if (!lien) throw new Error(`Pas de coup n° ${rang}`);
  lien.click();
  await env.stabiliser();
}

const boutons = (page: HTMLElement): HTMLElement[] => [...page.querySelectorAll<HTMLElement>('button, ion-button, ion-back-button, a[role="button"]')];
function bouton(page: HTMLElement, texte: string): HTMLElement {
  const b = boutons(page).find((e) => e.getAttribute('role') !== 'tab' && compact(e.textContent).replace('‹', '') === compact(texte));
  if (!b) throw new Error(`Aucun bouton « ${texte} »`);
  return b;
}
const lignes = (page: HTMLElement): string[] => [...page.querySelectorAll<HTMLElement>('li')].map((l) => l.textContent!.trim());
const detailOuvert = (page: HTMLElement): boolean => compact(page.textContent).includes(compact('Détail du conseil'));

function selecteurMoment(page: HTMLElement): HTMLElement {
  const b = boutons(page).find((e) => !e.closest('[role="dialog"]') && compact(e.textContent).includes('Moment'));
  if (!b) throw new Error('Aucun sélecteur de moment');
  return b;
}
async function choisirDemain10h(env: Env): Promise<void> {
  selecteurMoment(env.page).click();
  await env.stabiliser();
  const f = env.page.querySelector<HTMLElement>('[role="dialog"]')!;
  const dans = (t: string) => [...f.querySelectorAll<HTMLElement>('button, ion-button, [role="radio"], label')].find((e) => compact(e.textContent) === compact(t))!;
  dans('Demain').click();
  await env.stabiliser();
  const select = [...f.querySelectorAll<HTMLSelectElement>('select')][0];
  select.value = [...select.options].find((o) => compact(o.textContent) === compact('10 h'))!.value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await env.stabiliser();
  dans('Valider').click();
  await env.stabiliser();
}

describe('Détail d\'un conseil (US 86)', () => {
  it("critère 1 : given l'écran Conseil montre 3 coups, when je regarde chaque coup, then c'est un lien vers son détail", async () => {
    const env = await ouvrirLApp();
    await ouvrirAutresCoups(env);

    const liens = liensDesCoups(env.page);
    expect(liens).toHaveLength(3);
    liens.forEach((lien, i) => expect(lien.getAttribute('href')).toBe(`/conseil/detail/${i + 1}`));
  });

  it("critère 1 : given l'écran Conseil, when je touche la carte n° 1 (shad), then le détail s'ouvre avec le titre « Détail du conseil », la couleur, la taille, le poids de tête et le poste où lancer", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 1);

    const texte = compact(env.page.textContent);
    expect(texte).toContain(compact('Détail du conseil'));
    expect(texte).toContain(compact('Shad'));
    expect(texte).toContain(compact('Animation : Tirée-relâchée · espèce : sandre'));
    expect(texte).toContain(compact('Couleur : Gardon'));
    expect(texte).toContain(compact('Taille : 8 cm'));
    expect(texte).toContain(compact('Poids de tête : 5 à 10 g'));
    expect(texte).toContain(compact('Où le lancer : cassures, fond, piles de pont'));
  });

  it("critère 1 : given le détail du shad, when je lis « Pourquoi ce conseil », then il y a une phrase par règle déclenchée, dans l'ordre du moteur", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 1);

    expect(compact(env.page.textContent)).toContain(compact('Pourquoi ce conseil'));
    expect(lignes(env.page).map(compact)).toEqual(SIX_PHRASES.map(compact));
  });

  it("critère 1 : given un leurre au poids (lipless), when j'ouvre son détail, then le poids est affiché et aucune ligne « Poids de tête » n'apparaît", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 2);

    const texte = compact(env.page.textContent);
    expect(texte).toContain(compact('Détail du conseil'));
    expect(texte).toContain(compact('Lipless (vibrant sans bavette)'));
    expect(texte).toContain(compact('Poids : 10 g'));
    expect(texte).not.toContain(compact('Poids de tête'));
    expect(texte).toContain(compact('Où le lancer : cassures, fond, piles de pont'));
    expect(lignes(env.page).map(compact)).toEqual([compact('Par eau froide, prends un modèle plutôt léger, autour de 10 g.')]);
  });

  it("critère 1 : given « Toutes les espèces » et un conseil retenu pour le brochet, when j'ouvre son détail, then les postes sont ceux du brochet", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 3);

    const texte = compact(env.page.textContent);
    expect(texte).toContain(compact('Animation : Twitching · espèce : brochet'));
    expect(texte).toContain(compact('Où le lancer : herbiers, bordures, bois noyés, cassures'));
    expect(texte).toContain(compact('Taille : 11,5 cm'));
  });

  it("critère 1 : given un conseil dont aucune règle n'est déclenchée, when j'ouvre son détail, then la phrase par défaut remplace la liste", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 3);

    expect(lignes(env.page).map(compact)).toEqual([
      compact("Aucune règle particulière ne s'applique dans ces conditions : c'est le meilleur choix par défaut pour ton espèce."),
    ]);
  });

  it("critère 1 : given le détail ouvert, when je regarde l'écran, then le dock est masqué (et revient au retour), un bouton de retour « Conseil » et un bouton « Voir l'animation » existent", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 1);

    expect(bouton(env.page, 'Conseil')).toBeDefined();
    expect(env.page.querySelector('nav[aria-label="Navigation"]')).toBeNull();
    expect(bouton(env.page, "Voir l'animation")).toBeDefined();

    bouton(env.page, 'Conseil').click();
    await env.stabiliser();
    expect(env.page.querySelector('nav[aria-label="Navigation"]')).not.toBeNull();
  });

  it("critère 2 : given le détail du shad ouvert, when je touche « Voir l'animation », then la fiche de l'animation « Tirée-relâchée » s'ouvre avec le geste, la vitesse, l'erreur à éviter et la vidéo à venir", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 1);
    bouton(env.page, "Voir l'animation").click();
    await env.stabiliser();

    const texte = compact(env.page.textContent);
    expect(texte).toContain(compact('Tirée-relâchée'));
    expect(texte).toContain(compact('Le geste'));
    expect(texte).toContain(compact('Laisse le leurre toucher le fond puis lève la canne.'));
    expect(texte).toContain(compact('Vitesse'));
    expect(texte).toContain(compact('Lente, avec une pause au fond à chaque tirée'));
    expect(texte).toContain(compact('Erreur à éviter'));
    expect(texte).toContain(compact('Laisser le fil détendu pendant la descente.'));
    expect(texte).not.toContain(compact("La vidéo de l'animation arrive bientôt."));
    expect(detailOuvert(env.page)).toBe(false);
  });

  it("critère 2 : given la fiche animation ouverte, when je touche « ‹ Détail », then je reviens au détail du conseil", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 1);
    bouton(env.page, "Voir l'animation").click();
    await env.stabiliser();
    bouton(env.page, 'Détail').click();
    await env.stabiliser();

    expect(detailOuvert(env.page)).toBe(true);
    expect(compact(env.page.textContent)).toContain(compact('Poids de tête : 5 à 10 g'));
  });

  it("critère 3 : given le détail ouvert après avoir choisi demain 10 h, when je touche « ‹ Conseil », then l'écran Conseil montre le même moment, la même espèce et le même top 3 sans nouveau calcul", async () => {
    const env = await ouvrirLApp();
    await choisirDemain10h(env);
    const avant = await top3(env);
    const momentAvant = compact(selecteurMoment(env.page).textContent);
    expect(avant).toHaveLength(3);
    expect(momentAvant).toContain(compact('Demain 10 h'));
    const moteurAvant = env.appelsMoteur.length;
    const releveAvant = env.appelsReleve.length;

    await ouvrirDetail(env, 2);
    expect(detailOuvert(env.page)).toBe(true);
    bouton(env.page, 'Conseil').click();
    await env.stabiliser();

    expect(detailOuvert(env.page)).toBe(false);
    expect(compact(selecteurMoment(env.page).textContent)).toBe(momentAvant);
    expect(compact(env.page.textContent)).toContain(compact('Toutes les espèces'));
    expect(await top3(env)).toEqual(avant);
    expect(env.appelsMoteur).toHaveLength(moteurAvant);
    expect(env.appelsReleve).toHaveLength(releveAvant);
    expect(compact(env.page.textContent)).not.toContain('Chargement');
    expect(compact(env.page.textContent)).not.toContain(compact('Calcul du conseil'));
  });

  it("critère 3 : given le détail ouvert, when je reviens en arrière avec le retour du navigateur, then l'écran Conseil réaffiche le même top 3 sans nouveau calcul", async () => {
    const env = await ouvrirLApp();
    const avant = await top3(env);
    const moteurAvant = env.appelsMoteur.length;
    const releveAvant = env.appelsReleve.length;

    await ouvrirDetail(env, 1);
    expect(detailOuvert(env.page)).toBe(true);
    TestBed.inject(Location).back();
    await new Promise((r) => setTimeout(r, 50));
    await env.stabiliser();

    expect(detailOuvert(env.page)).toBe(false);
    expect(await top3(env)).toEqual(avant);
    expect(env.appelsMoteur).toHaveLength(moteurAvant);
    expect(env.appelsReleve).toHaveLength(releveAvant);
  });
});

/** Choisit une espèce dans la feuille « Espèce visée ». */
async function choisirEspece(env: Env, nom: string): Promise<void> {
  const ouvrir = boutons(env.page).find((e) => !e.closest('[role="dialog"]') && compact(e.textContent).startsWith(compact('Espèce')))!;
  ouvrir.click();
  await env.stabiliser();
  const f = env.page.querySelector<HTMLElement>('[role="dialog"]')!;
  [...f.querySelectorAll<HTMLElement>('button')].find((e) => compact(e.textContent).includes(compact(nom)))!.click();
  await env.stabiliser();
}
const carteConditions = async (env: Env): Promise<string> => compact((await ouvrirConditions(env)).textContent);

describe('Détail d\'un conseil, revue (US 86)', () => {
  it("critère 3 : given une espèce choisie et un détail ouvert puis fermé, when je reviens, then la même espèce, le même top 3 et la même carte Conditions sont affichés sans nouveau calcul", async () => {
    const env = await ouvrirLApp();
    await choisirEspece(env, 'Sandre');
    const avant = await top3(env);
    const conditionsAvant = await carteConditions(env);
    expect(avant).toHaveLength(3);
    expect(conditionsAvant).toContain(compact('Conditions'));
    const moteurAvant = env.appelsMoteur.length;
    const releveAvant = env.appelsReleve.length;

    await ouvrirDetail(env, 1);
    bouton(env.page, 'Conseil').click();
    await env.stabiliser();

    expect(detailOuvert(env.page)).toBe(false);
    expect(compact(boutons(env.page).find((e) => compact(e.textContent).startsWith(compact('Espèce')))!.textContent)).toContain('Sandre');
    expect(await top3(env)).toEqual(avant);
    expect(await carteConditions(env)).toBe(conditionsAvant);
    expect(env.appelsMoteur).toHaveLength(moteurAvant);
    expect(env.appelsReleve).toHaveLength(releveAvant);
  });

  it("given le détail du coup 01 ouvert puis fermé, when je reviens, then le focus est sur le lien du coup 01", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 1);
    bouton(env.page, 'Conseil').click();
    await env.stabiliser();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.activeElement).toBe(env.page.querySelector('#coup-1'));
  });

  it("given le détail du coup 02 ouvert puis fermé, when je reviens, then le focus est sur « 2 autres coups »", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 2);
    bouton(env.page, 'Conseil').click();
    await env.stabiliser();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.activeElement).toBe(env.page.querySelector('#autres-coups'));
  });

  it("given trois coups, when je lis leurs liens, then chacun est nommé par le type de leurre de son coup", async () => {
    const env = await ouvrirLApp();
    await ouvrirAutresCoups(env);

    const noms = liensDesCoups(env.page).map((l) => compact(l.textContent));
    [compact('Shad'), compact('Lipless (vibrant sans bavette)'), compact('Minnow (jerkbait)')].forEach((nom, i) => expect(noms[i]).toContain(nom));
  });

  it("given « Toutes les espèces », when j'ouvre un détail, then le sous-titre se termine par « (espèce choisie : toutes) »", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 3);

    expect(compact(env.page.textContent)).toContain(compact('Animation : Twitching · espèce : brochet (espèce choisie : toutes)'));
  });

  it("given une espèce choisie, when j'ouvre un détail, then « espèce choisie » n'apparaît pas", async () => {
    const env = await ouvrirLApp();
    await choisirEspece(env, 'Sandre');
    await ouvrirDetail(env, 1);

    expect(compact(env.page.textContent)).toContain(compact('Animation : Tirée-relâchée · espèce : sandre'));
    expect(compact(env.page.textContent)).not.toContain(compact('espèce choisie'));
  });

  it("given un détail ouvert puis refermé, when je choisis un moment hors des heures légales et reviens en avant, then le détail redirige vers /conseil sans l'ancien conseil", async () => {
    const env = await ouvrirLApp();
    await ouvrirDetail(env, 1);
    TestBed.inject(Location).back();
    await new Promise((r) => setTimeout(r, 50));
    await env.stabiliser();

    // Demain 2 h : avant le lever du soleil (heures légales 7 h 02 – 18 h 31).
    selecteurMoment(env.page).click();
    await env.stabiliser();
    const f = env.page.querySelector<HTMLElement>('[role="dialog"]')!;
    const dans = (t: string) => [...f.querySelectorAll<HTMLElement>('button, ion-button, [role="radio"], label')].find((e) => compact(e.textContent) === compact(t))!;
    dans('Demain').click();
    await env.stabiliser();
    const select = [...f.querySelectorAll<HTMLSelectElement>('select')][0];
    select.value = [...select.options].find((o) => compact(o.textContent) === compact('2 h'))!.value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await env.stabiliser();
    dans('Valider').click();
    await env.stabiliser();
    expect(compact(env.page.textContent)).toContain(compact('Hors des heures légales'));

    TestBed.inject(Location).forward();
    await new Promise((r) => setTimeout(r, 50));
    await env.stabiliser();

    expect(TestBed.inject(Router).url).toBe('/conseil');
    expect(detailOuvert(env.page)).toBe(false);
    expect(compact(env.page.textContent)).not.toContain(compact('Poids de tête'));
    expect(compact(env.page.textContent)).not.toContain(compact('Pourquoi ce conseil'));
  });
});
