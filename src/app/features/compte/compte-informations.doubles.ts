/*
 * US 91 : doubles et aides partagés par les tests d'acceptation de « À propos et sources » et « Confidentialité »
 * (compte.page.informations.spec.ts, a-propos.page.spec.ts, confidentialite.page.spec.ts). Aucun `vi` ici : ce fichier
 * est vu par tsconfig.app.json.
 */
import { HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { SOURCE_COMPTE, SourceCompte } from '../../core/data/compte.service';

/** Contenu double : chaque fichier de assets/data est servi par ce double (jamais le vrai contenu). */
export const CONTENU: Record<string, unknown> = {
  // Doublon « S1 commune » entre deux fiches, URL seule, `sources` imbriquées dans un objet.
  species: [
    { code: 'SAN', nom: 'Sandre', sources: ['S1 commune', 'https://exemple.test/sandre'] },
    { code: 'BRO', nom: 'Brochet', sources: ['S1 commune', 'S2 brochet'], details: { zones: [{ sources: ['S3 imbriquée'] }] } },
  ],
  // Une URL au milieu d'une phrase.
  'lure-types': [{ id: 'shad', sources: ['Guide des shads : https://exemple.test/shads (consulté en 2026)'] }],
  // Fichier sans aucune source : ignoré.
  'lure-families': [{ id: 'souples', nom: 'Souples' }],
  techniques: [{ id: 'tiree', sources: ['A1 tirée', 'A2 twitching'] }],
  couleurs: [{ id: 'gardon', nom: 'Gardon' }],
  'starter-kit': [{ id: 'kit', sources: [] }],
  federations: [{ departement: '49', sources: ['F1 fédération'] }],
  // Objet (et non liste) ; le même texte deux fois : une seule source.
  departements: { sources: ['D1 IGN', 'D1 IGN'], liste: [] },
  'engine-weights': {},
};

/** Intercepte les lectures de assets/data/*.json : le contenu double, sinon 404. Aucun réseau. */
const interception: HttpInterceptorFn = (req) => {
  const m = /assets\/data\/([^/]+)\.json$/.exec(req.url);
  if (m && m[1] in CONTENU) return of(new HttpResponse({ status: 200, body: CONTENU[m[1]] }));
  return throwError(() => new Error(`requête non prévue : ${req.url}`));
};

export interface OptionsApp {
  /** Uid renvoyé par le double de SOURCE_COMPTE ; `null` : pas de compte. */
  uid?: string | null;
}

export async function ouvrirCompte(options: OptionsApp = {}) {
  const uid = options.uid === undefined ? 'uid-test-123' : options.uid;
  const source: SourceCompte = {
    uidCourant: async () => uid,
    connecterAnonymement: async () => uid ?? 'uid-test-123',
    profilExiste: async () => true,
    ecrireProfil: async () => undefined,
  };
  const providers: (Provider | EnvironmentProviders)[] = [
    provideIonicAngular(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([interception])),
    { provide: SOURCE_COMPTE, useValue: source },
  ];
  await TestBed.configureTestingModule({ imports: [App], providers }).compileComponents();
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
  await router.navigateByUrl('/compte');
  await stabiliser();
  return { page, stabiliser };
}

/** Texte sans espace ni espace insécable : compare « verbatim » sans dépendre de la mise en forme. */
export const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s\u00a0\u202f]/g, '');

/** L'élément le plus profond dont le texte contient `texte`. */
export function trouver(racine: ParentNode, texte: string): HTMLElement | undefined {
  const cible = compact(texte);
  const tous = Array.from(racine.querySelectorAll<HTMLElement>('*')).filter((e) => compact(e.textContent).includes(cible));
  return tous.filter((e) => !Array.from(e.children).some((c) => compact(c.textContent).includes(cible))).at(-1);
}

/** Touche (clic) l'élément le plus profond qui porte ce texte : le clic remonte jusqu'au lien ou au bouton. */
export async function toucher(page: HTMLElement, texte: string, stabiliser: () => Promise<void>): Promise<void> {
  const el = trouver(page, texte);
  if (!el) throw new Error(`rien à toucher : « ${texte} »`);
  el.click();
  await stabiliser();
}

/** Le lien le plus proche (`a`) dont le texte contient `texte`. */
export function lien(racine: ParentNode, texte: string): HTMLAnchorElement | undefined {
  const cible = compact(texte);
  return Array.from(racine.querySelectorAll<HTMLAnchorElement>('a')).find((a) => compact(a.textContent).includes(cible));
}
