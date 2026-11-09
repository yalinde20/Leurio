/*
 * US 82 : un moment choisi vaut pour toute son heure. Quand une borne des heures légales tombe dans cette heure,
 * une ligne au-dessus du top 3 le dit. Maintenant = lundi 9 novembre 2026, 14 h à Paris ; heures légales 7 h 02 – 18 h 31 chaque jour.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsService } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService } from '../../core/data/position.service';
import { Conseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';

const JOUR_MS = 24 * 3600 * 1000;
const compact = (t: string | null | undefined) => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');
const conseil = (typeId: string): Conseil =>
  ({ typeId, techniqueId: 'tiree', especeCode: 'SAN', score: 1, pourquoi: ['Raison.'], couleur: 'gardon', taille: null }) as Conseil;

async function afficher() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T13:00:00Z'));
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      {
        provide: PositionService,
        useValue: { positionGps: async () => ({ disponible: true, source: 'gps', latitude: 47, longitude: -0.5, precisionM: 10, departement: '49' }) },
      },
      {
        provide: CatalogService,
        useValue: { federation: async () => undefined, typesDeLeurres: async () => [], animations: async () => [], couleurs: async () => [] },
      },
      {
        provide: ConditionsService,
        useValue: {
          releve: async () => ({
            conditions: { tempEau: 10, sourceTempEau: 'capteur', debitTendance: 'normal', pressionTendance48h: 0, nuages: 0, vent: 5, moment: 'jour', saison: 'automne', categorie: null, departement: '49', niveau: 'debutant' },
            pressionHpa: 1010,
            moinsPrecis: false,
          }),
        },
      },
      {
        provide: AstroService,
        useValue: {
          soleil: (_lieu: unknown, moment: Date) => {
            const jours = Math.floor(moment.getTime() / JOUR_MS) - Math.floor(new Date('2026-11-09T00:00:00Z').getTime() / JOUR_MS);
            return {
              lever: new Date(new Date('2026-11-09T06:32:00Z').getTime() + jours * JOUR_MS),
              coucher: new Date(new Date('2026-11-09T17:01:00Z').getTime() + jours * JOUR_MS),
            };
          },
          lune: () => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      { provide: MoteurService, useValue: { conseiller: async () => ({ conseils: [conseil('a'), conseil('b'), conseil('c')], explications: [] }) } },
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
  return { page: fixture.nativeElement as HTMLElement, stabiliser };
}

const bouton = (racine: ParentNode, texte: string) =>
  [...racine.querySelectorAll<HTMLButtonElement>('button')].find((b) => compact(b.textContent) === compact(texte))!;

async function choisirDemain(env: Awaited<ReturnType<typeof afficher>>, heure: number) {
  env.page.querySelector<HTMLButtonElement>('button.selecteur')!.click();
  await env.stabiliser();
  const dialogue = env.page.querySelector<HTMLElement>('[role="dialog"]')!;
  bouton(dialogue, 'Demain').click();
  await env.stabiliser();
  const select = dialogue.querySelector('select')!;
  select.value = String(heure);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await env.stabiliser();
  bouton(dialogue, 'Valider').click();
  await env.stabiliser();
}

const nbCartes = (page: HTMLElement) => page.querySelectorAll('article').length;

afterEach(() => vi.useRealTimers());

describe('ConseilPage : bornes des heures légales dans l\'heure choisie (US 82)', () => {
  it('given demain 7 h et un début à 7 h 02, when je valide, then les 3 cartes et « Pêche légale à partir de 7 h 02 »', async () => {
    const env = await afficher();
    await choisirDemain(env, 7);
    expect(nbCartes(env.page)).toBe(3);
    expect(compact(env.page.textContent)).toContain(compact('Pêche légale à partir de 7 h 02'));
  });

  it('given demain 6 h et un début à 7 h 02, when je valide, then l\'avertissement de nuit sans carte ni ligne', async () => {
    const env = await afficher();
    await choisirDemain(env, 6);
    expect(nbCartes(env.page)).toBe(0);
    expect(compact(env.page.textContent)).toContain(compact('Hors des heures légales'));
    expect(compact(env.page.textContent)).not.toContain(compact('Pêche légale'));
  });

  it('given demain 18 h et une fin à 18 h 31, when je valide, then les 3 cartes et « Pêche légale jusqu\'à 18 h 31 »', async () => {
    const env = await afficher();
    await choisirDemain(env, 18);
    expect(nbCartes(env.page)).toBe(3);
    expect(compact(env.page.textContent)).toContain(compact("Pêche légale jusqu'à 18 h 31"));
  });

  it('given demain 12 h, when je valide, then les 3 cartes sans ligne de limite', async () => {
    const env = await afficher();
    await choisirDemain(env, 12);
    expect(nbCartes(env.page)).toBe(3);
    expect(compact(env.page.textContent)).not.toContain(compact('Pêche légale'));
  });
});
