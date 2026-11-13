// US 104 : relier chaque conseil à un leurre de la boîte (PLAN §5, §8.5).
// Contrat : matcher.ts (TypeScript pur) exporte `trouverDansLaBoite(conseils, boite, typesLeurres): Correspondance[]`,
// une correspondance par conseil, dans l'ordre : 'dans-ta-boite' (même type), 'substitution' (même zone de nage)
// ou 'il-te-manque' (type, plage de taille du contenu, couleur conseillée).
import { LeurreDeBoite, trouverDansLaBoite } from './matcher';
import { Conseil } from './scorer';
import { TypeLeurre } from '../data/catalog.types';
import typesReels from '../../../assets/data/lure-types.json';

const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };

const type = (id: string, zoneNage: TypeLeurre['zoneNage'], gamme: Partial<TypeLeurre> = {}): TypeLeurre => ({
  id,
  nom: id,
  especes: ['SAN'],
  techniques: [],
  zoneNage,
  interditFermetureBrochet: false,
  ...gamme,
  ...FICHE,
});

const TYPES: TypeLeurre[] = [
  type('shad', 'mi-eau', { tailleCm: [7, 12] }),
  type('crankbait', 'mi-eau', { tailleCm: [4, 8] }),
  type('jig', 'fond', { poidsG: [7, 21] }),
  type('creature', 'fond', { tailleCm: [6, 10] }),
  type('popper', 'surface', { tailleCm: [5, 10] }),
  type('sans-gamme', 'mi-eau'),
];

const leurre = (id: string, typeId: string, tailleCm: number, poidsG: number, couleur = 'naturel'): LeurreDeBoite => ({
  id,
  typeId,
  tailleCm,
  poidsG,
  couleur,
});

type ConseilLu = Pick<Conseil, 'typeId' | 'couleur' | 'taille'>;
const conseil = (typeId: string, taille: ConseilLu['taille'] = null, couleur = 'chartreuse'): ConseilLu => ({
  typeId,
  couleur,
  taille,
});

