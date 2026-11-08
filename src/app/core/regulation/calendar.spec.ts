import { etatOuverture, periodeOuverture1reCategorie } from './calendar';

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
