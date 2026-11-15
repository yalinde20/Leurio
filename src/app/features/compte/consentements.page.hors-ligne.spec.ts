/*
 * US 94 : hors ligne sans cache, la lecture de users/{uid} reste en attente. Un retrait de consentement fait entre-temps garde la mention
 * « Pas encore synchronisé » et s'écrit au retour du réseau.
 */
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { throwError } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { SOURCE_COMPTE } from '../../core/data/compte.service';
import { SOURCE_PROFIL } from '../../core/data/profil.service';
import { SOURCE_SPOTS } from '../../core/data/spots.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { compact } from './compte-informations.doubles';

const MENTION = 'Pas encore synchronisé : ce sera fait au retour du réseau.';
const sansReseau: HttpInterceptorFn = (req) => throwError(() => new Error(`requête non prévue : ${req.url}`));

afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 94 : Consentements hors ligne sans cache', () => {
  it('given la lecture est en attente, when je retire Analytics, then la mention reste affichée, rien n\'est écrit, puis l\'écriture {faux, faux} part au retour du réseau et la mention disparaît', async () => {
    localStorage.clear();
    localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
    const ecritures: unknown[] = [];
    let arriver!: () => void;
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideIonicAngular(),
        provideRouter(routes),
        provideHttpClient(withInterceptors([sansReseau])),
        { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => 'u', connecterAnonymement: async () => 'u', profilExiste: async () => true, ecrireProfil: async () => undefined } },
        {
          provide: SOURCE_PROFIL,
          useValue: {
            lireConsentements: () => new Promise((r) => (arriver = () => r({ analytics: true, video: false }))),
            mettreAJour: async (_u: string, champs: unknown) => void ecritures.push(champs),
          },
        },
        { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
        { provide: SOURCE_SPOTS, useValue: { uid: async () => null, documents: async () => [] } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    const page = fixture.nativeElement as HTMLElement;
    const stabiliser = async () => {
      for (let i = 0; i < 5; i++) {
        await fixture.whenStable();
        fixture.detectChanges();
        await new Promise((r) => setTimeout(r, 0));
      }
    };
    const router = TestBed.inject(Router);
    router.setUpLocationChangeListener();
    await router.navigateByUrl('/compte/consentements');
    await stabiliser();

    const bascule = page.querySelector<HTMLElement & { checked: boolean }>('ion-toggle')!;
    bascule.checked = true;
    bascule.dispatchEvent(new CustomEvent('ionChange', { detail: { checked: true }, bubbles: true }));
    await stabiliser();
    expect(compact(page.textContent)).toContain(compact(MENTION));
    expect(ecritures).toEqual([]);

    arriver();
    await stabiliser();

    expect(ecritures).toEqual([{ consentements: { analytics: true, video: false } }]);
    expect(compact(page.textContent)).not.toContain(compact(MENTION));
  });
});