describe('matcher (US 104)', () => {
  it('critère 1 : given la boîte est vide, when le matcher reçoit les 3 meilleurs types, then il rend « Il te manque » pour chacun avec le type, la plage de taille et la couleur conseillée', () => {
    const conseils = [
      conseil('shad', { valeur: 10, unite: 'cm' }, 'blanc'),
      conseil('jig', { valeur: 14, unite: 'g' }, 'rouge'),
      conseil('sans-gamme', null, 'noir'),
    ];

    expect(trouverDansLaBoite(conseils, [], TYPES)).toEqual([
      { statut: 'il-te-manque', typeId: 'shad', plage: { min: 7, max: 12, unite: 'cm' }, couleur: 'blanc' },
      { statut: 'il-te-manque', typeId: 'jig', plage: { min: 7, max: 21, unite: 'g' }, couleur: 'rouge' },
      { statut: 'il-te-manque', typeId: 'sans-gamme', plage: null, couleur: 'noir' },
    ]);
  });

  it('critère 1 : given la boîte est vide et le contenu réel, when le matcher reçoit un type du contenu, then la plage vient de lure-types.json', () => {
    const types = typesReels as TypeLeurre[];
    const jig = types.find((t) => t.id === 'jig')!;
    const shad = types.find((t) => t.id === 'shad')!;

    const [a, b] = trouverDansLaBoite([conseil('shad'), conseil('jig')], [], types);

    expect(a).toMatchObject({ statut: 'il-te-manque', plage: { min: shad.tailleCm![0], max: shad.tailleCm![1], unite: 'cm' } });
    expect(b).toMatchObject({ statut: 'il-te-manque', plage: { min: jig.poidsG![0], max: jig.poidsG![1], unite: 'g' } });
  });

  it('critère 2 : given la boîte contient un seul leurre du type conseillé, when le matcher s\'exécute, then il rend ce leurre', () => {
    const unique = leurre('s1', 'shad', 3, 50);
    const boite = [leurre('j1', 'jig', 10, 14), unique];

    expect(trouverDansLaBoite([conseil('shad', { valeur: 10, unite: 'cm' })], boite, TYPES)).toEqual([
      { statut: 'dans-ta-boite', typeId: 'shad', leurre: unique },
    ]);
  });

  it('critère 3 : given plusieurs leurres du type conseillé et un conseil en cm, when le matcher s\'exécute, then il rend celui dont la taille est la plus proche', () => {
    const boite = [leurre('s8', 'shad', 8, 10), leurre('s11', 'shad', 11, 40), leurre('s13', 'shad', 13, 10)];

    const [r] = trouverDansLaBoite([conseil('shad', { valeur: 10, unite: 'cm' })], boite, TYPES);

    expect(r).toMatchObject({ statut: 'dans-ta-boite', leurre: { id: 's11' } });
  });

  it('critère 3 : given plusieurs leurres du type conseillé et un conseil en g, when le matcher s\'exécute, then il rend celui dont le poids est le plus proche', () => {
    const boite = [leurre('j7', 'jig', 10, 7), leurre('j15', 'jig', 3, 15), leurre('j30', 'jig', 10, 30)];

    const [r] = trouverDansLaBoite([conseil('jig', { valeur: 14, unite: 'g' })], boite, TYPES);

    expect(r).toMatchObject({ statut: 'dans-ta-boite', leurre: { id: 'j15' } });
  });

  it('critère 3 : given deux leurres du type à égale distance de la taille conseillée, when le matcher s\'exécute, then il rend le premier de la boîte', () => {
    const boite = [leurre('s12', 'shad', 12, 10), leurre('s8', 'shad', 8, 10)];

    const [r] = trouverDansLaBoite([conseil('shad', { valeur: 10, unite: 'cm' })], boite, TYPES);

    expect(r).toMatchObject({ leurre: { id: 's12' } });
  });

  it('critère 3 : given un conseil sans taille, when le matcher s\'exécute, then il rend le premier leurre du type dans l\'ordre de la boîte', () => {
    const boite = [leurre('s1', 'shad', 30, 90), leurre('s2', 'shad', 10, 10)];

    const [r] = trouverDansLaBoite([conseil('shad', null)], boite, TYPES);

    expect(r).toMatchObject({ statut: 'dans-ta-boite', leurre: { id: 's1' } });
  });

  it('critère 3 : given le même leurre utile à plusieurs conseils, when le matcher s\'exécute, then il le rend pour chacun, dans l\'ordre des conseils', () => {
    const seul = leurre('s1', 'shad', 10, 10);
    const conseils = [conseil('shad'), conseil('jig'), conseil('shad')];

    const r = trouverDansLaBoite(conseils, [seul], TYPES);

    expect(r.map((c) => c.typeId)).toEqual(['shad', 'jig', 'shad']);
    expect(r[0]).toMatchObject({ statut: 'dans-ta-boite', leurre: { id: 's1' } });
    expect(r[2]).toMatchObject({ statut: 'dans-ta-boite', leurre: { id: 's1' } });
    expect(r[1]).toMatchObject({ statut: 'il-te-manque' });
  });

  it('critère 4 : given aucun leurre du type conseillé mais un leurre de la même zone de nage, when le matcher s\'exécute, then il rend ce leurre marqué comme substitution', () => {
    const voisin = leurre('c1', 'crankbait', 6, 12);
    const boite = [leurre('p1', 'popper', 7, 8), voisin];

    expect(trouverDansLaBoite([conseil('shad', { valeur: 10, unite: 'cm' })], boite, TYPES)).toEqual([
      { statut: 'substitution', typeId: 'shad', leurre: voisin },
    ]);
  });

  it('critère 4 : given un leurre dont le type est inconnu du contenu, when le matcher cherche une substitution, then il ne le rend jamais', () => {
    const boite = [leurre('x1', 'type-inconnu', 10, 10)];

    const [r] = trouverDansLaBoite([conseil('shad', { valeur: 10, unite: 'cm' })], boite, TYPES);

    expect(r).toMatchObject({ statut: 'il-te-manque', typeId: 'shad' });
  });

  it('critère 4 : given un type conseillé inconnu du contenu, when le matcher s\'exécute, then il ne propose aucune substitution et la plage est nulle', () => {
    const boite = [leurre('c1', 'crankbait', 6, 12)];

    const [r] = trouverDansLaBoite([conseil('type-inconnu', null, 'vert')], boite, TYPES);

    expect(r).toEqual({ statut: 'il-te-manque', typeId: 'type-inconnu', plage: null, couleur: 'vert' });
  });

  it('critère 4 : given la zone de nage lue dans le contenu réel, when le matcher s\'exécute, then un type de la même zone sert de substitution', () => {
    const types = typesReels as TypeLeurre[];
    const conseilleId = 'shad';
    const zone = types.find((t) => t.id === conseilleId)!.zoneNage;
    const voisinType = types.find((t) => t.id !== conseilleId && t.zoneNage === zone)!;
    const hors = types.find((t) => t.zoneNage !== zone)!;
    const voisin = leurre('v1', voisinType.id, 8, 10);

    const [r] = trouverDansLaBoite([conseil(conseilleId)], [leurre('h1', hors.id, 8, 10), voisin], types);

    expect(r).toEqual({ statut: 'substitution', typeId: conseilleId, leurre: voisin });
  });

  it('critère 5 : given plusieurs leurres de substitution et un conseil en cm, when le matcher s\'exécute, then il rend celui dont la taille est la plus proche', () => {
    const boite = [leurre('c5', 'crankbait', 5, 10), leurre('sg9', 'sans-gamme', 9, 90), leurre('c13', 'crankbait', 13, 10)];

    const [r] = trouverDansLaBoite([conseil('shad', { valeur: 10, unite: 'cm' })], boite, TYPES);

    expect(r).toMatchObject({ statut: 'substitution', leurre: { id: 'sg9' } });
  });

  it('critère 5 : given plusieurs leurres de substitution et un conseil en g, when le matcher s\'exécute, then il rend celui dont le poids est le plus proche', () => {
    const boite = [leurre('cr1', 'creature', 8, 5), leurre('cr2', 'creature', 8, 13), leurre('cr3', 'creature', 8, 40)];

    const [r] = trouverDansLaBoite([conseil('jig', { valeur: 14, unite: 'g' })], boite, TYPES);

    expect(r).toMatchObject({ statut: 'substitution', leurre: { id: 'cr2' } });
  });

  it('critère 5 : given deux substitutions à égale distance, when le matcher s\'exécute, then il rend la première de la boîte', () => {
    const boite = [leurre('c12', 'crankbait', 12, 10), leurre('sg8', 'sans-gamme', 8, 10)];

    const [r] = trouverDansLaBoite([conseil('shad', { valeur: 10, unite: 'cm' })], boite, TYPES);

    expect(r).toMatchObject({ statut: 'substitution', leurre: { id: 'c12' } });
  });

  it('critère 6 : given un leurre du même type et une substitution plus proche en taille, when le matcher s\'exécute, then il rend le leurre du même type', () => {
    const memeType = leurre('s20', 'shad', 20, 90);
    const boite = [leurre('c10', 'crankbait', 10, 10), memeType];

    const [r] = trouverDansLaBoite([conseil('shad', { valeur: 10, unite: 'cm' })], boite, TYPES);

    expect(r).toEqual({ statut: 'dans-ta-boite', typeId: 'shad', leurre: memeType });
  });

  it('critère 7 : given la boîte ne contient ni le type ni la zone de nage conseillés, when le matcher s\'exécute, then il rend « Il te manque » avec la plage et la couleur', () => {
    const boite = [leurre('p1', 'popper', 7, 8), leurre('j1', 'jig', 10, 14)];

    expect(trouverDansLaBoite([conseil('shad', { valeur: 10, unite: 'cm' }, 'blanc')], boite, TYPES)).toEqual([
      { statut: 'il-te-manque', typeId: 'shad', plage: { min: 7, max: 12, unite: 'cm' }, couleur: 'blanc' },
    ]);
  });

  it('given des entrées, when le matcher s\'exécute, then il ne modifie ni les conseils, ni la boîte, ni les types', () => {
    const conseils = [conseil('shad', { valeur: 10, unite: 'cm' }), conseil('jig', { valeur: 14, unite: 'g' })];
    const boite = [leurre('s1', 'shad', 12, 10), leurre('c1', 'crankbait', 5, 10), leurre('j1', 'jig', 3, 3)];
    const avant = structuredClone({ conseils, boite, types: TYPES });

    trouverDansLaBoite(conseils, boite, TYPES);

    expect({ conseils, boite, types: TYPES }).toEqual(avant);
  });
});
