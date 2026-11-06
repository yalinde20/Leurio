import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService } from './core/data/catalog.service';
import { ConditionsService } from './core/data/conditions.service';
import { PositionService } from './core/data/position.service';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  it('affiche les 4 onglets Conseil, Boîte, Spots, Compte et ouvre le Conseil', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideIonicAngular(),
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
    const onglets = [...page.querySelectorAll('[role="tab"]')];
    expect(onglets.map((o) => o.textContent?.trim())).toEqual(['Conseil', 'Boîte', 'Spots', 'Compte']);
    expect(TestBed.inject(Router).url).toBe('/conseil');
  });
});
