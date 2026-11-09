/* US 83 : choix rapide d'espèces, focus et Escape de la feuille « Espèce visée ». */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsService } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService } from '../../core/data/position.service';
import { Conditions } from '../../core/engine/conditions';
import { ResultatConseil } from '../../core/engine/scorer';
import { ConseilPage } from './conseil.page';

const CONDITIONS = {
  tempEau: 11.5, sourceTempEau: 'capteur', debitTendance: 'normal', pressionTendance48h: 0, nuages: 10, vent: 5,
  moment: 'jour', saison: 'automne', categorie: null, departement: '49', niveau: 'debutant',
} as Conditions;
const ESPECES = [
  { code: 'BRO', nom: 'Brochet' },
  { code: 'SAN', nom: 'Sandre' },
];
const resultat = (typeId: string): ResultatConseil => ({
  conseils: [{ typeId, techniqueId: 't', especeCode: 'X', score: 1, pourquoi: ['Ok.'], couleur: 'c', taille: null }],
  explications: [],
});

async function afficher(nuit = false, federation: Promise<undefined> = Promise.resolve(undefined)) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(nuit ? '2026-11-09T23:00:00Z' : '2026-11-09T12:00:00Z'));
  const appels: (string | undefined)[] = [];
  const attentes = new Map<string, (r: ResultatConseil) => void>();
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: PositionService, useValue: { positionGps: async () => ({ disponible: true, source: 'gps', latitude: 47, longitude: -0.5, precisionM: 1, departement: '49' }) } },
      { provide: CatalogService, useValue: {
        federation: () => federation,
        typesDeLeurres: async () => [{ id: 'bro', nom: 'Pour brochet' }, { id: 'san', nom: 'Pour sandre' }, { id: 'tous', nom: 'Pour tous' }],
        animations: async () => [{ id: 't', nom: 'Anim' }],
        couleurs: async () => [{ id: 'c', nom: 'Coul' }],
        especes: async () => ESPECES,
      } },
      { provide: ConditionsService, useValue: { releve: async () => ({ conditions: CONDITIONS, pressionHpa: 1012, moinsPrecis: false }) } },
      { provide: AstroService, useValue: {
        soleil: () => ({ lever: new Date('2026-11-09T06:32:00Z'), coucher: new Date('2026-11-09T17:01:00Z') }),
        lune: () => ({ phase: 'Lune', fractionEclairee: 0.3 }),
      } },
      { provide: MoteurService, useValue: {
        conseiller: (c: Conditions) =>
          (appels.push(c.especeCible), c.especeCible) === undefined
            ? Promise.resolve(resultat('tous'))
            : new Promise<ResultatConseil>((fin) => attentes.set(c.especeCible!, fin)),
      } },
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
  const page = fixture.nativeElement as HTMLElement;
  const bouton = () =>
    [...page.querySelectorAll<HTMLElement>('button.selecteur')].find((b) => b.textContent?.includes('Espèce'))!;
  const ligne = (nom: string) =>
    [...page.querySelectorAll<HTMLElement>('[role="radio"]')].find((l) => l.textContent?.includes(nom))!;
  return { page, attentes, appels,  stabiliser, bouton, ligne };
}

afterEach(() => vi.useRealTimers());

describe('ConseilPage : feuille « Espèce visée » (US 83)', () => {
  it('given deux espèces choisies coup sur coup, when la première répond en dernier, then le conseil de la dernière choisie reste affiché', async () => {
    const env = await afficher();
    env.bouton().click();
    await env.stabiliser();
    env.ligne('Brochet').click();
    await env.stabiliser();
    env.bouton().click();
    await env.stabiliser();
    env.ligne('Sandre').click();
    await env.stabiliser();
    expect(env.page.textContent).toContain('Calcul du conseil…');

    env.attentes.get('SAN')!(resultat('san'));
    await env.stabiliser();
    env.attentes.get('BRO')!(resultat('bro'));
    await env.stabiliser();

    expect(env.page.textContent).toContain('Pour sandre');
    expect(env.page.textContent).not.toContain('Pour brochet');
  });

  it('given la feuille ouverte, when elle s\'affiche, then le focus y entre, et Escape la ferme en rendant le focus au bouton', async () => {
    const env = await afficher();
    expect(env.bouton().getAttribute('aria-haspopup')).toBe('dialog');
    env.bouton().click();
    await env.stabiliser();
    const dialogue = env.page.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialogue.contains(document.activeElement)).toBe(true);

    dialogue.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await env.stabiliser();

    expect(env.page.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(env.bouton());
  });

  it('given hors des heures légales, when je choisis une espèce (y compris pendant le chargement de la fédération), then l\'avertissement reste et le moteur n\'est pas appelé pour l\'espèce', async () => {
    let fin!: () => void;
    const env = await afficher(true, new Promise<undefined>((r) => (fin = () => r(undefined))));
    env.bouton().click();
    await env.stabiliser();
    env.ligne('Sandre').click();
    await env.stabiliser();
    fin();
    await env.stabiliser();
    env.bouton().click();
    await env.stabiliser();
    env.ligne('Brochet').click();
    await env.stabiliser();

    expect(env.page.textContent).toContain('Hors des heures légales');
    expect(env.page.textContent).not.toContain('Pour');
    expect(env.appels).toEqual([]);
  });
});
