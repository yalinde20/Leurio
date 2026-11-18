/*
 * US 97 : exporter mes données. Maquette : docs/maquettes/us-97-exporter-mes-donnees.html. PLAN §2.5, §4.
 *
 * INTERFACE À IMPLÉMENTER (src/app/core/data/export.service.ts), sur le modèle de SOURCE_SPOTS :
 *
 *   export interface DocumentExport { id: string; data: Record<string, unknown> }
 *   export interface DonneesExport {
 *     uid: string | null;                       // null : pas de compte
 *     profil: Record<string, unknown> | null;   // users/{uid} tel que stocké (null si absent)
 *     tackleBox: DocumentExport[];              // users/{uid}/tackleBox
 *     spots: DocumentExport[];                  // users/{uid}/spots
 *   }
 *   export interface SourceExport { lire(): Promise<DonneesExport> }  // lit le cache hors ligne ; rejette si la lecture échoue
 *   export const SOURCE_EXPORT = new InjectionToken<SourceExport>(...)   // providedIn root, fabrique Firebase
 *
 *   export interface EnregistrementFichier { enregistrer(nom: string, contenu: string): Promise<void> }
 *   export const ENREGISTREMENT_FICHIER = new InjectionToken<EnregistrementFichier>(...)
 *     // web : Blob + <a download> ; natif (Capacitor.isNativePlatform()) : @capacitor/filesystem + @capacitor/share
 *
 *   @Injectable({ providedIn: 'root' }) export class ExportService {
 *     // Lit, construit le fichier, l'enregistre via ENREGISTREMENT_FICHIER ; renvoie le nom du fichier.
 *     // Propage l'erreur de lecture (rien n'est enregistré).
 *     exporter(): Promise<string>;
 *   }
 *
 * Fichier : nom `leurio-export-AAAA-MM-JJ.json` (date LOCALE), contenu `JSON.stringify(x, null, 2)` avec
 *   x = { app: 'Leurio', exporteLe: <new Date().toISOString()>, profil, tackleBox: [{ id, ...data }], spots: [{ id, ...data }] }
 * (clés dans cet ordre ; profil `{}` si absent ; aucun champ ajouté ni retiré, photoUrl seulement en adresse).
 */
import { TestBed } from '@angular/core/testing';
import { ENREGISTREMENT_FICHIER, ExportService, SOURCE_EXPORT, type DonneesExport } from './export.service';

const PROFIL = {
  niveau: 'debutant',
  especesFavorites: ['brochet', 'perche'],
  consentements: { analytics: false, video: true },
  createdAt: 1761730293000,
  plan: 'free',
};
const LEURRES = [
  { id: 'l1', data: { typeId: 'shad', tailleCm: 9, poidsG: 14, couleur: 'gardon', marque: 'Acme', photoUrl: 'https://exemple.test/p1.jpg', createdAt: 1761730300000 } },
  { id: 'l2', data: { typeId: 'cuiller', tailleCm: 5, poidsG: 7, couleur: 'argent', createdAt: 1761730400000 } },
];
const SPOTS = [
  { id: 's1', data: { nom: 'Étang du Gué', lat: 47.12, lng: -0.55, categorie: 2, milieu: 'etang', departement: '49', prive: true } },
  { id: 's2', data: { nom: 'La Loire', lat: 47.4, lng: 0.7, categorie: 1, milieu: 'fleuve', departement: '37', prive: true } },
];

function installer(donnees: DonneesExport | Error) {
  const enregistres: { nom: string; contenu: string }[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: SOURCE_EXPORT, useValue: { lire: async () => (donnees instanceof Error ? Promise.reject(donnees) : donnees) } },
      { provide: ENREGISTREMENT_FICHIER, useValue: { enregistrer: async (nom: string, contenu: string) => void enregistres.push({ nom, contenu }) } },
    ],
  });
  return { service: TestBed.inject(ExportService), enregistres };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 23, 30, 5)); // 16 novembre 2026, heure locale
});
afterEach(() => {
  vi.useRealTimers();
  TestBed.resetTestingModule();
});

describe('US 97 : ExportService', () => {
  it('critère 1 : given j\'ai un profil, des leurres et des spots, when j\'exporte, then un fichier « leurio-export-AAAA-MM-JJ.json » (date locale) est enregistré', async () => {
    const { service, enregistres } = installer({ uid: 'u1', profil: PROFIL, tackleBox: LEURRES, spots: SPOTS });

    const nom = await service.exporter();

    expect(nom).toBe('leurio-export-2026-11-16.json');
    expect(enregistres).toHaveLength(1);
    expect(enregistres[0].nom).toBe('leurio-export-2026-11-16.json');
  });

  it('critère 2 : given le fichier est enregistré, when je l\'ouvre, then il contient mon profil, chaque leurre et chaque spot avec tous leurs champs, en JSON indenté lisible', async () => {
    const { service, enregistres } = installer({ uid: 'u1', profil: PROFIL, tackleBox: LEURRES, spots: SPOTS });

    await service.exporter();

    const attendu = {
      app: 'Leurio',
      exporteLe: new Date(2026, 10, 16, 23, 30, 5).toISOString(),
      profil: PROFIL,
      tackleBox: LEURRES.map((d) => ({ id: d.id, ...d.data })),
      spots: SPOTS.map((d) => ({ id: d.id, ...d.data })),
    };
    expect(enregistres[0].contenu).toBe(JSON.stringify(attendu, null, 2));
    expect(enregistres[0].contenu).toContain('\n  "profil": {');
  });

  it('critère 2 : given un leurre avec photo, when j\'exporte, then la photo n\'est présente que par son adresse photoUrl, et un champ facultatif absent n\'apparaît pas', async () => {
    const { service, enregistres } = installer({ uid: 'u1', profil: PROFIL, tackleBox: LEURRES, spots: SPOTS });

    await service.exporter();

    const fichier = JSON.parse(enregistres[0].contenu);
    expect(fichier.tackleBox[0].photoUrl).toBe('https://exemple.test/p1.jpg');
    expect('photoUrl' in fichier.tackleBox[1]).toBe(false);
    expect('marque' in fichier.tackleBox[1]).toBe(false);
  });

  it('critère 3 : given ma boîte et mes spots sont vides, when j\'exporte, then le fichier contient mon profil et deux listes vides', async () => {
    const { service, enregistres } = installer({ uid: 'u1', profil: PROFIL, tackleBox: [], spots: [] });

    await service.exporter();

    const fichier = JSON.parse(enregistres[0].contenu);
    expect(fichier.profil).toEqual(PROFIL);
    expect(fichier.tackleBox).toEqual([]);
    expect(fichier.spots).toEqual([]);
  });

  it('given la lecture des données échoue, when j\'exporte, then l\'erreur est propagée et aucun fichier n\'est enregistré', async () => {
    const { service, enregistres } = installer(new Error('lecture impossible'));

    await expect(service.exporter()).rejects.toThrow('lecture impossible');
    expect(enregistres).toEqual([]);
  });
});
