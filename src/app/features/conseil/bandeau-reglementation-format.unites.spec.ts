import { composerReglementation } from './bandeau-reglementation-format';

const sandre = { nom: 'Sandre', tailleMinCm: 50, fermetureAvecBrochet: false, verifDepartementPrintemps: false };
const date = new Date('2026-11-09T12:00:00Z');
const compact = (t: string | undefined): string => (t ?? '').replace(/\s/g, '');
const tailleMinimale = (unites?: 'metriques' | 'imperiales') =>
  compact(composerReglementation(2, sandre, date, [], unites).find((l) => l.libelle === 'Taille minimale')?.valeur);

describe('Bandeau « Réglementation » : unités (US 93)', () => {
  it('given le système impérial, when le bandeau affiche la taille minimale du sandre, then elle est en po', () => {
    expect(tailleMinimale('imperiales')).toBe('19,7po');
  });

  it('given le système métrique ou aucun choix, when le bandeau affiche la taille minimale, then elle reste en cm', () => {
    expect(tailleMinimale('metriques')).toBe('50cm');
    expect(tailleMinimale()).toBe('50cm');
  });
});
