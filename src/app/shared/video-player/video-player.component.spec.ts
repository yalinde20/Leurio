import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideoPlayerComponent } from './video-player.component';
import { Video } from '../../core/data/catalog.types';

const BOUCLE: Video = { provider: 'self', fichier: 'videos/test.mp4', boucle: true, horsLigne: true, licence: 'propre' };

async function afficher(videos: Video[]): Promise<{ fixture: ComponentFixture<VideoPlayerComponent>; zone: () => HTMLElement; video: () => HTMLVideoElement }> {
  const fixture = TestBed.createComponent(VideoPlayerComponent);
  fixture.componentRef.setInput('videos', videos);
  fixture.detectChanges();
  const racine = fixture.nativeElement as HTMLElement;
  return { fixture, zone: () => racine.querySelector('.zone') as HTMLElement, video: () => racine.querySelector('video') as HTMLVideoElement };
}
const visible = (zone: HTMLElement | null): boolean => !!zone && zone.classList.contains('prete');

describe('VideoPlayerComponent (US 9)', () => {
  it('given une boucle « self », when le fichier n\'est pas encore prêt, then la zone est dans le DOM mais pas visible, puis visible après canplay', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    const { fixture, zone, video } = await afficher([BOUCLE]);
    expect(video()).not.toBeNull();
    expect(zone().getAttribute('aria-hidden')).toBe('true');
    expect(visible(zone())).toBe(false);

    video().dispatchEvent(new Event('canplay'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(visible(zone())).toBe(true);
  });

  it('given une boucle prête, when play() est refusé, then la zone disparaît comme pour un fichier absent', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.reject(new DOMException('refusé', 'NotAllowedError')));
    const { fixture, zone, video } = await afficher([BOUCLE]);
    video().dispatchEvent(new Event('canplay'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(zone()).toBeNull();
  });

  it('given une boucle en erreur, when la vidéo choisie change, then la nouvelle zone repart en attente', async () => {
    const { fixture, zone, video } = await afficher([BOUCLE]);
    video().dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(zone()).toBeNull();

    fixture.componentRef.setInput('videos', [{ ...BOUCLE, fichier: 'videos/autre.mp4' }]);
    fixture.detectChanges();
    expect(zone()).not.toBeNull();
    expect(visible(zone())).toBe(false);
  });
});
