import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { Geolocalisation, GEOLOCALISATION } from '../../core/data/position.service';
import { SOURCE_SPOTS } from '../../core/data/spots.service';
import { SpotsPage } from './spots.page';

describe('SpotsPage', () => {
  it('affiche son titre « Spots »', async () => {
    const geolocalisation: Geolocalisation = {
      checkPermissions: async () => ({ location: 'denied' }),
      getCurrentPosition: async () => {
        throw Object.assign(new Error('refusée'), { code: 1 });
      },
    };
    await TestBed.configureTestingModule({
      imports: [SpotsPage],
      providers: [
        provideIonicAngular(),
        { provide: GEOLOCALISATION, useValue: geolocalisation },
        { provide: SOURCE_SPOTS, useValue: { uid: async () => 'A', documents: async () => [] } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SpotsPage);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Spots');
  });
});
