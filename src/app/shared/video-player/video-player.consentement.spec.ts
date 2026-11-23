import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE } from '../../core/data/compte.service';
import { ConsentementsService } from '../../core/data/consentements.service';
import { SOURCE_PROFIL } from '../../core/data/profil.service';
import { Video } from '../../core/data/catalog.types';
import { VideoPlayerComponent } from './video-player.component';

const YOUTUBE: Video = { provider: 'youtube', id: 'yt123', start: 5, auteur: 'Auteur', lienAuteur: 'https://exemple.fr/chaine' };

type Stocke = { analytics: boolean; video: boolean | null } | null;

function preparer(lecture: (uid: string) => Promise<Stocke>, etat = { uid: 'uid-A' }) {
  TestBed.configureTestingModule({
    providers: [
      { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => etat.uid, connecterAnonymement: async () => 'x', profilExiste: async () => true, ecrireProfil: async () => undefined } },
      { provide: SOURCE_PROFIL, useValue: { mettreAJour: async () => undefined, lireConsentements: lecture } },
    ],
  });
  return etat;
}

async function afficher() {
  const fixture = TestBed.createComponent(VideoPlayerComponent);
  fixture.componentRef.setInput('videos', [YOUTUBE]);
  fixture.componentRef.setInput('titre', 'Test');
  const racine = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  await stabiliser();
  return { racine, stabiliser };
}

afterEach(() => TestBed.resetTestingModule());

describe('VideoPlayerComponent, consentement vidéo (US 10)', () => {
  it("given la lecture des consentements en attente, when la fiche s'affiche, then ni lecteur ni question ne sont montrés", async () => {
    preparer(() => new Promise<Stocke>(() => undefined));
    const { racine } = await afficher();
    expect(racine.querySelector('iframe')).toBeNull();
    expect(racine.textContent).not.toContain('La charger ?');
    expect(racine.textContent).not.toContain('Vidéo complète');
  });

  it("given le compte A avait accepté la vidéo puis le compte a changé, when la lecture du compte B est en attente, then aucun <iframe> n'est créé", async () => {
    const etat = preparer(async (uid) => (uid === 'uid-A' ? { analytics: false, video: true } : new Promise<Stocke>(() => undefined)));
    await TestBed.inject(ConsentementsService).charger();
    expect(TestBed.inject(ConsentementsService).video()).toBe(true);
    etat.uid = 'uid-B';

    const { racine } = await afficher();

    expect(racine.querySelector('iframe')).toBeNull();
    expect(racine.textContent).not.toContain('La charger ?');
  });

  it("given le compte B n'a jamais répondu, when sa lecture se termine, then la question est posée et il n'y a toujours pas d'<iframe>", async () => {
    const etat = preparer(async (uid) => (uid === 'uid-A' ? { analytics: false, video: true } : { analytics: false, video: null }));
    await TestBed.inject(ConsentementsService).charger();
    etat.uid = 'uid-B';

    const { racine } = await afficher();

    expect(racine.querySelector('iframe')).toBeNull();
    expect(racine.textContent).toContain('La charger ?');
  });

  it("given une vidéo avec lienAuteur, when elle est lue, then le lien finit par une icône masquée aux lecteurs d'écran et annonce qu'il ouvre hors de l'app", async () => {
    preparer(async () => ({ analytics: false, video: true }));
    const { racine } = await afficher();
    const lien = racine.querySelector('.credit a')!;
    expect(lien.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(lien.getAttribute('aria-label')).toContain("s'ouvre hors de l'app");
  });
});
