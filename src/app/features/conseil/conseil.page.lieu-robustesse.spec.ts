/* US 87 : robustesse du choix de lieu (GPS en attente, refus, focus). Mêmes doubles que conseil.page.lieu.spec.ts. */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { CatalogService, Federation, TypeLeurre } from '../../core/data/catalog.service';
import { ConditionsService, DemandeConditions, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition, Spot } from '../../core/data/position.service';
import { SpotEnregistre, SpotsService } from '../../core/data/spots.service';
import { Conditions } from '../../core/engine/conditions';
import { Conseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';

const NANTES: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.22, longitude: -1.55, precisionM: 10, departement: '44' };
const REFUSEE: ResultatPosition = { disponible: false, motif: 'position refusée' };
const SOLEIL: SoleilDuJour = { lever: new Date('2026-11-11T06:32:00Z'), coucher: new Date('2026-11-11T17:01:00Z') };
const SEVRE: SpotEnregistre = { id: 's2', nom: 'La Sèvre à Clisson', lat: 47.09, lng: -1.28, categorie: 1, departement: '44' };
const TYPES = [
  { id: 'shad', nom: 'Shad' },
  { id: 'lame', nom: 'Lame vibrante' },
] as TypeLeurre[];
const conseil = (typeId: string): Conseil => ({
  typeId,
  techniqueId: 'tiree',
  especeCode: 'SAN',
  score: 1,
  pourquoi: ['Phrase.'],
  couleur: 'gardon',
  taille: { valeur: 8, unite: 'cm' },
});
const federation = { departement: '44', nom: 'Fédération 44', url: 'https://fedepeche44.fr' } as Federation;
const compact = (t: string | null | undefined) => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');

type Resolveur = (p: ResultatPosition) => void;

