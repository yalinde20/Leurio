import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { Geolocalisation, GEOLOCALISATION } from '../../core/data/position.service';
import { SOURCE_SPOTS } from '../../core/data/spots.service';
import { SpotsPage } from './spots.page';

const MENTION = 'Hors ligne : carte incomplète';

async function ouvrir() {
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
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('SpotsPage : mention hors ligne (US 3)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('given le téléphone hors ligne, when l\'onglet « Spots » est ouvert, then la carte porte la mention « Hors ligne : carte incomplète »', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const page = await ouvrir();
    expect(page.textContent).toContain(MENTION);
  });

  it('given le téléphone en ligne puis hors ligne puis de nouveau en ligne, when la connexion change, then la mention apparaît puis disparaît', async () => {
    const enLigne = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const page = await ouvrir();
    expect(page.textContent).not.toContain(MENTION);

    enLigne.mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await vi.waitFor(() => expect(page.textContent).toContain(MENTION));

    enLigne.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(page.textContent).not.toContain(MENTION));
  });
});
