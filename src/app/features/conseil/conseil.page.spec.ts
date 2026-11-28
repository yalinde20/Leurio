import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { ConditionsService } from '../../core/data/conditions.service';
import { PositionService } from '../../core/data/position.service';
import { ConseilPage } from './conseil.page';

describe('ConseilPage', () => {
  it('affiche le lieu comme titre « Ma position »', async () => {
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
    // US 295 : plus de barre de titre, le titre de l'écran est le lieu.
    expect(page.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Lieu : Ma position');
  });
});
