import { etatBrochet, etatOuverture, periodeFermetureBrochet, periodeOuverture1reCategorie } from './calendar';

// US 73, PLAN §6 : la 1re catégorie ouvre le 2e samedi de mars et ferme le 3e dimanche de septembre, jours inclus.
// La 2e catégorie est ouverte en général (la fermeture du brochet est une autre story).
// Module de réglementation : TypeScript pur. Les dates sont comparées en jours locaux, indépendamment du fuseau.
const jour = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe('periodeOuverture1reCategorie', () => {
  it('given l\'année 2026, when on demande la période d\'ouverture de la 1re catégorie, then elle va du samedi 14/03/2026 au dimanche 20/09/2026 inclus', () => {
    const periode = periodeOuverture1reCategorie(2026);

    expect(jour(periode.debut)).toEqual([2026, 3, 14]);
    expect(periode.debut.getDay()).toBe(6);
    expect(jour(periode.fin)).toEqual([2026, 9, 20]);
    expect(periode.fin.getDay()).toBe(0);
  });

  it('given l\'année 2025, when on demande la période d\'ouverture de la 1re catégorie, then elle va du samedi 08/03/2025 au dimanche 21/09/2025 inclus', () => {
    const periode = periodeOuverture1reCategorie(2025);

    expect(jour(periode.debut)).toEqual([2025, 3, 8]);
    expect(periode.debut.getDay()).toBe(6);
    expect(jour(periode.fin)).toEqual([2025, 9, 21]);
    expect(periode.fin.getDay()).toBe(0);
  });

  it('given les années 2024 et 2027, when on demande la période d\'ouverture de la 1re catégorie, then elle va du 09/03 au 15/09/2024 et du 13/03 au 19/09/2027', () => {
    const p2024 = periodeOuverture1reCategorie(2024);
    const p2027 = periodeOuverture1reCategorie(2027);

    expect(jour(p2024.debut)).toEqual([2024, 3, 9]);
    expect(jour(p2024.fin)).toEqual([2024, 9, 15]);
    expect(jour(p2027.debut)).toEqual([2027, 3, 13]);
    expect(jour(p2027.fin)).toEqual([2027, 9, 19]);
  });
});

describe('etatOuverture', () => {
  it('given un lieu de 1re catégorie et les dates du 13/03/2026, 14/03/2026, 20/09/2026 et 21/09/2026, when on demande l\'état d\'ouverture, then il vaut « fermé », « ouvert », « ouvert », « fermé »', () => {
    expect(etatOuverture(1, new Date(2026, 2, 13))).toBe('ferme');
    expect(etatOuverture(1, new Date(2026, 2, 14))).toBe('ouvert');
    expect(etatOuverture(1, new Date(2026, 8, 20))).toBe('ouvert');
    expect(etatOuverture(1, new Date(2026, 8, 21))).toBe('ferme');
  });

  it('given un lieu de 1re catégorie et des heures variées de la journée aux dates limites, when on demande l\'état d\'ouverture, then le jour entier compte (13/03 23:59 fermé, 14/03 00:00 ouvert, 20/09 23:30 ouvert, 21/09 00:00 fermé)', () => {
    expect(etatOuverture(1, new Date(2026, 2, 13, 23, 59))).toBe('ferme');
    expect(etatOuverture(1, new Date(2026, 2, 14, 0, 0))).toBe('ouvert');
    expect(etatOuverture(1, new Date(2026, 8, 20, 23, 30))).toBe('ouvert');
    expect(etatOuverture(1, new Date(2026, 8, 21, 0, 0))).toBe('ferme');
  });

  it('given un lieu de 1re catégorie en plein hiver et en plein été, when on demande l\'état d\'ouverture, then il vaut « fermé » en janvier et « ouvert » en juillet', () => {
    expect(etatOuverture(1, new Date(2026, 0, 15, 12, 0))).toBe('ferme');
    expect(etatOuverture(1, new Date(2026, 6, 15, 12, 0))).toBe('ouvert');
    expect(etatOuverture(1, new Date(2026, 11, 31, 12, 0))).toBe('ferme');
  });

  it('given un lieu de 2e catégorie et une date quelconque, when on demande l\'état d\'ouverture général, then il vaut « ouvert »', () => {
    const dates = [
      new Date(2026, 0, 15, 12, 0),
      new Date(2026, 2, 13, 23, 59),
      new Date(2026, 8, 21, 0, 0),
      new Date(2026, 6, 15, 8, 30),
      new Date(2026, 11, 31, 23, 59),
      new Date(2027, 1, 1),
    ];

    for (const date of dates) {
      expect(etatOuverture(2, date)).toBe('ouvert');
    }
  });
});

