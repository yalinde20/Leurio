/*
 * US 82 + US 83 ensemble : le moment et l'esp√®ce se combinent, dans n'importe quel ordre.
 * Maintenant = lundi 9 novembre 2026, 14 h √  Paris (13:00Z). Demain 7 h = 2026-11-10T06:00Z, dans les heures l√©gales 7 h 02   ì 18 h 31.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService, LuneDuMoment, SoleilDuJour } from '../../core/data/astro.service';
import { CatalogService, Espece } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { Conditions } from '../../core/engine/conditions';
import especesReelles from '../../../assets/data/species.json';
import { ConseilPage } from './conseil.page';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};
const MAINTENANT = new Date('2026-11-09T13:00:00Z');
const DEMAIN_7H = new Date('2026-11-10T06:00:00Z');
const JOUR_MS = 24 * 3600 * 1000;
const LEVER_DU_9 = new Date('2026-11-09T06:32:00Z');
const COUCHER_DU_9 = new Date('2026-11-09T17:01:00Z');
const soleilDu = (moment: Date): SoleilDuJour => {
  const jours = Math.floor(moment.getTime() / JOUR_MS) - Math.floor(LEVER_DU_9.getTime() / JOUR_MS);
  return {
    lever: new Date(LEVER_DU_9.getTime() + jours * JOUR_MS),
    coucher: new Date(COUCHER_DU_9.getTime() + jours * JOUR_MS),
  };
};

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

async function afficher() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  const appelsMoteur: { moment: Date; especeCible: string | undefined }[] = [];
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      {
        provide: CatalogService,
        useValue: {
          federation: async () => undefined,
          typesDeLeurres: async () => [{ id: 'shad', nom: 'Shad' }],
          animations: async () => [{ id: 'tiree', nom: 'Tir√©e-rel√¢ch√©e' }],
          couleurs: async () => [{ id: 'gardon', nom: 'Gardon' }],
          especes: async () => especesReelles as unknown as Espece[],
        },
      },
      {
        provide: ConditionsService,
        useValue: {
          releve: async (): Promise<ReleveActuel> => ({ conditions: { ...CONDITIONS }, pressionHpa: 1012, moinsPrecis: false }),
        },
      },
      {
        provide: AstroService,
        useValue: {
          soleil: (_lieu: unknown, moment: Date): SoleilDuJour => soleilDu(moment),
          lune: (): LuneDuMoment => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      {
        provide: MoteurService,
        useValue: {
          conseiller: async (conditions: Conditions, moment: Date) => {
            appelsMoteur.push({ moment, especeCible: conditions.especeCible });
            return {
              conseils: [
                { typeId: 'shad', techniqueId: 'tiree', especeCode: 'SAN', score: 9, pourquoi: ['Phrase.'], couleur: 'gardon', taille: { valeur: 8, unite: 'cm' } },
              ],
              explications: [],
            };
          },
        },
      },
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
  return { page: fixture.nativeElement as HTMLElement, stabiliser, appelsMoteur };
}

afterEach(() => vi.useRealTimers());

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s     ]/g, '');
const boutons = (page: HTMLElement): HTMLElement[] => [...page.querySelectorAll<HTMLElement>('button')];
const feuille = (page: HTMLElement): HTMLElement => {
  const f = page.querySelector<HTMLElement>('[role="dialog"]');
  if (!f) throw new Error('aucune feuille ouverte');
  return f;
};

async function toucher(env: Awaited<ReturnType<typeof afficher>>, element: HTMLElement | undefined): Promise<void> {
  if (!element) throw new Error('√©l√©ment introuvable');
  element.click();
  await env.stabiliser();
}
const selecteur = (env: Awaited<ReturnType<typeof afficher>>, mot: string) =>
  boutons(env.page).find((b) => !b.closest('[role="dialog"]') && compact(b.textContent).startsWith(compact(mot)));
const dansFeuille = (env: Awaited<ReturnType<typeof afficher>>, texte: string) =>
  [...feuille(env.page).querySelectorAll<HTMLElement>('button, [role="radio"], label')].find((e) => compact(e.textContent).startsWith(compact(texte)));

async function choisirDemain7h(env: Awaited<ReturnType<typeof afficher>>): Promise<void> {
  await toucher(env, selecteur(env, 'Moment'));
  await toucher(env, dansFeuille(env, 'Demain'));
  const select = feuille(env.page).querySelector<HTMLSelectElement>('select');
  const option = [...(select?.options ?? [])].find((o) => compact(o.textContent) === compact('7 h'));
  if (!select || !option) throw new Error('select Heure introuvable');
  select.value = option.value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await env.stabiliser();
  await toucher(env, dansFeuille(env, 'Valider'));
}
async function choisirSandre(env: Awaited<ReturnType<typeof afficher>>): Promise<void> {
  await toucher(env, selecteur(env, 'Esp√®ce'));
  await toucher(env, dansFeuille(env, 'Sandre'));
}

describe('ConseilPage : moment et esp√®ce ensemble (US 82 + US 83)', () => {
  it("given  ´ Demain 7 h  ª choisi, when je choisis  ´ Sandre  ª, then le moteur re√ßoit le moment de demain 7 h et l'esp√®ce SAN", async () => {
    const env = await afficher();
    await choisirDemain7h(env);
    await choisirSandre(env);

    const dernier = env.appelsMoteur.at(-1);
    expect(dernier?.moment.getTime()).toBe(DEMAIN_7H.getTime());
    expect(dernier?.especeCible).toBe('SAN');
    expect(compact(selecteur(env, 'Moment')?.textContent)).toContain(compact('Demain 7 h'));
    expect(compact(selecteur(env, 'Esp√®ce')?.textContent)).toContain('Sandre');
  });

  it("given  ´ Sandre  ª et  ´ Demain 7 h  ª choisis, when je choisis  ´ Maintenant  ª, then l'esp√®ce SAN est gard√©e pour le moment pr√©sent", async () => {
    const env = await afficher();
    await choisirSandre(env);
    await choisirDemain7h(env);
    expect(env.appelsMoteur.at(-1)).toMatchObject({ especeCible: 'SAN' });
    expect(env.appelsMoteur.at(-1)?.moment.getTime()).toBe(DEMAIN_7H.getTime());

    await toucher(env, selecteur(env, 'Moment'));
    await toucher(env, dansFeuille(env, 'Maintenant'));

    const dernier = env.appelsMoteur.at(-1);
    expect(dernier?.moment.getTime()).toBe(MAINTENANT.getTime());
    expect(dernier?.especeCible).toBe('SAN');
    expect(compact(selecteur(env, 'Esp√®ce')?.textContent)).toContain('Sandre');
  });
});
