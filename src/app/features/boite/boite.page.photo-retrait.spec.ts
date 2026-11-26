/*
 * US 102 : « Retirer la photo » sur une photo choisie mais pas encore enregistrée n'écarte que celle-là ; la photo
 * déjà enregistrée du leurre revient. Contrat du formulaire : boite.page.photo.spec.ts.
 */
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { CatalogService, TypeLeurre } from '../../core/data/catalog.service';
import { SOURCE_PHOTO } from '../../core/data/photo-leurre';
import { DocumentLeurre, SOURCE_TACKLE_BOX } from '../../core/data/tackle-box.service';
import { FEATURE_FLAGS } from '../../core/firebase/feature-flags';
import { BoitePage } from './boite.page';

const compact = (t: string | null | undefined): string => (t ?? '').replace(/[\s     ]/g, '');
const attendre = () => new Promise<void>((r) => setTimeout(r));
const URL_ANCIENNE = 'https://stockage.test/users/u1/lures/ancienne.jpg';

async function ouvrir() {
  const modifications: Record<string, unknown>[] = [];
  const envois: Blob[] = [];
  const suppressions: string[] = [];
  const docs: DocumentLeurre[] = [
    { id: 'a', enAttente: false, data: { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', createdAt: 1, photoUrl: URL_ANCIENNE } },
  ];
  const source = {
    uid: async () => 'u1',
    ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => (ok(docs), () => undefined),
    ajouter: async () => undefined,
    modifier: async (_u: string, _id: string, data: Record<string, unknown>) => void modifications.push(data),
    supprimer: async () => undefined,
    envoyerPhoto: async (_u: string, photo: Blob) => (envois.push(photo), 'https://stockage.test/n.jpg'),
    supprimerPhoto: async (url: string) => void suppressions.push(url),
  };
  await TestBed.configureTestingModule({
    imports: [BoitePage],
    providers: [
      provideIonicAngular(),
      { provide: SOURCE_TACKLE_BOX, useValue: source },
      { provide: SOURCE_PHOTO, useValue: { enLigne: () => true, choisir: async () => new Blob([new Uint8Array(1024)], { type: 'image/jpeg' }) } },
      { provide: CatalogService, useValue: { typesDeLeurres: async () => [{ id: 'shad', nom: 'Shad' }] as TypeLeurre[] } },
      { provide: FEATURE_FLAGS, useValue: { initialiser: async () => undefined, estActif: (n: string) => n === 'photosLeurres' } },
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
  const cliquer = async (texte: string) => {
    const b = [...page.querySelectorAll<HTMLElement>('button')].find((x) => compact(x.textContent) === compact(texte));
    if (!b) throw new Error(`Aucun bouton « ${texte} »`);
    b.click();
    await stabiliser();
  };
  const apercu = () => page.querySelector('[role="dialog"] img[alt="Photo du leurre"]')?.getAttribute('src');
  return { page, cliquer, apercu, modifications, envois, suppressions, stabiliser };
}

describe('BoitePage : retirer une photo pas encore enregistrée (US 102)', () => {
  it('given un leurre avec photo et une nouvelle photo choisie, when je touche « Retirer la photo », then l\'ancienne photo revient, et enregistrer ne la supprime pas', async () => {
    const env = await ouvrir();
    await env.cliquer('Shad');
    expect(env.apercu()).toBe(URL_ANCIENNE);

    await env.cliquer('Changer la photo');
    await env.cliquer('Choisir dans la galerie');
    expect(env.apercu()).not.toBe(URL_ANCIENNE);

    await env.cliquer('Retirer la photo');
    expect(env.apercu()).toBe(URL_ANCIENNE);

    await env.cliquer('Enregistrer');
    expect(env.envois).toEqual([]);
    expect(env.suppressions).toEqual([]);
    expect(env.modifications).toHaveLength(1);
    expect(env.modifications[0]).not.toHaveProperty('photoUrl');
  });

  it('given un leurre avec photo, when je touche « Retirer la photo » sur la photo existante, then elle est retirée à l\'enregistrement', async () => {
    const env = await ouvrir();
    await env.cliquer('Shad');
    await env.cliquer('Retirer la photo');
    expect(env.apercu()).toBeUndefined();
    await env.cliquer('Enregistrer');
    expect(env.modifications[0]['photoUrl']).toBeNull();
    expect(env.suppressions).toEqual([URL_ANCIENNE]);
  });
});
