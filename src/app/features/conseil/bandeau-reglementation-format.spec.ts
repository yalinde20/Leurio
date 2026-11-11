import { composerReglementation, formaterJourMois } from './bandeau-reglementation-format';

const sandre = { nom: 'Sandre', tailleMinCm: null, fermetureAvecBrochet: true, verifDepartementPrintemps: false };

describe('composerReglementation', () => {
  it('given le 5 janvier, when on formate un jour, then « 05/01 » (zéros de tête)', () => {
    expect(formaterJourMois(new Date(2026, 0, 5))).toBe('05/01');
  });

  it("given une 1re catégorie ouverte le 15/06/2026 et aucune espèce, when on compose, then « Pêche : Ouvert » sans quota", () => {
    expect(composerReglementation(1, null, new Date(2026, 5, 15))).toEqual([
      { libelle: 'Pêche', valeur: 'Ouvert', ferme: false },
    ]);
  });

  it("US 87 critère 5 : given une 1re catégorie hors saison le 11/11/2026, when on compose, then l'alerte « Fermé : 1re catégorie hors saison » vient avant « Pêche : Fermé jusqu'au 13/03 », sans quota", () => {
    const lignes = composerReglementation(1, null, new Date(2026, 10, 11));
    expect(lignes).toEqual([
      { libelle: '', valeur: 'Fermé : 1re catégorie hors saison', ferme: true, alerte: true },
      { libelle: 'Pêche', valeur: "Fermé jusqu'au 13/03", ferme: true },
    ]);
  });

  it("US 87 critère 5 : given une 2e catégorie le 11/11/2026, when on compose, then aucune alerte « 1re catégorie hors saison »", () => {
    const lignes = composerReglementation(2, null, new Date(2026, 10, 11));
    expect(lignes.some((l) => l.valeur.includes('1re catégorie hors saison'))).toBe(false);
  });

  it("given le sandre en 2e catégorie le 10/02/2026, when on compose, then l'alerte vient avant la taille et le quota", () => {
    const lignes = composerReglementation(2, sandre, new Date(2026, 1, 10));
    expect(lignes.map((l) => l.valeur)).toEqual([
      "Brochet fermé jusqu'au 24/04",
      // US 84 (maquette validée) : « Sandre probablement fermé, vérifie » (sans deux-points).
      'Sandre probablement fermé, vérifie',
      'pas de taille minimale nationale',
      // US 84 (maquette validée) : quota « par pêcheur », « au maximum ».
      '3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum',
    ]);
    expect(lignes[1].alerte).toBe(true);
  });

  it("given une espèce dont la fiche porte fermetureNationale2e pendant la fermeture du brochet, when on compose, then aucune alerte « probablement fermé » (sans le drapeau, l'alerte reste)", () => {
    const date = new Date(2026, 1, 10);
    const alertes = (espece: Parameters<typeof composerReglementation>[1]) =>
      composerReglementation(2, null, date, [espece!]).filter((l) => l.alerte);

    expect(alertes({ ...sandre, nom: 'Autre', fermetureNationale2e: true })).toEqual([]);
    expect(alertes({ ...sandre, nom: 'Autre', fermetureNationale2e: false })).toHaveLength(1);
  });
});
