/*
 * US 91 critère 2 : la page « À propos et sources ». Maquette : docs/maquettes/us-91-a-propos-confidentialite.html.
 * Classe attendue : `AProposPage` dans src/app/features/compte/a-propos.page.ts (route enfant de Compte), avec un
 * `app-bouton-retour` « Compte ». Les sources viennent du contenu (HttpClient sur assets/data/*.json, ici un double
 * qui sert CONTENU) : aucune chaîne de source dans le code.
 * Contrat du DOM : un groupe par fichier de contenu = `<details><summary>` ou un bouton `aria-expanded` ; le résumé
 * porte le libellé et « N source(s) » ; chaque source est un `li` ; une URL http(s) devient un lien (target _blank, rel noopener).
 */
import { TestBed } from '@angular/core/testing';
import { compact, lien, ouvrirCompte, toucher, trouver } from './compte-informations.doubles';

beforeEach(() => localStorage.setItem('leurio.onboarding', JSON.stringify({ niveau: 'debutant', especesFavorites: [] })));
afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});

async function ouvrirAPropos() {
  const env = await ouvrirCompte();
  await toucher(env.page, 'À propos et sources', env.stabiliser);
  return env;
}

/** Le résumé (summary ou bouton aria-expanded) d'un groupe de contenu. */
const resume = (page: HTMLElement, libelle: string): HTMLElement | undefined =>
  Array.from(page.querySelectorAll<HTMLElement>('summary, button[aria-expanded]')).find((e) => compact(e.textContent).includes(compact(libelle)));
const conteneur = (r: HTMLElement): HTMLElement => (r.closest('details') ?? r.parentElement) as HTMLElement;
const ouvert = (r: HTMLElement): boolean => {
  const d = r.closest('details');
  return d ? d.open : r.getAttribute('aria-expanded') === 'true';
};
const sourcesDe = (page: HTMLElement, libelle: string): string[] => {
  const r = resume(page, libelle)!;
  return Array.from(conteneur(r).querySelectorAll('li')).map((li) => li.textContent!.trim());
};

