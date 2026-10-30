import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ComptePage } from './compte.page';

describe('ComptePage', () => {
  it('affiche seulement son titre « Compte »', async () => {
    await TestBed.configureTestingModule({ imports: [ComptePage], providers: [provideIonicAngular()] }).compileComponents();
    const fixture = TestBed.createComponent(ComptePage);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Compte');
    expect(page.querySelector('ion-content')?.textContent?.trim()).toBe('');
  });
});