// US 74, PLAN §6 : le brochet est fermé en 2e catégorie du dernier lundi de janvier au vendredi avant le dernier samedi d'avril, bornes incluses.
describe('periodeFermetureBrochet', () => {
  it('given les années 2024, 2025, 2026 et 2027, when on demande la période de fermeture du brochet en 2e catégorie, then elle va du 29/01/2024 au 26/04/2024, du 27/01/2025 au 25/04/2025, du 26/01/2026 au 24/04/2026 et du 25/01/2027 au 23/04/2027, bornes incluses', () => {
    const attendu: [number, number[], number[]][] = [
      [2024, [2024, 1, 29], [2024, 4, 26]],
      [2025, [2025, 1, 27], [2025, 4, 25]],
      [2026, [2026, 1, 26], [2026, 4, 24]],
      [2027, [2027, 1, 25], [2027, 4, 23]],
    ];

    for (const [annee, debut, fin] of attendu) {
      const periode = periodeFermetureBrochet(annee);

      expect(jour(periode.debut)).toEqual(debut);
      expect(periode.debut.getDay()).toBe(1);
      expect(jour(periode.fin)).toEqual(fin);
      expect(periode.fin.getDay()).toBe(5);
    }
  });
});

describe('etatBrochet', () => {
  it('given un lieu de 2e catégorie et les dates du 25/01/2026, 26/01/2026, 24/04/2026 et 25/04/2026, when on demande l\'état du brochet, then il vaut « ouvert », « fermé », « fermé », « ouvert »', () => {
    expect(etatBrochet(2, new Date(2026, 0, 25))).toBe('ouvert');
    expect(etatBrochet(2, new Date(2026, 0, 26))).toBe('ferme');
    expect(etatBrochet(2, new Date(2026, 3, 24))).toBe('ferme');
    expect(etatBrochet(2, new Date(2026, 3, 25))).toBe('ouvert');
  });

  it('given un lieu de 2e catégorie et des heures variées aux dates limites, when on demande l\'état du brochet, then le jour entier compte (26/01 00:00 fermé, 25/01 23:59 ouvert, 24/04 23:30 fermé, 25/04 00:00 ouvert)', () => {
    expect(etatBrochet(2, new Date(2026, 0, 26, 0, 0))).toBe('ferme');
    expect(etatBrochet(2, new Date(2026, 0, 25, 23, 59))).toBe('ouvert');
    expect(etatBrochet(2, new Date(2026, 3, 24, 23, 30))).toBe('ferme');
    expect(etatBrochet(2, new Date(2026, 3, 25, 0, 0))).toBe('ouvert');
  });

  it('given un lieu de 1re catégorie, when on demande l\'état du brochet en 2e catégorie, then cette règle ne s\'applique pas, y compris pendant la période de fermeture', () => {
    const dates = [
      new Date(2026, 0, 15, 12, 0),
      new Date(2026, 0, 26),
      new Date(2026, 2, 1, 12, 0),
      new Date(2026, 3, 24, 23, 30),
      new Date(2026, 5, 1, 12, 0),
      new Date(2026, 11, 31, 23, 59),
    ];

    for (const date of dates) {
      expect(etatBrochet(1, date)).toBe('non-applicable');
    }
  });

  it('given une catégorie inconnue (position GPS sans spot), when on demande l\'état du brochet, then l\'état est donné pour les deux catégories', () => {
    expect(etatBrochet(null, new Date(2026, 2, 1, 12, 0))).toEqual({ 1: 'non-applicable', 2: 'ferme' });
    expect(etatBrochet(null, new Date(2026, 5, 1, 12, 0))).toEqual({ 1: 'non-applicable', 2: 'ouvert' });
  });
});
