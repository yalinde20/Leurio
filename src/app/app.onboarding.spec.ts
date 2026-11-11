/*
 * US 89 : l'onboarding dans l'app réelle (App + routes). Contrat :
 *   - route `onboarding` hors des onglets ; tant que `OnboardingStore.lire()` rend null, toute adresse des onglets redirige vers /onboarding ;
 *   - une fois l'onboarding terminé, /onboarding redirige vers /conseil ;
 *   - l'onboarding est en plein écran : pas de barre d'onglets.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { App } from './app';
import { routes } from './app.routes';
import { CatalogService } from './core/data/catalog.service';
import { ConditionsService } from './core/data/conditions.service';
import { PositionService } from './core/data/position.service';

async function ouvrir(url: string, onboarding: string | null) {
  localStorage.clear();
  if (onboarding !== null) localStorage.setItem('leurio.onboarding', onboarding);
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideIonicAngular(),
      provideRouter(routes),
      { provide: PositionService, useValue: { positionGps: () => new Promise(() => undefined) } },
      { provide: ConditionsService, useValue: {} },
      { provide: CatalogService, useValue: { especes: async () => [{ code: 'BRO', nom: 'Brochet' }] } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(App);
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  await fixture.whenStable();
  fixture.detectChanges();
  return { page: fixture.nativeElement as HTMLElement, router };
}

const TERMINE = JSON.stringify({ niveau: 'debutant', especesFavorites: [] });

describe('App et onboarding (US 89)', () => {
  afterEach(() => localStorage.clear());

  it("critère 1 : given je lance l'app pour la première fois, when elle s'ouvre, then la page 1 de l'onboarding s'affiche en plein écran, sans barre d'onglets", async () => {
    const { page, router } = await ouvrir('/', null);

    expect(router.url).toBe('/onboarding');
    expect(page.textContent).toContain('Leurio, ton conseil de pêche au leurre');
    expect(page.querySelectorAll('[role="tab"]')).toHaveLength(0);
  });

  it("critère 1 : given un premier lancement, when j'ouvre l'adresse d'un onglet (/spots), then l'onboarding s'affiche à la place", async () => {
    const { router } = await ouvrir('/spots', null);

    expect(router.url).toBe('/onboarding');
  });

  it("critère 8 : given j'ai terminé l'onboarding, when je relance l'app, then l'écran « Conseil » s'affiche directement, sans onboarding", async () => {
    const { page, router } = await ouvrir('/', TERMINE);

    expect(router.url).toBe('/conseil');
    expect(page.textContent).not.toContain('Leurio, ton conseil de pêche au leurre');
    expect(page.querySelectorAll('[role="tab"]')).toHaveLength(4);
  });

  it("critère 8 : given j'ai terminé l'onboarding, when j'ouvre l'adresse /onboarding, then je suis renvoyé vers l'écran « Conseil »", async () => {
    const { router } = await ouvrir('/onboarding', TERMINE);

    expect(router.url).toBe('/conseil');
  });
});
