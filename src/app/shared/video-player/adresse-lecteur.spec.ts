import { adresseLecteur } from './video-player.component';

describe('adresseLecteur (US 10)', () => {
  it('given une vidéo de chaque plateforme, when on construit l\'adresse, then c\'est le lecteur officiel démarrant à start', () => {
    expect(adresseLecteur({ provider: 'youtube', id: 'abc', start: 95 })).toBe('https://www.youtube-nocookie.com/embed/abc?start=95&playsinline=1');
    expect(adresseLecteur({ provider: 'vimeo', id: '123', start: 12 })).toBe('https://player.vimeo.com/video/123#t=12s');
    expect(adresseLecteur({ provider: 'dailymotion', id: 'x8abc', start: 3 })).toBe('https://geo.dailymotion.com/player.html?video=x8abc&startTime=3');
  });

  it('given un identifiant avec des caractères d\'URL, when on construit l\'adresse, then il est encodé et ne change ni l\'hôte ni le chemin', () => {
    const url = new URL(adresseLecteur({ provider: 'youtube', id: 'a/../b?x=1#', start: 1 }));
    expect(url.host).toBe('www.youtube-nocookie.com');
    expect(url.pathname).toBe('/embed/a%2F..%2Fb%3Fx%3D1%23');
  });

  it('given un start absent ou invalide, when on construit l\'adresse, then la lecture démarre à 0', () => {
    expect(adresseLecteur({ provider: 'youtube', id: 'abc' })).toContain('start=0');
    expect(adresseLecteur({ provider: 'youtube', id: 'abc', start: -5 })).toContain('start=0');
    expect(adresseLecteur({ provider: 'youtube', id: 'abc', start: 7.9 })).toContain('start=7&');
  });
});
