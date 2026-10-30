import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { BoitePage } from './boite.page';

describe('BoitePage', () => {
  it('affiche seulement son titre « Boîte »', async () => {
    await TestBed.configureTestingModule({ imports: [BoitePage], providers: [provideIonicAngular()] }).compileComponents();
    const fixture = TestBed.createComponent(BoitePage);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Boîte');
    expect(page.querySelector('ion-content')?.textContent?.trim()).toBe('');
  });
});
