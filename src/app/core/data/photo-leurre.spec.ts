import { TestBed } from '@angular/core/testing';
import { AccesPhotoRefuse, compresserPhoto, EchecEnvoiPhoto, SOURCE_PHOTO } from './photo-leurre';
import { DocumentLeurre, SOURCE_TACKLE_BOX, TackleBoxService } from './tackle-box.service';

const URL_ANCIENNE = 'https://stockage.test/users/u1/lures/ancienne.jpg';
const attendre = () => new Promise<void>((r) => setTimeout(r));
const photo = () => new Blob([new Uint8Array(1024)], { type: 'image/jpeg' });

describe('photo-leurre', () => {
  it('given une photo sous le seuil, when je la compresse, then elle est rendue telle quelle', async () => {
    const p = photo();
    expect(await compresserPhoto(p)).toBe(p);
    expect(await compresserPhoto(p, 1024)).toBe(p);
  });

  it('given le navigateur, when je lis la source de photo, then elle dit si le réseau est là', () => {
    expect(TestBed.inject(SOURCE_PHOTO).enLigne()).toBe(navigator.onLine);
  });

  it('given un refus d\'accès, when je l\'inspecte, then c\'est une erreur AccesPhotoRefuse', () => {
    expect(new AccesPhotoRefuse()).toBeInstanceOf(Error);
    expect(new AccesPhotoRefuse().message).toBe('Accès à l\'appareil photo refusé.');
  });
});

describe('TackleBoxService : cas limites de la photo (US 102)', () => {
  function creer(options: { echecEnvoi?: boolean; echecSuppressionPhoto?: boolean }) {
    const ajouts: Record<string, unknown>[] = [];
    const docs: DocumentLeurre[] = [
      { id: 'a', enAttente: false, data: { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon', createdAt: 1, photoUrl: URL_ANCIENNE } },
    ];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SOURCE_TACKLE_BOX,
          useValue: {
            uid: async () => 'u1',
            ecouter: (_u: string, ok: (d: DocumentLeurre[]) => void) => (ok(docs), () => undefined),
            ajouter: async (_u: string, data: Record<string, unknown>) => void ajouts.push(data),
            modifier: async () => undefined,
            supprimer: async () => undefined,
            envoyerPhoto: async () => {
              if (options.echecEnvoi) throw new Error('réseau');
              return 'https://stockage.test/nouvelle.jpg';
            },
            supprimerPhoto: async () => {
              if (options.echecSuppressionPhoto) throw new Error('réseau');
            },
          },
        },
      ],
    });
    return { service: TestBed.inject(TackleBoxService), ajouts };
  }
  const saisie = { typeId: 'shad', tailleCm: 10, poidsG: 12, couleur: 'gardon' };

  it('given l\'envoi échoue, when j\'ajoute un leurre avec photo, then l\'erreur est une EchecEnvoiPhoto', async () => {
    const t = creer({ echecEnvoi: true });
    await expect(t.service.ajouter({ ...saisie, photo: photo() })).rejects.toBeInstanceOf(EchecEnvoiPhoto);
    expect(t.ajouts).toEqual([]);
  });

  it('given la suppression du fichier échoue, when je supprime ou remplace, then l\'opération réussit quand même', async () => {
    const t = creer({ echecSuppressionPhoto: true });
    await attendre();
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(t.service.supprimer('a')).resolves.toBeUndefined();
    await expect(t.service.modifier('a', { ...saisie, photo: null })).resolves.toBeUndefined();
    expect(avertir).toHaveBeenCalledTimes(2);
    avertir.mockRestore();
  });
});
