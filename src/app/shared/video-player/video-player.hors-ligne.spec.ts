/*
 * US 11 : sans réseau, la boucle courte remplace la vidéo tierce (PLAN §3, §4, §9 bis, §11).
 * Maquette validée : docs/maquettes/us-11-boucle-sans-reseau.html.
 *
 * Contrat supposé (décisions du propriétaire) :
 *  - « sans réseau » = `navigator.onLine === false` ; les événements `offline` et `online` de `window` font changer l'écran sans recharger ;
 *  - hors ligne, aucun <iframe> et ni titre « Vidéo complète » ni crédit ; avec une boucle : juste sous elle, « Hors ligne : la vidéo complète sera disponible avec du réseau » ;
 *    sans boucle (ou si son fichier échoue) : une zone « Vidéo disponible avec du réseau » ;
 *  - consentement jamais répondu hors ligne : la question n'est PAS posée ; au retour du réseau, elle l'est (aucun <iframe>) ;
 *  - consentement refusé hors ligne : ni titre, ni phrase « Hors ligne… », ni zone « Vidéo disponible… » : la boucle seule ;
 *  - au retour du réseau (consentement accepté) : le lecteur se charge, avec titre et crédit comme à l'US 10 ; la boucle reste au-dessus.
 * Aucun réseau réel : les doubles SOURCE_COMPTE et SOURCE_PROFIL remplacent Firebase, jsdom ne charge ni <iframe> ni <video>.
 */
import { TestBed } from '@angular/core/testing';
import { SOURCE_COMPTE } from '../../core/data/compte.service';
import { SOURCE_PROFIL } from '../../core/data/profil.service';
import { Video } from '../../core/data/catalog.types';
import { VideoPlayerComponent } from './video-player.component';

const YOUTUBE: Video = { provider: 'youtube', id: 'yt123', start: 42, auteur: 'La Minute Carna', lienAuteur: 'https://exemple.fr/chaine' };
const BOUCLE: Video = { provider: 'self', fichier: 'videos/test.mp4', boucle: true, horsLigne: true, licence: 'propre' };

const TEXTE_HORS_LIGNE = 'Hors ligne : la vidéo complète sera disponible avec du réseau';
const TEXTE_SANS_BOUCLE = 'Vidéo disponible avec du réseau';
const QUESTION = 'Cette vidéo est hébergée par YouTube. La charger ?';

interface Stocke {
  analytics: boolean;
  video: boolean | null;
}

let enLigne: ReturnType<typeof vi.spyOn>;

function passerHorsLigne(): void {
  enLigne.mockReturnValue(false);
  window.dispatchEvent(new Event('offline'));
}
function revenirEnLigne(): void {
  enLigne.mockReturnValue(true);
  window.dispatchEvent(new Event('online'));
}

/** `reseau` : l'état du réseau à l'ouverture de la fiche. */
async function afficher(videos: Video[], stocke: Stocke, reseau: 'hors-ligne' | 'en-ligne' = 'hors-ligne') {
  TestBed.configureTestingModule({
    providers: [
      { provide: SOURCE_COMPTE, useValue: { uidCourant: async () => 'uid-A', connecterAnonymement: async () => 'uid-A', profilExiste: async () => true, ecrireProfil: async () => undefined } },
      { provide: SOURCE_PROFIL, useValue: { mettreAJour: async () => undefined, lireConsentements: async () => stocke } },
    ],
  });
  enLigne.mockReturnValue(reseau === 'en-ligne');
  const fixture = TestBed.createComponent(VideoPlayerComponent);
  fixture.componentRef.setInput('videos', videos);
  fixture.componentRef.setInput('titre', 'Tirée-relâchée');
  const racine = fixture.nativeElement as HTMLElement;
  const stabiliser = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  await stabiliser();
  return { racine, stabiliser, fixture };
}

const texte = (racine: HTMLElement): string => (racine.textContent ?? '').replace(/\s+/g, ' ');
const titres = (racine: HTMLElement): string[] => [...racine.querySelectorAll('h3')].map((h) => (h.textContent ?? '').trim());