async function afficher(gps: (ResultatPosition | 'attente')[]) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
  const demandesGps: Resolveur[] = [];
  const releves: DemandeConditions[] = [];
  let n = 0;
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: SpotsService, useValue: { mesSpots: async () => [SEVRE] } },
      {
        provide: PositionService,
        useValue: {
          positionGps: () => {
            const reglage = gps[Math.min(n++, gps.length - 1)];
            if (reglage !== 'attente') return Promise.resolve(reglage);
            return new Promise<ResultatPosition>((resolve) => demandesGps.push(resolve));
          },
          positionSpot: async (spot: Spot): Promise<ResultatPosition> => ({
            disponible: true, source: 'spot', latitude: spot.lat, longitude: spot.lng, precisionM: null, departement: spot.departement,
          }),
        },
      },
      {
        provide: CatalogService,
        useValue: { federation: async () => federation, typesDeLeurres: async () => TYPES, animations: async () => [{ id: 'tiree', nom: 'Tirée' }], couleurs: async () => [{ id: 'gardon', nom: 'Gardon' }], especes: async () => [] },
      },
      {
        provide: ConditionsService,
        useValue: {
          releve: async (d: DemandeConditions): Promise<ReleveActuel> => {
            releves.push(d);
            return {
              conditions: { tempEau: d.spot ? 10.5 : 11.5, sourceTempEau: 'capteur', debitTendance: 'normal', pressionTendance48h: 0, nuages: 10, vent: 5, moment: 'jour', saison: 'automne', categorie: d.spot?.categorie ?? null, departement: d.spot?.departement ?? '44', niveau: 'debutant' },
              pressionHpa: 1012,
              moinsPrecis: false,
            };
          },
        },
      },
      { provide: AstroService, useValue: { soleil: () => SOLEIL, lune: (): LuneDuMoment => ({ phase: 'Pleine lune', fractionEclairee: 0.3 }) } },
      { provide: MoteurService, useValue: { conseiller: async (c: Conditions) => ({ conseils: [conseil(c.categorie === null ? 'shad' : 'lame')], explications: [] }) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  const stabiliser = async () => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  await stabiliser();
  return { page: fixture.nativeElement as HTMLElement, stabiliser, releves, demandesGps };
}
type Env = Awaited<ReturnType<typeof afficher>>;

afterEach(() => vi.useRealTimers());

const boutons = (page: HTMLElement) => [...page.querySelectorAll<HTMLButtonElement>('button')];
const boutonLieu = (page: HTMLElement) => boutons(page).find((b) => compact(b.textContent).startsWith('Lieu'))!;
const boutonMoment = (page: HTMLElement) => boutons(page).find((b) => compact(b.textContent).startsWith('Moment'))!;
async function ouvrir(env: Env) {
  boutonLieu(env.page).click();
  await env.stabiliser();
}
async function choisir(env: Env, nom: string) {
  [...env.page.querySelectorAll<HTMLElement>('[role="radio"]')].find((l) => compact(l.textContent).startsWith(compact(nom)))!.click();
  await env.stabiliser();
}

describe('ConseilPage : choix du lieu, robustesse (US 87)', () => {
  it('given un spot 1re catégorie choisi, when je rechoisis « Ma position » et que le GPS ne répond pas encore, then l\'écran est en chargement sans donnée ni bandeau du spot', async () => {
    const env = await afficher([NANTES, 'attente']);
    await ouvrir(env);
    await choisir(env, 'La Sèvre');
    expect(compact(env.page.textContent)).toContain(compact('1re catégorie hors saison'));
    await ouvrir(env);
    await choisir(env, 'Ma position');

    const texte = compact(env.page.textContent);
    expect(compact(boutonLieu(env.page).textContent)).toContain('Maposition');
    expect(texte).toContain(compact('Chargement des conditions…'));
    expect(texte).toContain(compact('Calcul du conseil…'));
    expect(texte).not.toContain(compact('Lame vibrante'));
    expect(texte).not.toContain(compact('10,5'));
    expect(texte).not.toContain(compact('1re catégorie hors saison'));
    expect(env.page.querySelector('app-bandeau-reglementation')).toBeNull();
    expect(boutonMoment(env.page).disabled).toBe(true);
  });

  it('given la localisation refusée et « Ma position » déjà affichée, when je rechoisis « Ma position », then le GPS est redemandé', async () => {
    const env = await afficher([REFUSEE, NANTES]);
    expect(compact(env.page.textContent)).toContain(compact('Position introuvable'));
    await ouvrir(env);
    await choisir(env, 'Ma position');

    expect(compact(env.page.textContent)).not.toContain(compact('Position introuvable'));
    expect(env.releves).toHaveLength(1);
  });

  it('given la feuille ouverte, when je choisis un spot ou j\'annule, then le focus revient au bouton « Lieu »', async () => {
    const env = await afficher([NANTES]);
    document.body.appendChild(env.page);
    await ouvrir(env);
    await choisir(env, 'La Sèvre');
    expect(document.activeElement).toBe(boutonLieu(env.page));

    (document.activeElement as HTMLElement).blur();
    await ouvrir(env);
    [...env.page.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => compact(b.textContent) === 'Annuler')!.click();
    await env.stabiliser();
    expect(document.activeElement).toBe(boutonLieu(env.page));
    env.page.remove();
  });

  it('given le GPS initial encore en attente, when je choisis un spot, then le spot l\'emporte même si le GPS répond ensuite', async () => {
    const env = await afficher(['attente']);
    await ouvrir(env);
    await choisir(env, 'La Sèvre');

    expect(env.releves.at(-1)?.spot).toEqual({ categorie: 1, departement: '44' });
    expect(compact(boutonLieu(env.page).textContent)).toContain(compact('La Sèvre'));
    env.demandesGps[0](NANTES);
    await env.stabiliser();
    expect(env.releves.every((r) => r.spot !== undefined)).toBe(true);
    expect(compact(boutonLieu(env.page).textContent)).toContain(compact('La Sèvre'));
    expect(compact(env.page.textContent)).toContain(compact('Lame vibrante'));
  });
});
