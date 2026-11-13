/*
 * US 102 : le réseau tombe entre le choix de la photo et « Enregistrer ». Contrat du formulaire : boite.page.photo.spec.ts.
 * L'envoi n'est pas lancé (il réessaierait longtemps) : « Photo indisponible hors ligne : ajoute-la plus tard. » s'affiche,
 * le leurre reste enregistrable après « Retirer la photo ».
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { SOURCE_PHOTO } from '../../core/data/photo-leurre';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { BoitePage } from './boite.page';

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s     ]/g, '');
const attendre = () => new Promise<void>((r) => setTimeout(r));

describe('BoitePage : photo et réseau perdu (US 102)', () => {
  it('given le réseau tombe après le choix de la photo, when j\'enregistre, then rien n\'est envoyé ni écrit, le message s\'affiche, et sans la photo le leurre s\'enregistre', async () => {
    let enLigne = true;
    const envois: Blob[] = [];
    const ecritures: Record<string, unknown>[] = [];
    const source = {
      uid: async () => 'u1',
      ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => (ok([]), () => undefined),
      ajouter: async (_u: string, data: Record<string, unknown>) => void ecritures.push(data),
      modifier: async () => undefined,
      supprimer: async () => undefined,
      envoyerPhoto: async (_u: string, photo: Blob) => (envois.push(photo), 'https://stockage.test/n.jpg'),
      supprimerPhoto: async () => undefined,
    };
    await TestBed.configureTestingModule({
      imports: [BoitePage],
      providers: [
        provideIonicAngular(),
        { provide: SOURCE_TACKLE_BOX, useValue: source },
        { provide: SOURCE_PHOTO, useValue: { enLigne: () => enLigne, choisir: async () => new Blob([new Uint8Array(1024)], { type: 'image/jpeg' }) } },
        { provide: CatalogService, useValue: { typesDeLeurres: async () => [{ id: 'shad', nom: 'Shad' }] as TypeLeurre[] } },
      ],
    }).compileComponents();
    if (typeof URL.createObjectURL !== 'function') Object.assign(URL, { createObjectURL: () => 'blob:aperçu', revokeObjectURL: () => undefined });
    const fixture = TestBed.createComponent(BoitePage);
    const page = fixture.nativeElement as HTMLElement;
    const stabiliser = async () => {
      for (let i = 0; i < 4; i++) {
        await fixture.whenStable();
        fixture.detectChanges();
        await attendre();
      }
    };
    await stabiliser();
    const bouton = (texte: string) =>
      [...page.querySelectorAll<HTMLElement>('button')].find((b) => compact(b.textContent) === compact(texte));
    const cliquer = async (texte: string) => {
      const b = bouton(texte);
      if (!b) throw new Error(`Aucun bouton « ${texte} »`);
      b.click();
      await stabiliser();
    };
    const saisir = (id: string, valeur: string) => {
      const c = page.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      c.value = valeur;
      c.dispatchEvent(new Event('input', { bubbles: true }));
      c.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const alertes = () => [...page.querySelectorAll('[role="alert"]')].map((a) => compact(a.textContent));

    await cliquer('Ajouter un leurre');
    saisir('leurre-type', 'shad');
    saisir('leurre-taille', '10');
    saisir('leurre-poids', '12');
    saisir('leurre-couleur', 'gardon');
    await cliquer('Ajouter une photo');
    await cliquer('Choisir dans la galerie');
    expect(page.querySelector('img[alt="Photo du leurre"]')).not.toBeNull();

    enLigne = false;
    await cliquer('Enregistrer');
    expect(envois).toEqual([]);
    expect(ecritures).toEqual([]);
    expect(alertes()).toContain(compact('Photo indisponible hors ligne : ajoute-la plus tard.'));

    await cliquer('Retirer la photo');
    await cliquer('Enregistrer');
    expect(envois).toEqual([]);
    expect(ecritures).toHaveLength(1);
  });
});
