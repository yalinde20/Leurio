import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService } from './core/data/catalog.service';
import { ConditionsService } from './core/data/conditions.service';
import { PositionService } from './core/data/position.service';
import { App } from './app';
import { routes } from './app.routes';
import { SOURCE_TACKLE_BOX } from './core/data/tackle-box.service';

describe('App', () => {
  // US 89 : l'onboarding est terminé (fixture), l'app s'ouvre sur le Conseil.
  beforeEach(() => localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] })));
  afterEach(() => localStorage.clear());

  it('ouvre le Conseil avec son dock Boîte, Ma sortie, Spots et son avatar Compte, sans barre d\'onglets', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideIonicAngular(),
        { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
        provideRouter(routes),
        { provide: PositionService, useValue: { positionGps: () => new Promise(() => undefined) } },
        { provide: ConditionsService, useValue: {} },
        { provide: CatalogService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelectorAll('[role="tab"], ion-tab-bar')).toHaveLength(0);
    const dock = page.querySelector('nav[aria-label="Navigation"]');
    expect([...dock!.querySelectorAll('a, button')].map((e) => e.textContent?.trim())).toEqual(['Boîte', 'Ma sortie', 'Spots']);
    expect(page.querySelector('button[aria-label="Compte"]')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe('/conseil');
  });
});
