/*
 * US 82 : robustesse du sélecteur de moment. Sélecteur inactif sans position, résultat tardif ignoré, accessibilité de la feuille.
 * Maintenant = lundi 9 novembre 2026, 14 h à Paris. Même contrat du DOM que conseil.page.moment.spec.ts.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsService, ReleveActuel } from '../../core/data/conditions.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { Conditions } from '../../core/engine/conditions';
import { ConseilPage } from './conseil.page';

const ANGERS: ResultatPosition = {
  disponible: true,
  source: 'gps',
  latitude: 47.47,
  longitude: -0.55,
  precisionM: 10,
  departement: '49',
};
const MAINTENANT = new Date('2026-11-09T13:00:00Z');

const releveAvecEau = (tempEau: number): ReleveActuel => ({
  conditions: {
    tempEau,
    sourceTempEau: 'capteur',
    debitTendance: 'normal',
    pressionTendance48h: 0,
    nuages: 10,
    vent: 5,
    moment: 'jour',
    saison: 'automne',
    categorie: null,
    departement: '49',
    niveau: 'debutant',
  } as Conditions,
  pressionHpa: 1012,
  moinsPrecis: false,
});

const compact = (t: string | null | undefined) => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');

async function afficher(position: Promise<ResultatPosition> | ResultatPosition, releve: (moment: Date) => Promise<ReleveActuel>) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MAINTENANT);
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      { provide: PositionService, useValue: { positionGps: () => Promise.resolve(position) } },
      {
        provide: CatalogService,
        useValue: {
          federation: async () => undefined,
          typesDeLeurres: async () => [],
          animations: async () => [],
          couleurs: async () => [],
        },
      },
      { provide: ConditionsService, useValue: { releve: ({ moment }: { moment: Date }) => releve(moment) } },
      {
        provide: AstroService,
        useValue: {
          soleil: () => ({ lever: new Date('2026-11-09T06:32:00Z'), coucher: new Date('2026-11-09T17:01:00Z') }),
          lune: () => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }),
        },
      },
      { provide: MoteurService, useValue: { conseiller: async () => ({ conseils: [], explications: [] }) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  const stabiliser = async () => {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  fixture.detectChanges();
  return { page: fixture.nativeElement as HTMLElement, stabiliser };
}

const selecteur = (page: HTMLElement) => page.querySelector<HTMLButtonElement>('button.selecteur')!;
const feuille = (page: HTMLElement) => page.querySelector<HTMLElement>('[role="dialog"]');
const bouton = (racine: ParentNode, texte: string) =>
  [...racine.querySelectorAll<HTMLButtonElement>('button')].find((b) => compact(b.textContent) === compact(texte))!;

async function choisirEtValider(env: Awaited<ReturnType<typeof afficher>>, jour: string, heure: number) {
  selecteur(env.page).click();
  await env.stabiliser();
  bouton(feuille(env.page)!, jour).click();
  await env.stabiliser();
  const select = feuille(env.page)!.querySelector('select')!;
  select.value = String(heure);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await env.stabiliser();
  bouton(feuille(env.page)!, 'Valider').click();
  await env.stabiliser();
}

afterEach(() => vi.useRealTimers());

describe('ConseilPage : moment du conseil, robustesse (US 82)', () => {
  it('given la position pas encore connue, when je regarde le sélecteur, then il est inactif puis actif une fois la position connue', async () => {
    let donner!: (p: ResultatPosition) => void;
    const env = await afficher(new Promise<ResultatPosition>((r) => (donner = r)), async () => releveAvecEau(11.5));
    await env.stabiliser();
    expect(selecteur(env.page).disabled).toBe(true);

    donner(ANGERS);
    await env.stabiliser();
    expect(selecteur(env.page).disabled).toBe(false);
  });

  it('given « position introuvable », when je regarde le sélecteur, then il reste inactif', async () => {
    const env = await afficher({ disponible: false } as ResultatPosition, async () => releveAvecEau(11.5));
    await env.stabiliser();
    expect(compact(env.page.textContent)).toContain(compact('Position introuvable'));
    expect(selecteur(env.page).disabled).toBe(true);
  });

  it('given deux choix rapprochés dont le premier relevé répond après le second, when tout est résolu, then le second choix l\'emporte', async () => {
    const attentes = new Map<number, (r: ReleveActuel) => void>();
    const env = await afficher(ANGERS, (moment) =>
      moment.getTime() === MAINTENANT.getTime()
        ? Promise.resolve(releveAvecEau(11.5))
        : new Promise<ReleveActuel>((r) => attentes.set(moment.getTime(), r)),
    );
    await env.stabiliser();

    await choisirEtValider(env, 'Demain', 7); // relevé en attente
    await choisirEtValider(env, 'Demain', 8); // relevé en attente aussi
    attentes.get(new Date('2026-11-10T07:00:00Z').getTime())!(releveAvecEau(8)); // demain 8 h : le plus récent
    await env.stabiliser();
    attentes.get(new Date('2026-11-10T06:00:00Z').getTime())!(releveAvecEau(7)); // demain 7 h arrive en retard
    await env.stabiliser();

    expect(compact(selecteur(env.page).textContent)).toContain(compact('Demain 8 h'));
    expect(compact(env.page.textContent)).toContain(compact("Température de l'eau : 8 °C"));
    expect(compact(env.page.textContent)).not.toContain(compact("Température de l'eau : 7 °C"));
  });

  it('given la feuille ouverte, when elle s\'affiche, then le sélecteur annonce un dialogue et le focus entre dans la feuille', async () => {
    const env = await afficher(ANGERS, async () => releveAvecEau(11.5));
    await env.stabiliser();
    document.body.appendChild(env.page);
    expect(selecteur(env.page).getAttribute('aria-haspopup')).toBe('dialog');

    selecteur(env.page).click();
    await env.stabiliser();
    expect(feuille(env.page)!.contains(document.activeElement)).toBe(true);
    env.page.remove();
  });

  it('given la feuille ouverte, when j\'appuie sur Échap, then elle se ferme et le focus revient au sélecteur', async () => {
    const env = await afficher(ANGERS, async () => releveAvecEau(11.5));
    await env.stabiliser();
    document.body.appendChild(env.page);
    selecteur(env.page).click();
    await env.stabiliser();

    feuille(env.page)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await env.stabiliser();
    expect(feuille(env.page)).toBeNull();
    expect(document.activeElement).toBe(selecteur(env.page));
    env.page.remove();
  });
});
