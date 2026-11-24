/*
 * US 13 : indicateur « Hors ligne » dans la coque à onglets. Maquette : docs/maquettes/us-13-indicateur-hors-ligne.html.
 * Le bandeau a le rôle accessible « status » (élément <output>, rôle implicite, ou attribut role="status") et porte le texte « Hors ligne », au-dessus de la page (donc avant le contenu
 * des onglets) ; il suit les événements `offline` / `online` de la fenêtre (navigator.onLine), sans recharger.
 * Choix du propriétaire (option B) : un <output> sans attribut role, pour que les tests US 97/98, qui lisent le premier
 * `[role="status"]` de l'écran, trouvent toujours leur message.
 * La coque est partagée par les quatre onglets : l'e2e (e2e/hors-ligne.spec.ts) vérifie chacun d'eux.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { OngletsComponent } from './onglets.component';

async function ouvrir(enLigne: boolean) {
  const reseau = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(enLigne);
  await TestBed.configureTestingModule({
    imports: [OngletsComponent],
    providers: [provideIonicAngular(), provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(OngletsComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const coque = fixture.nativeElement as HTMLElement;
  const bandeau = () =>
    [...coque.querySelectorAll('[role="status"], output:not([role])')].find((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim() === 'Hors ligne') ?? null;
  return { coque, bandeau, reseau };
}

describe('OngletsComponent : indicateur « Hors ligne » (US 13)', () => {
  afterEach(() => vi.restoreAllMocks());

  it("critère 1 : given l'app ouverte avec du réseau, when le réseau est coupé, then un bandeau de rôle status « Hors ligne » s'affiche avant le contenu de l'onglet", async () => {
    const { coque, bandeau, reseau } = await ouvrir(true);
    expect(bandeau()).toBeNull();

    reseau.mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await vi.waitFor(() => expect(bandeau()).not.toBeNull());

    const contenu = coque.querySelector('.contenu, router-outlet');
    expect(contenu, 'le contenu des onglets est introuvable').not.toBeNull();
    expect(bandeau()!.compareDocumentPosition(contenu!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("critère 1 : given l'app ouverte hors ligne, when l'écran s'affiche, then le bandeau « Hors ligne » est là dès l'ouverture, n'est pas un bouton ni un lien et son icône est masquée aux lecteurs d'écran", async () => {
    const { bandeau } = await ouvrir(false);
    const b = bandeau();
    expect(b, 'aucun role=status « Hors ligne »').not.toBeNull();
    expect(b!.closest('a, button, ion-button')).toBeNull();
    expect(b!.querySelectorAll('a, button, ion-button')).toHaveLength(0);
    for (const icone of b!.querySelectorAll('ion-icon, svg')) expect(icone.getAttribute('aria-hidden')).toBe('true');
  });

  it("critère 2 : given l'indicateur « Hors ligne » affiché, when le réseau revient, then l'indicateur disparaît", async () => {
    const { bandeau, reseau } = await ouvrir(false);
    expect(bandeau()).not.toBeNull();

    reseau.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(bandeau()).toBeNull());
  });

  it("critère 2 (contraire) : given l'app ouverte avec du réseau, when on la regarde, then aucun indicateur « Hors ligne » n'est affiché", async () => {
    const { coque, bandeau } = await ouvrir(true);
    expect(bandeau()).toBeNull();
    expect(coque.textContent).not.toContain('Hors ligne');
  });
});