beforeEach(() => {
  enLigne = vi.spyOn(navigator, 'onLine', 'get');
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('VideoPlayerComponent sans réseau (US 11)', () => {
  it('critère 1 : given le consentement accepté, une vidéo YouTube et une boucle « self », et l\'appareil en mode avion, when j\'ouvre la fiche, then aucun lecteur tiers n\'est chargé et la boucle est lue avec « Hors ligne : la vidéo complète sera disponible avec du réseau »', async () => {
    const { racine } = await afficher([YOUTUBE, BOUCLE], { analytics: false, video: true });

    expect(racine.querySelector('iframe')).toBeNull();
    expect(racine.innerHTML).not.toMatch(/youtube/i);
    expect(titres(racine)).not.toContain('Vidéo complète');
    expect(racine.querySelector('.credit')).toBeNull();
    const video = racine.querySelector('video');
    expect(video, 'la boucle courte est dans la fiche').not.toBeNull();
    expect(video!.getAttribute('src')).toBe('assets/videos/test.mp4');
    expect(video!.hasAttribute('autoplay') || video!.autoplay).toBe(true);
    expect(texte(racine)).toContain(TEXTE_HORS_LIGNE);
    expect(texte(racine)).not.toContain(TEXTE_SANS_BOUCLE);
  });

  it('critère 1 : given la boucle et la phrase hors ligne, when je regarde leur place, then la phrase est juste sous la boucle', async () => {
    const { racine } = await afficher([YOUTUBE, BOUCLE], { analytics: false, video: true });

    const zone = racine.querySelector('.zone')!;
    const phrase = [...racine.querySelectorAll('p')].find((p) => (p.textContent ?? '').includes('Hors ligne'));
    expect(zone).not.toBeNull();
    expect(phrase, 'la phrase hors ligne est un paragraphe').toBeDefined();
    expect(zone.compareDocumentPosition(phrase!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('critère 2 : given une animation sans vidéo « self » et l\'appareil en mode avion, when j\'ouvre la fiche, then la zone vidéo affiche « Vidéo disponible avec du réseau » et aucun lecteur tiers n\'est chargé', async () => {
    const { racine } = await afficher([YOUTUBE], { analytics: false, video: true });

    expect(texte(racine)).toContain(TEXTE_SANS_BOUCLE);
    expect(texte(racine)).not.toContain('Hors ligne');
    expect(racine.querySelector('iframe')).toBeNull();
    expect(racine.querySelector('video')).toBeNull();
    expect(titres(racine)).not.toContain('Vidéo complète');
    expect(racine.querySelector('.credit')).toBeNull();
  });

  it('critère 2 : given une boucle dont le fichier échoue et l\'appareil en mode avion, when l\'erreur de chargement survient, then la zone « Vidéo disponible avec du réseau » remplace la phrase sous la boucle', async () => {
    const { racine, stabiliser } = await afficher([YOUTUBE, BOUCLE], { analytics: false, video: true });
    expect(texte(racine)).toContain(TEXTE_HORS_LIGNE);

    racine.querySelector('video')!.dispatchEvent(new Event('error'));
    await stabiliser();

    expect(racine.querySelector('video')).toBeNull();
    expect(texte(racine)).toContain(TEXTE_SANS_BOUCLE);
    expect(racine.querySelector('iframe')).toBeNull();
  });

  it('critère 3 : given la fiche ouverte hors ligne avec la boucle courte et le consentement accepté, when le réseau revient, then le lecteur tiers se charge, la phrase hors ligne disparaît et la boucle reste', async () => {
    const { racine, stabiliser } = await afficher([YOUTUBE, BOUCLE], { analytics: false, video: true });
    expect(racine.querySelector('iframe')).toBeNull();

    revenirEnLigne();
    await stabiliser();

    const lecteur = racine.querySelector('iframe');
    expect(lecteur, 'le lecteur tiers est chargé').not.toBeNull();
    expect(new URL(lecteur!.getAttribute('src')!).host).toBe('www.youtube-nocookie.com');
    expect(titres(racine)).toContain('Vidéo complète');
    expect(racine.querySelector('.credit')?.textContent).toContain('La Minute Carna');
    expect(texte(racine)).not.toContain('Hors ligne');
    expect(racine.querySelector('video'), 'la boucle reste au-dessus').not.toBeNull();
  });

  it('critère 3 : given la fiche ouverte hors ligne sans boucle, when le réseau revient, then la zone « Vidéo disponible avec du réseau » laisse la place au lecteur tiers', async () => {
    const { racine, stabiliser } = await afficher([YOUTUBE], { analytics: false, video: true });
    expect(texte(racine)).toContain(TEXTE_SANS_BOUCLE);

    revenirEnLigne();
    await stabiliser();

    expect(racine.querySelector('iframe')).not.toBeNull();
    expect(texte(racine)).not.toContain(TEXTE_SANS_BOUCLE);
    expect(titres(racine)).toContain('Vidéo complète');
  });

  it('critère 3 : given la fiche ouverte en ligne avec le lecteur, when le réseau tombe, then le lecteur est retiré et la phrase hors ligne s\'affiche sous la boucle', async () => {
    const { racine, stabiliser } = await afficher([YOUTUBE, BOUCLE], { analytics: false, video: true }, 'en-ligne');
    expect(racine.querySelector('iframe')).not.toBeNull();
    expect(texte(racine)).not.toContain('Hors ligne');

    passerHorsLigne();
    await stabiliser();

    expect(racine.querySelector('iframe')).toBeNull();
    expect(texte(racine)).toContain(TEXTE_HORS_LIGNE);
  });

  it('cas limite : given le consentement jamais répondu et l\'appareil en mode avion, when j\'ouvre la fiche, then la question n\'est pas posée et l\'écran est celui du mode avion', async () => {
    const { racine } = await afficher([YOUTUBE, BOUCLE], { analytics: false, video: null });

    expect(texte(racine)).not.toContain(QUESTION);
    expect(racine.querySelector('button')).toBeNull();
    expect(racine.querySelector('iframe')).toBeNull();
    expect(titres(racine)).not.toContain('Vidéo complète');
    expect(texte(racine)).toContain(TEXTE_HORS_LIGNE);
  });

  it('cas limite : given le consentement jamais répondu, hors ligne, when le réseau revient, then la question apparaît, sans aucun <iframe>', async () => {
    const { racine, stabiliser } = await afficher([YOUTUBE, BOUCLE], { analytics: false, video: null });

    revenirEnLigne();
    await stabiliser();

    expect(texte(racine)).toContain(QUESTION);
    expect(racine.querySelector('iframe')).toBeNull();
    expect(texte(racine)).not.toContain('Hors ligne');
    expect(racine.querySelector('video')).not.toBeNull();
  });

  it('cas limite : given le consentement jamais répondu, sans boucle et hors ligne, when le réseau revient, then la question apparaît à la place de la zone « Vidéo disponible avec du réseau »', async () => {
    const { racine, stabiliser } = await afficher([YOUTUBE], { analytics: false, video: null });
    expect(texte(racine)).toContain(TEXTE_SANS_BOUCLE);
    expect(texte(racine)).not.toContain(QUESTION);

    revenirEnLigne();
    await stabiliser();

    expect(texte(racine)).toContain(QUESTION);
    expect(texte(racine)).not.toContain(TEXTE_SANS_BOUCLE);
    expect(racine.querySelector('iframe')).toBeNull();
  });

  it('cas limite : given le consentement refusé et l\'appareil en mode avion, when j\'ouvre la fiche, then ni rubrique, ni phrase hors ligne, ni zone « Vidéo disponible avec du réseau » : la boucle est lue seule', async () => {
    const { racine } = await afficher([YOUTUBE, BOUCLE], { analytics: false, video: false });

    expect(racine.querySelector('video')).not.toBeNull();
    expect(titres(racine)).not.toContain('Vidéo complète');
    expect(texte(racine)).not.toContain('Hors ligne');
    expect(texte(racine)).not.toContain(TEXTE_SANS_BOUCLE);
    expect(texte(racine)).not.toContain(QUESTION);
    expect(racine.querySelector('iframe')).toBeNull();
  });

  it('cas limite : given le consentement refusé, sans boucle et hors ligne, when j\'ouvre la fiche, then la fiche n\'a aucune zone vidéo', async () => {
    const { racine } = await afficher([YOUTUBE], { analytics: false, video: false });

    expect(texte(racine)).not.toContain(TEXTE_SANS_BOUCLE);
    expect(texte(racine)).not.toContain('Hors ligne');
    expect(racine.querySelector('iframe')).toBeNull();
  });

  it('given une animation sans vidéo tierce et l\'appareil en mode avion, when j\'ouvre la fiche, then aucun message de réseau n\'est affiché', async () => {
    const { racine } = await afficher([BOUCLE], { analytics: false, video: true });

    expect(racine.querySelector('video')).not.toBeNull();
    expect(texte(racine)).not.toContain('Hors ligne');
    expect(texte(racine)).not.toContain(TEXTE_SANS_BOUCLE);
  });
});
