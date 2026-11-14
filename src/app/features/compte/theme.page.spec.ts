/*
 * US 92 : choisir le thème de l'app depuis Compte (PLAN §3, §11). Maquette : docs/maquettes/us-92-choisir-le-theme.html.
 * Critères 1 et 2 au niveau composant (les critères 3 et 4, relance et téléphone qui change de mode, sont dans e2e/compte-theme.spec.ts).
 * Les tests passent par l'app réelle (App + routes) et le vrai ThemeService ; aucun réseau.
 *
 * Fichiers et classes attendus (à créer) :
 *  - src/app/features/compte/theme.page.ts : `ThemePage`, route enfant de l'onglet Compte : `compte/theme`
 *    (déclarée dans src/app/app.routes.ts comme `a-propos`).
 *  - src/app/features/compte/compte.page.ts : nouveau premier groupe « Réglages » avec la ligne « Thème »
 *    (lien vers `/compte/theme`) qui affiche à droite le libellé du choix courant.
 * Contrat du DOM de ThemePage : trois radios dans un `role="radiogroup"` (`<input type="radio">` ou `role="radio"` + `aria-checked`),
 * nommés « Suivre le téléphone », « Clair », « Sombre » (par leur label ou aria-label), puis le texte d'aide de la maquette.
 */
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { throwError } from 'rxjs';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { SOURCE_COMPTE, SourceCompte } from '../../core/data/compte.service';
import { SOURCE_SPOTS } from '../../core/data/spots.service';
import { SOURCE_TACKLE_BOX, SourceTackleBox } from '../../core/data/tackle-box.service';
import { compact, trouver } from './compte-informations.doubles';

const CLE = 'leurio.theme';
const LIBELLES = ['Suivre le téléphone', 'Clair', 'Sombre'] as const;

const sansReseau: HttpInterceptorFn = (req) => throwError(() => new Error(`requête non prévue : ${req.url}`));

/** Écritures vers Firestore (users/{uid}) vues par les doubles : doivent rester vides. */
const ecritures: string[] = [];

async function ouvrir(url = '/compte') {
  const source: SourceCompte = {
    uidCourant: async () => 'uid-test-123',
    connecterAnonymement: async () => 'uid-test-123',
    profilExiste: async () => true,
    ecrireProfil: async () => void ecritures.push('ecrireProfil'),
  };
  const boite = {
    uid: async () => 'uid-test-123',
    ecouter: () => () => undefined,
    ajouter: async () => void ecritures.push('tackleBox.ajouter'),
    modifier: async () => void ecritures.push('tackleBox.modifier'),
    supprimer: async () => void ecritures.push('tackleBox.supprimer'),
    envoyerPhoto: async () => 'https://exemple.test/photo.jpg',
    supprimerPhoto: async () => undefined,
  } as SourceTackleBox;
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideIonicAngular(),
      provideRouter(routes),
      provideHttpClient(withInterceptors([sansReseau])),
      { provide: SOURCE_COMPTE, useValue: source },
      { provide: SOURCE_TACKLE_BOX, useValue: boite },
      { provide: SOURCE_SPOTS, useValue: { uid: async () => 'uid-test-123', documents: async () => [] } },
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
  await router.navigateByUrl(url);
  await stabiliser();
  return { page, stabiliser, router };
}

interface Radio {
  libelle: string;
  coche: boolean;
  el: HTMLElement;
}

/** Les radios du groupe, avec leur libellé et leur état. */
function radios(page: HTMLElement): Radio[] {
  const groupe = page.querySelector('[role="radiogroup"]');
  expect(groupe, 'un role="radiogroup"').toBeTruthy();
  const els = Array.from(groupe!.querySelectorAll<HTMLElement>('input[type="radio"], [role="radio"]'));
  return els.map((el) => {
    const texte = el.getAttribute('aria-label') ?? el.closest('label')?.textContent ?? (el.id ? groupe!.querySelector(`label[for="${el.id}"]`)?.textContent : '') ?? el.textContent;
    const libelle = LIBELLES.find((l) => compact(texte).includes(compact(l))) ?? (texte ?? '').trim();
    const coche = el instanceof HTMLInputElement ? el.checked : el.getAttribute('aria-checked') === 'true';
    return { libelle, coche, el };
  });
}

const cochés = (page: HTMLElement) => radios(page).filter((r) => r.coche).map((r) => r.libelle);

async function choisir(page: HTMLElement, libelle: string, stabiliser: () => Promise<void>) {
  const radio = radios(page).find((r) => r.libelle === libelle);
  if (!radio) throw new Error(`pas de radio « ${libelle} »`);
  radio.el.click();
  await stabiliser();
}

/** La ligne « Thème » de l'écran Compte. */
function ligneTheme(page: HTMLElement): HTMLElement | undefined {
  const contenu = page.querySelector('ion-content') as HTMLElement;
  return trouver(contenu, 'Thème')?.closest<HTMLElement>('a, button, [role="link"]') ?? undefined;
}

