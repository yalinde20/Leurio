/*
 * US 91 critère 3 : la page « Confidentialité » (texte du propriétaire, verbatim). Maquette : docs/maquettes/us-91-a-propos-confidentialite.html.
 * Classe attendue : `ConfidentialitePage` dans src/app/features/compte/confidentialite.page.ts (route enfant de Compte),
 * avec un `app-bouton-retour` « Compte » et le titre « Confidentialité ».
 * Contrat du DOM : les intertitres sont des h2 ou h3 ; les énumérations sont des `ul > li` ; l'e-mail est un lien `mailto:` ;
 * « cnil.fr » est un lien vers https://www.cnil.fr ; l'uid du compte (double de SOURCE_COMPTE) est affiché sous « Ton identifiant de compte ».
 * Date : « Mise à jour le 13 novembre 2026 » (date d'intégration).
 */
import { TestBed } from '@angular/core/testing';
import { compact, lien, ouvrirCompte, toucher } from './compte-informations.doubles';

beforeEach(() => localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] })));
afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});

async function ouvrirConfidentialite(uid: string | null = 'uid-test-123') {
  const env = await ouvrirCompte({ uid });
  await toucher(env.page, 'Confidentialité', env.stabiliser);
  return env;
}

const TITRES = [
  'Qui s’occupe de tes données',
  'Un compte sans nom ni e-mail',
  'Ce que Leurio garde en ligne',
  'Ce qui reste sur ton téléphone',
  'Ta position',
  'Les services qui aident Leurio',
  'Ce que Leurio ne fait pas',
  'Pourquoi Leurio peut le faire',
  'Combien de temps',
  'Attention : si tu supprimes l’app ou son raccourci',
  'Tes droits',
  'Ton identifiant de compte',
];

const PHRASES = [
  'Leurio est éditée par Yoan Alindé, responsable de tes données.',
  'Leurio te crée un compte anonyme : sans nom, sans e-mail, sans mot de passe.',
  'Une photo de plus de 200 Ko est réduite avant l’envoi.',
  'Les règles d’accès empêchent les autres utilisateurs de les lire ou de les modifier.',
  'Ces données ne sont pas envoyées à Leurio.',
  'Elle est envoyée telle quelle, sans être arrondie, à deux services publics de données :',
  'Open-Meteo indique garder les adresses IP et les requêtes pour surveiller l’usage de son service gratuit.',
  'Google est certifié au Data Privacy Framework UE–États-Unis, reconnu par la Commission européenne.',
  'Pas de publicité, pas de revente de données, pas de mesure d’audience.',
  'c’est l’intérêt légitime de l’éditeur à protéger l’app (article 6.1.f).',
  'un compte inactif n’est pas supprimé automatiquement.',
  'Si tu supprimes l’app, Leurio ne peut plus te le rendre, et tes données restent en ligne jusqu’à leur suppression.',
];

describe('US 91 : Confidentialité', () => {
  it('critère 3 : given l\'onglet « Compte » affiché, when je touche « Confidentialité », then la page de confidentialité s\'affiche avec son titre, sa date de mise à jour, ses 12 intertitres et le texte du propriétaire tel qu\'écrit', async () => {
    const { page } = await ouvrirConfidentialite();

    expect(page.querySelector('app-bouton-retour')?.textContent).toContain('Compte');
    expect(Array.from(page.querySelectorAll('ion-title')).map((t) => t.textContent?.trim())).toContain('Confidentialité');
    expect(compact(page.textContent)).toContain(compact('Mise à jour le 13 novembre 2026'));
    expect(page.textContent).not.toContain('[date]');

    const intertitres = Array.from(page.querySelectorAll('h2, h3')).map((h) => compact(h.textContent));
    for (const titre of TITRES) expect(intertitres, titre).toContain(compact(titre));

    for (const phrase of PHRASES) expect(compact(page.textContent), phrase).toContain(compact(phrase));
    // Pas de brouillon dans l'app.
    expect(compact(page.textContent)).not.toContain(compact('brouillon'));
  });

  it('critère 3 : given la page « Confidentialité », when je la lis, then les énumérations sont des listes, l\'e-mail est un lien mailto et « cnil.fr » un lien vers https://www.cnil.fr', async () => {
    const { page } = await ouvrirConfidentialite();

    const items = Array.from(page.querySelectorAll('ul li')).map((li) => compact(li.textContent));
    for (const debut of [
      'Ton niveau, tes espèces favorites',
      'Ta boîte à leurres : le type',
      'Open-Meteo, pour la météo ;',
      'Hub’Eau (Office français de la biodiversité et BRGM)',
      'Google Firebase : ton compte',
      'reCAPTCHA de Google, par Firebase App Check',
      'Ton compte, ta boîte et le conseil selon ta position',
      'La protection contre les abus',
    ]) {
      expect(items.some((t) => t.startsWith(compact(debut))), debut).toBe(true);
    }

    const mails = Array.from(page.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]'));
    expect(mails.length).toBeGreaterThanOrEqual(1);
    expect(mails.every((a) => a.getAttribute('href') === 'mailto:yoyoalinde@gmail.com')).toBe(true);

    const cnil = lien(page, 'cnil.fr');
    expect(cnil?.getAttribute('href')).toMatch(/^https:\/\/www\.cnil\.fr\/?$/);
    expect(cnil?.target).toBe('_blank');
    expect(cnil?.rel).toContain('noopener');
  });

  it('critère 3 : given un compte anonyme, when j\'ouvre « Confidentialité », then mon identifiant de compte est affiché en bas de la page, sans le texte « [uid du compte] »', async () => {
    const { page } = await ouvrirConfidentialite('uid-test-123');

    const titre = Array.from(page.querySelectorAll('h2, h3')).find((h) => compact(h.textContent) === compact('Ton identifiant de compte'));
    expect(titre, 'intertitre').toBeTruthy();
    expect(page.textContent).toContain('uid-test-123');
    expect(page.textContent).not.toContain('[uid du compte]');
    expect(page.textContent).not.toContain('Pas encore de compte');
    // Il vient après l'intertitre.
    const apres = compact(page.textContent).split(compact('Ton identifiant de compte')).pop();
    expect(apres).toContain('uid-test-123');
  });

  it('critère 3 : given aucun compte, when j\'ouvre « Confidentialité », then « Pas encore de compte » remplace l\'identifiant', async () => {
    const { page } = await ouvrirConfidentialite(null);

    expect(compact(page.textContent)).toContain(compact('Pas encore de compte'));
    expect(page.textContent).not.toContain('[uid du compte]');
    expect(page.textContent).not.toContain('uid-test-123');
  });
});
