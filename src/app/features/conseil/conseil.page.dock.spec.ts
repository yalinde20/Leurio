/*
 * US 294 : le dock (Boîte · Ma sortie · Spots) et l'avatar Compte du Conseil. Maquette : docs/maquettes/us-294-dock-et-avatar.html.
 * Les services sont doublés ; le réseau est `navigator.onLine`.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { IDBFactory } from 'fake-indexeddb';
import { AstroService } from '../../core/data/astro.service';
import { CatalogService } from '../../core/data/catalog.service';
import { INDEXED_DB } from '../../core/data/conditions-cache';
import { GeoService } from '../../core/data/geo.service';
import { HubeauService } from '../../core/data/hubeau.service';
import { MomentJourneeService } from '../../core/data/moment-journee.service';
import { MoteurService } from '../../core/data/moteur.service';
import { PositionService, ResultatPosition } from '../../core/data/position.service';
import { SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { TemperatureEauService } from '../../core/data/temperature-eau.service';
import { TuilesService } from '../../core/data/tuiles.service';
import { WeatherProvider } from '../../core/data/weather-provider';
import { ConseilPage } from './conseil.page';

const ANGERS: ResultatPosition = { disponible: true, source: 'gps', latitude: 47.47, longitude: -0.55, precisionM: 10, departement: '49' };

async function ouvrir(enLigne = true) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(enLigne);
  await TestBed.configureTestingModule({
    imports: [ConseilPage],
    providers: [
      provideIonicAngular(),
      provideRouter([]),
      { provide: INDEXED_DB, useValue: new IDBFactory() },
      { provide: TuilesService, useValue: { mettreEnCacheAutour: async () => undefined } },
      { provide: SOURCE_TACKLE_BOX, useValue: { uid: async () => null, ecouter: () => () => undefined } },
      { provide: PositionService, useValue: { positionGps: async () => ANGERS } },
      { provide: CatalogService, useValue: { federation: async () => undefined, typesDeLeurres: async () => [], animations: async () => [], couleurs: async () => [] } },
      { provide: TemperatureEauService, useValue: { temperatureEauProche: async () => ({ statut: "température de l'eau inconnue" }) } },
      { provide: HubeauService, useValue: { tendanceDebitProche: async () => ({ statut: "Hub'Eau indisponible" }) } },
      {
        provide: WeatherProvider,
        useValue: {
          previsions48h: async () => {
            throw new Error('Failed to fetch');
          },
          meteoPrevue: async () => ({ disponible: false }),
          meteoActuelle: async () => ({ disponible: false }),
          moyenneAirDerniersJours: async () => ({ disponible: false }),
        },
      },
      { provide: MomentJourneeService, useValue: { moment: () => 'jour' } },
      { provide: GeoService, useValue: { departement: () => '49' } },
      { provide: AstroService, useValue: { soleil: () => ({ lever: new Date(0), coucher: new Date(0) }), lune: () => ({ phase: 'Premier croissant', fractionEclairee: 0.3 }) } },
      { provide: MoteurService, useValue: { conseiller: async () => ({ conseils: [], explications: [] }) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ConseilPage);
  const stabiliser = async () => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  await stabiliser();
  return { page: fixture.nativeElement as HTMLElement, stabiliser };
}

const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/\s+/g, ' ').trim();

describe('ConseilPage : dock et avatar (US 294)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('given le Conseil, when il s\'affiche, then le dock « Navigation » montre Boîte, Ma sortie et Spots dans cet ordre, Boîte et Spots étant des liens', async () => {
    const { page } = await ouvrir();
    const dock = page.querySelector('nav[aria-label="Navigation"]');
    expect(dock).not.toBeNull();
    expect([...dock!.querySelectorAll('a, button')].map((e) => compact(e.textContent))).toEqual(['Boîte', 'Ma sortie', 'Spots']);
    expect([...dock!.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/boite', '/spots']);
  });

  it('given le Conseil, when il s\'affiche, then l\'avatar « Compte » est dans la barre du haut et aucun bouton « Préparer ma sortie » n\'est dans le contenu', async () => {
    const { page } = await ouvrir();
    const avatar = page.querySelector<HTMLElement>('button[aria-label="Compte"]');
    expect(avatar).not.toBeNull();
    expect(avatar!.closest('ion-toolbar')).not.toBeNull();
    expect([...page.querySelectorAll('button')].some((b) => compact(b.textContent) === 'Préparer ma sortie')).toBe(false);
  });

  it('given l\'appareil sans réseau, when on touche « Ma sortie », then l\'alerte s\'affiche au-dessus du dock', async () => {
    const { page, stabiliser } = await ouvrir(false);
    const bouton = [...page.querySelectorAll<HTMLButtonElement>('nav button')].find((b) => compact(b.textContent) === 'Ma sortie')!;
    await vi.waitFor(async () => {
      await stabiliser();
      expect(bouton.disabled).toBe(false);
    });
    bouton.click();
    await vi.waitFor(async () => {
      await stabiliser();
      const alerte = page.querySelector('[role="alert"]');
      expect(compact(alerte?.textContent)).toBe('Pas de réseau : prépare ta sortie avant de partir');
      expect(alerte!.compareDocumentPosition(page.querySelector('nav[aria-label="Navigation"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('given les liens Boîte et Spots, when on clique avec Ctrl, Cmd, Maj ou le bouton du milieu, then le lien garde son comportement natif, et un clic simple ouvre l\'écran sans recharger', async () => {
    const { page } = await ouvrir();
    const navigation = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const lien = page.querySelector<HTMLAnchorElement>('nav a[href="/boite"]')!;
    const cliquer = (init: MouseEventInit) => {
      const clic = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
      lien.dispatchEvent(clic);
      return clic.defaultPrevented;
    };

    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) expect(cliquer(init), JSON.stringify(init)).toBe(false);
    expect(navigation).not.toHaveBeenCalled();

    expect(cliquer({})).toBe(true);
    expect(navigation).toHaveBeenCalledWith('/boite');
  });
});