beforeEach(() => {
  ecritures.length = 0;
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
});
afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('US 92 : le thème dans Compte', () => {
  it('critère 1 : given je n\'ai jamais changé le thème, when je regarde l\'onglet Compte, then le groupe « Réglages » (avant « Informations ») a une ligne « Thème » qui affiche « Suivre le téléphone »', async () => {
    const { page } = await ouvrir();
    const contenu = page.querySelector('ion-content') as HTMLElement;
    const texte = compact(contenu.textContent);

    expect(texte).toContain(compact('Réglages'));
    expect(texte.indexOf(compact('Réglages'))).toBeLessThan(texte.indexOf(compact('Informations')));
    const ligne = ligneTheme(page);
    expect(ligne, 'ligne « Thème » touchable').toBeTruthy();
    expect(compact(ligne!.textContent)).toContain(compact('Suivre le téléphone'));
    expect(ligne!.getAttribute('href') ?? '').toContain('compte/theme');
  });

  it('critère 1 : given je n\'ai jamais changé le thème, when j\'ouvre « Thème » dans Compte, then « Suivre le téléphone » est sélectionné parmi « Suivre le téléphone », « Clair » et « Sombre », avec l\'aide de la maquette', async () => {
    const { page, stabiliser } = await ouvrir();
    ligneTheme(page)?.click();
    await stabiliser();

    expect(page.querySelector('ion-toolbar ion-title')?.textContent?.trim()).toBe('Thème');
    expect(radios(page).map((r) => r.libelle)).toEqual([...LIBELLES]);
    expect(cochés(page)).toEqual(['Suivre le téléphone']);
    expect(compact(page.textContent)).toContain(
      compact('« Suivre le téléphone » change avec le mode clair ou sombre du téléphone. « Clair » se lit mieux en plein soleil ; « Sombre » n’éblouit pas à l’aube ni la nuit.'),
    );
    expect(localStorage.getItem(CLE)).toBeNull();
  });

  it('critère 1 : given la page Thème ouverte directement (compte/theme), when elle s\'affiche, then « Suivre le téléphone » est sélectionné et l\'onglet Compte reste le contexte', async () => {
    const { page } = await ouvrir('/compte/theme');
    expect(cochés(page)).toEqual(['Suivre le téléphone']);
  });

  it('critère 1 : given le choix « Sombre » déjà gardé sur l\'appareil, when j\'ouvre « Thème », then « Sombre » est sélectionné', async () => {
    localStorage.setItem(CLE, 'sombre');
    const { page } = await ouvrir('/compte/theme');
    expect(cochés(page)).toEqual(['Sombre']);
  });

  it('critère 2 : given la page Thème, when je choisis « Clair », then data-theme="clair" est posé sur <html>, le choix est gardé dans localStorage et la coche passe sur « Clair »', async () => {
    const { page, stabiliser } = await ouvrir('/compte/theme');
    await choisir(page, 'Clair', stabiliser);

    expect(document.documentElement.getAttribute('data-theme')).toBe('clair');
    expect(localStorage.getItem(CLE)).toBe('clair');
    expect(cochés(page)).toEqual(['Clair']);
  });

  it('critère 2 : given « Clair » choisi, when je choisis « Sombre » puis « Suivre le téléphone », then data-theme suit chaque choix (sombre, puis retiré) et la clé garde « systeme »', async () => {
    const { page, stabiliser } = await ouvrir('/compte/theme');
    await choisir(page, 'Clair', stabiliser);
    await choisir(page, 'Sombre', stabiliser);
    expect(document.documentElement.getAttribute('data-theme')).toBe('sombre');
    expect(cochés(page)).toEqual(['Sombre']);
    await choisir(page, 'Suivre le téléphone', stabiliser);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(CLE)).toBe('systeme');
    expect(cochés(page)).toEqual(['Suivre le téléphone']);
  });

  it('critère 2 : given « Clair » choisi, when je reviens à Compte, then la ligne « Thème » affiche « Clair »', async () => {
    const { page, stabiliser, router } = await ouvrir('/compte/theme');
    await choisir(page, 'Clair', stabiliser);
    await router.navigateByUrl('/compte');
    await stabiliser();

    expect(compact(ligneTheme(page)?.textContent)).toContain('Clair');
    expect(compact(ligneTheme(page)?.textContent)).not.toContain(compact('Suivre le téléphone'));
  });

  it('critère 2 : given la page Thème, when je choisis un thème, then le choix reste sur l\'appareil : rien n\'est écrit dans Firestore (users/{uid}, tackleBox)', async () => {
    const { page, stabiliser } = await ouvrir('/compte/theme');
    await choisir(page, 'Clair', stabiliser);
    await choisir(page, 'Sombre', stabiliser);

    expect(localStorage.getItem(CLE)).toBe('sombre');
    expect(ecritures).toEqual([]);
  });
});
