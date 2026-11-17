/*
 * US 97 : « Exporter mes données » dans l'écran Compte. Maquette : docs/maquettes/us-97-exporter-mes-donnees.html.
 * Interface attendue : voir l'en-tête de src/app/core/data/export.service.spec.ts (ExportService, SOURCE_EXPORT, ENREGISTREMENT_FICHIER).
 * Contrat du DOM : groupe « Mes données » entre « Informations » et « Réglementation » ; la rangée « Exporter mes données »
 * est (ou est dans) un `button` ; pendant la préparation il est `disabled` et le sous-titre devient « Préparation du fichier… » ;
 * le message de succès est un `[role="status"]`, le message d'échec un `[role="alert"]`.
 */
import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { ENREGISTREMENT_FICHIER, ExportAnnule, SOURCE_EXPORT, type DonneesExport } from '../../core/data/export.service';
import { compact, ouvrirCompte, toucher, trouver } from './compte-informations.doubles';

const DONNEES: DonneesExport = {
  uid: 'uid-test-123',
  profil: { niveau: 'debutant', especesFavorites: ['brochet'], consentements: { analytics: false, video: false }, createdAt: 1761730293000, plan: 'free' },
  tackleBox: [{ id: 'l1', data: { typeId: 'shad', tailleCm: 9, poidsG: 14, couleur: 'gardon', photoUrl: 'https://exemple.test/p1.jpg', createdAt: 1761730300000 } }],
  spots: [{ id: 's1', data: { nom: 'Étang du Gué', lat: 47.12, lng: -0.55, categorie: 2, milieu: 'etang', departement: '49', prive: true } }],
};

function definirEnLigne(valeur: boolean | undefined) {
  if (valeur === undefined) delete (navigator as unknown as Record<string, unknown>)['onLine'];
  else Object.defineProperty(navigator, 'onLine', { value: valeur, configurable: true });
}

async function ouvrir(opts: { lire?: () => Promise<DonneesExport>; enregistrer?: (n: string, c: string) => Promise<void> } = {}) {
  const enregistres: { nom: string; contenu: string }[] = [];
  const app = await ouvrirCompte({
    providers: [
      { provide: SOURCE_EXPORT, useValue: { lire: opts.lire ?? (async () => DONNEES) } },
      {
        provide: ENREGISTREMENT_FICHIER,
        useValue: { enregistrer: opts.enregistrer ?? (async (nom: string, contenu: string) => void enregistres.push({ nom, contenu })) },
      },
    ],
  });
  return { ...app, enregistres };
}

const bouton = (page: HTMLElement) => trouver(page, 'Exporter mes données')?.closest('button') as HTMLButtonElement | null | undefined;

