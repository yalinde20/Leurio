import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { ConseilPage } from './conseil.page';

describe('ConseilPage', () => {
  it('affiche seulement son titre « Conseil »', async () => {
    await TestBed.configureTestingModule({ imports: [ConseilPage], providers: [provideIonicAngular()] }).compileComponents();
    const fixture = TestBed.createComponent(ConseilPage);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Conseil');
    expect(page.querySelector('ion-content')?.textContent?.trim()).toBe('');
  });
});