describe('US 91 : À propos et sources', () => {
  it('critère 2 : given l\'onglet « Compte » affiché, when je touche « À propos et sources », then la page cite Hub\'Eau, Open-Meteo et OpenStreetMap avec leur lien', async () => {
    const { page } = await ouvrirAPropos();

    expect(compact(page.textContent)).toContain(compact('Données en direct'));
    for (const nom of ['Hub’Eau', 'Open-Meteo', 'OpenStreetMap']) expect(compact(page.textContent), nom).toContain(compact(nom));
    expect(compact(page.textContent)).toContain(compact('Température et débit des rivières'));
    expect(compact(page.textContent)).toContain(compact('Météo : pression, nuages, vent, températures de l’air.'));
    expect(compact(page.textContent)).toContain(compact('© les contributrices et contributeurs d’OpenStreetMap.'));
    for (const domaine of ['hubeau.eaufrance.fr', 'open-meteo.com', 'openstreetmap.org']) {
      const a = Array.from(page.querySelectorAll<HTMLAnchorElement>('a')).find((x) => x.href.includes(domaine));
      expect(a, domaine).toBeTruthy();
      expect(a!.target).toBe('_blank');
      expect(a!.rel).toContain('noopener');
    }
    expect(page.querySelector('app-bouton-retour')?.textContent).toContain('Compte');
  });

  it('critère 2 : given la page « À propos et sources », when je la regarde, then un groupe par fichier de contenu qui a des sources, dans l\'ordre de la maquette, avec « N source(s) » dédoublonné, et les fichiers sans source sont ignorés', async () => {
    const { page } = await ouvrirAPropos();

    expect(compact(page.textContent)).toContain(compact('Contenu de l’app'));
    const attendus: [string, string][] = [
      ['Espèces', '4 sources'], // S1 commune (x2), URL, S2, imbriquée : 4 distinctes
      ['Types de leurres', '1 source'],
      ['Animations', '2 sources'],
      ['Fédérations de pêche', '1 source'],
      ['Départements', '1 source'], // « D1 IGN » deux fois
    ];
    for (const [libelle, compte] of attendus) {
      const r = resume(page, libelle);
      expect(r, libelle).toBeTruthy();
      expect(compact(r!.textContent), libelle).toContain(compact(compte));
    }
    // Ni sources, ni sources vides : pas de groupe.
    for (const libelle of ['Familles de leurres', 'Couleurs', 'Kit de départ']) expect(resume(page, libelle), libelle).toBeUndefined();

    // Ordre : Espèces, Types de leurres, Animations, Fédérations de pêche, Départements.
    const ordre = Array.from(page.querySelectorAll<HTMLElement>('summary, button[aria-expanded]')).map((e) => compact(e.textContent));
    const positions = attendus.map(([libelle]) => ordre.findIndex((t) => t.includes(compact(libelle))));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('critère 2 : given la page « À propos et sources », when elle s\'affiche puis que je touche « Espèces », then le groupe est replié par défaut, puis il montre les sources trouvées partout dans le fichier, dédoublonnées, dans l\'ordre du fichier et telles qu\'écrites', async () => {
    const { page, stabiliser } = await ouvrirAPropos();

    for (const libelle of ['Espèces', 'Types de leurres', 'Animations', 'Fédérations de pêche', 'Départements']) {
      expect(resume(page, libelle) && ouvert(resume(page, libelle)!), `${libelle} replié`).toBe(false);
    }

    resume(page, 'Espèces')!.click();
    await stabiliser();
    expect(ouvert(resume(page, 'Espèces')!)).toBe(true);
    expect(sourcesDe(page, 'Espèces').map(compact)).toEqual(
      ['S1 commune', 'https://exemple.test/sandre', 'S2 brochet', 'S3 imbriquée'].map(compact),
    );
    // Les autres groupes restent repliés.
    expect(ouvert(resume(page, 'Animations')!)).toBe(false);

    resume(page, 'Départements')!.click();
    await stabiliser();
    expect(sourcesDe(page, 'Départements').map(compact)).toEqual([compact('D1 IGN')]);
    resume(page, 'Animations')!.click();
    await stabiliser();
    expect(sourcesDe(page, 'Animations').map(compact)).toEqual([compact('A1 tirée'), compact('A2 twitching')]);
  });

  it('critère 2 : given une source qui est une URL ou qui en contient une, when j\'ouvre son groupe, then l\'URL est un lien qui s\'ouvre dans un nouvel onglet et le texte reste tel qu\'écrit', async () => {
    const { page, stabiliser } = await ouvrirAPropos();
    resume(page, 'Espèces')!.click();
    resume(page, 'Types de leurres')!.click();
    await stabiliser();

    const seule = lien(conteneur(resume(page, 'Espèces')!), 'https://exemple.test/sandre');
    expect(seule?.getAttribute('href')).toBe('https://exemple.test/sandre');
    expect(seule?.target).toBe('_blank');
    expect(seule?.rel).toContain('noopener');

    const groupe = conteneur(resume(page, 'Types de leurres')!);
    const dansUnePhrase = Array.from(groupe.querySelectorAll<HTMLAnchorElement>('a')).find((a) => a.getAttribute('href') === 'https://exemple.test/shads');
    expect(dansUnePhrase, 'lien de la phrase').toBeTruthy();
    expect(dansUnePhrase!.target).toBe('_blank');
    expect(dansUnePhrase!.rel).toContain('noopener');
    expect(sourcesDe(page, 'Types de leurres').map(compact)).toEqual([compact('Guide des shads : https://exemple.test/shads (consulté en 2026)')]);
    // Une source sans URL n'est pas un lien.
    expect(trouver(conteneur(resume(page, 'Espèces')!), 'S2 brochet')?.closest('a')).toBeNull();
  });
});
