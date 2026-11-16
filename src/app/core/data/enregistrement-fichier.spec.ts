import { creerEnregistrementNatif, creerEnregistrementWeb } from './export.service';

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
});
