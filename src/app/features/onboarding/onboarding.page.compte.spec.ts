/*
 * US 90 : à la fin de l'onboarding, OnboardingPage appelle CompteService.assurerCompte(choix de la page 2) sans l'attendre
 * et sans aucun message. Pas de vue nouvelle.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService } from '../../core/data/catalog.service';
import { CompteService } from '../../core/data/compte.service';
import { PositionService } from '../../core/data/position.service';
import { OnboardingPage } from './onboarding.page';

const ESPECES = [
  { code: 'BRO', nom: 'Brochet' },
  { code: 'TRU', nom: 'Truite des lacs' },
  { code: 'SAN', nom: 'Sandre' },
];

const texte = (e: Element | null | undefined): string => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();

async function afficher(assurerCompte: () => Promise<void>) {
  localStorage.clear();
  const appels: unknown[] = [];
  await TestBed.configureTestingModule({
    imports: [OnboardingPage],
    providers: [
      provideIonicAngular(),
      provideRouter([]),
      { provide: CatalogService, useValue: { especes: async () => ESPECES } },
      { provide: PositionService, useValue: { positionGps: async () => ({ disponible: false, motif: 'position refusée' }) } },
      {
        provide: CompteService,
        useValue: {
          assurerCompte: (choix: unknown) => {
            appels.push(choix);
            return assurerCompte();
          },
        },
      },
    ],
  }).compileComponents();
  const navigations: unknown[] = [];
  vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(async (url) => {
    navigations.push(url);
    return true;
  });
  const fixture = TestBed.createComponent(OnboardingPage);
  const page = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await stabiliser();
  const toucher = async (selecteur: string, nom: string) => {
    const e = [...page.querySelectorAll<HTMLElement>(selecteur)].find((x) => texte(x).startsWith(nom));
    expect(e, `« ${nom} »`).toBeDefined();
    e!.click();
    await stabiliser();
  };
  // Page 1 -> page 2 (Brochet, Sandre, Intermédiaire) -> page 3.
  await toucher('button', 'Suivant');
  await toucher('[role="checkbox"]', 'Sandre');
  await toucher('[role="checkbox"]', 'Brochet');
  await toucher('[role="radio"]', 'Intermédiaire');
  await toucher('button', 'Suivant');
  return { page, appels, navigations, toucher, stabiliser };
}

const sansMessage = (page: HTMLElement) => {
  expect(page.querySelector('[role="alert"], ion-toast, ion-alert, ion-modal, [role="dialog"]')).toBeNull();
};

describe('OnboardingPage et compte anonyme (US 90)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("critère 1 : given j'ai du réseau, when je termine l'onboarding avec « Plus tard », then assurerCompte reçoit le niveau et les espèces de la page 2 (dans l'ordre du contenu), j'arrive sur « Conseil » et aucun message n'apparaît", async () => {
    const { page, appels, navigations, toucher } = await afficher(async () => undefined);

    await toucher('button', 'Plus tard');

    expect(appels).toEqual([{ niveau: 'intermediaire', especesFavorites: ['BRO', 'SAN'] }]);
    expect(navigations).toContain('/conseil');
    sansMessage(page);
  });

  it("critère 1 : given j'ai du réseau, when je termine l'onboarding avec « Autoriser la localisation », then assurerCompte est appelé avec les mêmes choix", async () => {
    const { appels, navigations, toucher } = await afficher(async () => undefined);

    await toucher('button', 'Autoriser la localisation');

    expect(appels).toEqual([{ niveau: 'intermediaire', especesFavorites: ['BRO', 'SAN'] }]);
    expect(navigations).toContain('/conseil');
  });

  it("critère 3 : given je n'ai pas de réseau (assurerCompte reste en attente), when je termine l'onboarding, then j'arrive sur « Conseil » sans attendre", async () => {
    const { page, appels, navigations, toucher } = await afficher(() => new Promise<void>(() => undefined));

    await toucher('button', 'Plus tard');

    expect(appels).toHaveLength(1);
    expect(navigations).toContain('/conseil');
    sansMessage(page);
  });

  it("critère 4 : given la création du compte échoue (assurerCompte rejette), when je termine l'onboarding, then j'arrive sur « Conseil » sans message bloquant", async () => {
    const { page, appels, navigations, toucher } = await afficher(() => Promise.reject(new Error('échec')));

    await toucher('button', 'Plus tard');

    expect(appels).toHaveLength(1);
    expect(navigations).toContain('/conseil');
    sansMessage(page);
  });
});
