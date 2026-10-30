import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { SpotsPage } from './spots.page';

describe('SpotsPage', () => {
  it('affiche seulement son titre « Spots »', async () => {
    await TestBed.configureTestingModule({ imports: [SpotsPage], providers: [provideIonicAngular()] }).compileComponents();
    const fixture = TestBed.createComponent(SpotsPage);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Spots');
    expect(page.querySelector('ion-content')?.textContent?.trim()).toBe('');
  });
});