beforeEach(() => {
  localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] }));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 21, 40, 12));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  definirEnLigne(undefined);
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 97 : « Exporter mes données » dans Compte', () => {
  it('given j\'ouvre Compte, when je le regarde, then le groupe « Mes données » est entre « Informations » et « Réglementation » avec la rangée « Exporter mes données » et son sous-titre', async () => {
    const { page } = await ouvrir();
    const texte = compact(page.querySelector('ion-content')!.textContent);

    expect(bouton(page), 'bouton Exporter mes données').toBeTruthy();
    expect(texte).toContain(compact('Profil, boîte et spots dans un fichier'));
    const i = texte.indexOf(compact('Informations'));
    const m = texte.indexOf(compact('Mes données'));
    const r = texte.indexOf(compact('Réglementation'));
    expect(m, 'groupe Mes données').toBeGreaterThan(i);
    expect(r).toBeGreaterThan(m);
  });

  it('critère 1 : given j\'ai un profil, des leurres et des spots, when je touche « Exporter mes données », then le fichier « leurio-export-2026-11-16.json » est enregistré et l\'écran le confirme', async () => {
    const { page, stabiliser, enregistres } = await ouvrir();

    await toucher(page, 'Exporter mes données', stabiliser);

    expect(enregistres).toHaveLength(1);
    expect(enregistres[0].nom).toBe('leurio-export-2026-11-16.json');
    const statut = page.querySelector('[role="status"]');
    expect(compact(statut?.textContent)).toBe(compact('Fichier « leurio-export-2026-11-16.json » téléchargé.'));
    expect(bouton(page)!.disabled).toBe(false);
  });

  it('critère 2 : given le fichier est enregistré, when je l\'ouvre, then il contient mon profil, mon leurre et mon spot avec tous leurs champs', async () => {
    const { page, stabiliser, enregistres } = await ouvrir();

    await toucher(page, 'Exporter mes données', stabiliser);

    const fichier = JSON.parse(enregistres[0].contenu);
    expect(fichier.app).toBe('Leurio');
    expect(fichier.profil).toEqual(DONNEES.profil);
    expect(fichier.tackleBox).toEqual([{ id: 'l1', ...DONNEES.tackleBox[0].data }]);
    expect(fichier.spots).toEqual([{ id: 's1', ...DONNEES.spots[0].data }]);
    expect(enregistres[0].contenu).toBe(JSON.stringify(fichier, null, 2));
  });

  it('critère 3 : given ma boîte et mes spots sont vides, when j\'exporte, then le fichier contient mon profil et deux listes vides', async () => {
    const { page, stabiliser, enregistres } = await ouvrir({ lire: async () => ({ ...DONNEES, tackleBox: [], spots: [] }) });

    await toucher(page, 'Exporter mes données', stabiliser);

    const fichier = JSON.parse(enregistres[0].contenu);
    expect(fichier.profil).toEqual(DONNEES.profil);
    expect(fichier.tackleBox).toEqual([]);
    expect(fichier.spots).toEqual([]);
  });

  it('given la préparation est en cours, when je regarde la rangée, then elle est inactive et dit « Préparation du fichier… », puis redevient active', async () => {
    let finir!: () => void;
    const attente = new Promise<void>((r) => (finir = r));
    const { page, stabiliser } = await ouvrir({ enregistrer: () => attente });

    await toucher(page, 'Exporter mes données', stabiliser);

    expect(bouton(page)!.disabled).toBe(true);
    expect(compact(page.textContent)).toContain(compact('Préparation du fichier…'));
    expect(page.querySelector('[role="status"]')).toBeNull();

    finir();
    await stabiliser();
    expect(bouton(page)!.disabled).toBe(false);
    expect(compact(page.textContent)).toContain(compact('Profil, boîte et spots dans un fichier'));
  });

  it('given je suis hors ligne, when j\'exporte, then le fichier est quand même enregistré depuis les données gardées et l\'écran le dit', async () => {
    definirEnLigne(false);
    const { page, stabiliser, enregistres } = await ouvrir();

    await toucher(page, 'Exporter mes données', stabiliser);

    expect(enregistres).toHaveLength(1);
    expect(compact(page.querySelector('[role="status"]')?.textContent)).toBe(
      compact('Fichier « leurio-export-2026-11-16.json » téléchargé. Hors ligne : il reprend les données gardées sur ce téléphone.'),
    );
  });

  it('given la lecture des données échoue, when j\'exporte, then aucun fichier n\'est enregistré, l\'alerte « L’export n’a pas abouti. Réessaie. » s\'affiche et la rangée redevient active', async () => {
    const { page, stabiliser, enregistres } = await ouvrir({ lire: async () => Promise.reject(new Error('lecture')) });

    await toucher(page, 'Exporter mes données', stabiliser);

    expect(enregistres).toEqual([]);
    expect(compact(page.querySelector('[role="alert"]')?.textContent)).toBe(compact('L’export n’a pas abouti. Réessaie.'));
    expect(page.querySelector('[role="status"]')).toBeNull();
    expect(bouton(page)!.disabled).toBe(false);
  });

  it('given j\'utilise l\'app native, when je touche « Exporter mes données », then le même export est enregistré par le même bouton (le partage est fait par l\'enregistrement natif)', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const { page, stabiliser, enregistres } = await ouvrir();

    await toucher(page, 'Exporter mes données', stabiliser);

    expect(enregistres.map((e) => e.nom)).toEqual(['leurio-export-2026-11-16.json']);
  });

  it('given l\'app native, when je ferme la feuille de partage sans rien choisir, then aucun message ne s\'affiche et la rangée redevient active (décision du propriétaire, US 97)', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const { page, stabiliser } = await ouvrir({ enregistrer: async () => Promise.reject(new ExportAnnule()) });

    await toucher(page, 'Exporter mes données', stabiliser);

    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(page.querySelector('[role="status"]')).toBeNull();
    expect(bouton(page)!.disabled).toBe(false);
  });
});
