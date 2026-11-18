import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { creerEnregistrementNatif, creerEnregistrementWeb, ENREGISTREMENT_FICHIER, ExportAnnule } from './export.service';

const filesystem = vi.hoisted(() => ({ writeFile: vi.fn() }));
const partage = vi.hoisted(() => ({ share: vi.fn() }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: filesystem,
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: partage }));

afterEach(() => vi.restoreAllMocks());

describe('US 97 : enregistrement du fichier exporté', () => {
  it('given le web, when j\'enregistre, then un lien « download » au nom du fichier est touché avec le contenu en JSON', async () => {
    const contenus: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => (contenus.push(b as Blob), 'blob:test'));
    URL.revokeObjectURL = vi.fn();
    const liens: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      liens.push(this);
    });

    await creerEnregistrementWeb().enregistrer('leurio-export-2026-11-16.json', '{"a":1}');

    expect(liens).toHaveLength(1);
    expect(liens[0].download).toBe('leurio-export-2026-11-16.json');
    expect(liens[0].href).toBe('blob:test');
    expect(await contenus[0].text()).toBe('{"a":1}');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('given le web, when j\'enregistre, then l\'adresse du fichier n\'est libérée qu\'après 60 s', async () => {
    vi.useFakeTimers();
    try {
      URL.createObjectURL = vi.fn(() => 'blob:test');
      const liberer = vi.fn();
      URL.revokeObjectURL = liberer;
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

      await creerEnregistrementWeb().enregistrer('a.json', '{}');
      vi.advanceTimersByTime(0);
      expect(liberer).not.toHaveBeenCalled();
      vi.advanceTimersByTime(59_000);
      expect(liberer).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1_000);
      expect(liberer).toHaveBeenCalledWith('blob:test');
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [true, 'natif'],
    [false, 'web'],
  ])('given Capacitor.isNativePlatform() = %s, when le jeton est résolu, then l\'enregistrement %s est choisi', async (natif) => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(natif);
    filesystem.writeFile.mockResolvedValue({ uri: 'file:///x' });
    partage.share.mockResolvedValue({});
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    filesystem.writeFile.mockClear();

    await TestBed.inject(ENREGISTREMENT_FICHIER).enregistrer('a.json', '{}');

    expect(filesystem.writeFile).toHaveBeenCalledTimes(natif ? 1 : 0);
    expect(clic).toHaveBeenCalledTimes(natif ? 0 : 1);
  });

  it('given l\'app native, when j\'enregistre, then le fichier est écrit dans le cache puis la feuille de partage s\'ouvre dessus', async () => {
    filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/leurio-export-2026-11-16.json' });
    partage.share.mockResolvedValue({ activityType: 'x' });

    await creerEnregistrementNatif().enregistrer('leurio-export-2026-11-16.json', '{"a":1}');

    expect(filesystem.writeFile).toHaveBeenCalledWith({
      path: 'leurio-export-2026-11-16.json',
      data: '{"a":1}',
      directory: 'CACHE',
      encoding: 'utf8',
    });
    expect(partage.share).toHaveBeenCalledWith({ title: 'leurio-export-2026-11-16.json', files: ['file:///cache/leurio-export-2026-11-16.json'] });
  });

  it('given l\'app native, when je ferme la feuille de partage sans rien choisir, then l\'enregistrement rejette avec ExportAnnule (décision du propriétaire, US 97)', async () => {
    filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/leurio-export-2026-11-16.json' });
    partage.share.mockRejectedValue(new Error('Share canceled'));

    await expect(creerEnregistrementNatif().enregistrer('leurio-export-2026-11-16.json', '{"a":1}')).rejects.toBeInstanceOf(ExportAnnule);
  });

  it('given l\'app native, when le partage échoue pour une autre raison, then l\'erreur n\'est pas prise pour une annulation', async () => {
    filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/leurio-export-2026-11-16.json' });
    partage.share.mockRejectedValue(new Error('Can\'t share while sharing is in progress'));

    const erreur = await creerEnregistrementNatif().enregistrer('leurio-export-2026-11-16.json', '{"a":1}').catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(Error);
    expect(erreur).not.toBeInstanceOf(ExportAnnule);
  });
});
