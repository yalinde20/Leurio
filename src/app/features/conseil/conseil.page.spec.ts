import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsService } from '../../core/data/conditions.service';
import { PositionService } from '../../core/data/position.service';
import { ConseilPage } from './conseil.page';

describe('ConseilPage', () => {
  it('affiche son titre « Conseil »', async () => {
    await TestBed.configureTestingModule({
      imports: [ConseilPage],
      providers: [
        provideIonicAngular(),
        { provide: PositionService, useValue: { positionGps: () => new Promise(() => undefined) } },
        { provide: ConditionsService, useValue: {} },
        { provide: AstroService, useValue: {} },
        { provide: CatalogService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ConseilPage);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Conseil');
  });
});
