import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { App } from './app';

describe('App', () => {
  it('affiche une barre d\'outils titrée « Leurio » et un contenu vide', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideIonicAngular()],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Leurio');
    expect(page.querySelector('ion-content')).not.toBeNull();
  });
});
