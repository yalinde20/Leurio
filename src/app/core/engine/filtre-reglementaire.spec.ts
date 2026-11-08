// US 78 : exclure les leurres interdits pendant la fermeture du brochet (PLAN §6, §8.4).
// Contrat : core/regulation exporte `etatReglementaire(categorie, date)` ; core/engine/scorer.ts exporte
// `conseiller(conditions, contenu, poids, reglementation): { conseils, explications }`.
import { Conditions } from './conditions';
import { ContenuMoteur, PoidsMoteur, conseiller, recommander } from './scorer';
import { etatReglementaire } from '../regulation/calendar';
import { Animation, Couleur, Espece, TypeLeurre } from '../data/catalog.types';
import poidsReels from '../../../assets/data/engine-weights.json';
import especesReelles from '../../../assets/data/species.json';
import typesReels from '../../../assets/data/lure-types.json';
import animationsReelles from '../../../assets/data/techniques.json';
import couleursReelles from '../../../assets/data/couleurs.json';

const POIDS: PoidsMoteur = poidsReels;
const FICHE = { sources: ['test'], dateVerif: '2026-11-07' };
const EXPLICATION = "Brochet fermé : certains leurres sont interdits jusqu'au 24/04";

const DANS_LA_FERMETURE = new Date(2026, 2, 1);
const HORS_FERMETURE = new Date(2026, 5, 15);

const CONTENU_REEL: ContenuMoteur = {
  especes: especesReelles as unknown as Espece[],
  typesLeurres: typesReels as unknown as TypeLeurre[],
  animations: animationsReelles as unknown as Animation[],
  couleurs: couleursReelles as unknown as Couleur[],
};

const interdits = new Set(CONTENU_REEL.typesLeurres.filter((t) => t.interditFermetureBrochet).map((t) => t.id));

const conditions = (surcharge: Partial<Conditions> = {}): Conditions => ({
  tempEau: 10,
  sourceTempEau: 'saisie',
  debitTendance: 'normal',
  pressionTendance48h: null,
  nuages: null,
  vent: null,
  moment: 'jour',
  saison: 'printemps',
  categorie: 2,
  departement: '44',
  especeCible: 'PER',
  niveau: 'debutant',
  ...surcharge,
});

const espece = (code: string): Espece => ({
  code,
  nom: code,
  tempEauC: { active: [12, 24], ralentie: [4, 12], quasiNulle: [0, 4] },
  postes: [],
  proies: [],
  tailleMinCm: null,
  fermetureAvecBrochet: false,
  verifDepartementPrintemps: false,
  ...FICHE,
});

const animation = (id: string): Animation =>
  ({ id, nom: id, geste: 'Geste.', vitesse: 'moyen', erreurAEviter: 'Rien.', difficulte: 1, videos: [], rythme: 'moyen', ...FICHE }) as Animation;

const type = (id: string, interdit: boolean): TypeLeurre => ({
  id,
  nom: id,
  especes: ['BRO'],
  techniques: ['lineaire'],
  zoneNage: 'mi-eau',
  interditFermetureBrochet: interdit,
  ...FICHE,
});

const reglementation = (c: Conditions, date: Date) => etatReglementaire(c.categorie, date);

describe('etatReglementaire', () => {
  it('given la 2e catégorie dans la fermeture du brochet, when on demande l\'état réglementaire, then le brochet est fermé jusqu\'au 24/04/2026', () => {
    expect(etatReglementaire(2, DANS_LA_FERMETURE)).toEqual({
      brochetFerme: true,
      finFermetureBrochet: new Date(2026, 3, 24),
    });
  });

  it('given la 1re catégorie à la même date, when on demande l\'état réglementaire, then le brochet n\'est pas fermé', () => {
    expect(etatReglementaire(1, DANS_LA_FERMETURE)).toEqual({ brochetFerme: false, finFermetureBrochet: null });
  });

  it('given la 2e catégorie hors fermeture, when on demande l\'état réglementaire, then le brochet n\'est pas fermé', () => {
    expect(etatReglementaire(2, HORS_FERMETURE)).toEqual({ brochetFerme: false, finFermetureBrochet: null });
  });
});

describe('conseiller : filtre réglementaire', () => {
  const c = conditions();

  it('précondition : given les conditions du test, when le moteur calcule sans filtre, then au moins un type interdit pendant la fermeture est proposé', () => {
    const sansFiltre = recommander(c, CONTENU_REEL, POIDS);
    expect(sansFiltre.some((x) => interdits.has(x.typeId)), sansFiltre.map((x) => x.typeId).join(',')).toBe(true);
  });

  it('critère 1 : given un lieu de 2e catégorie dans la fermeture du brochet, when le moteur calcule le conseil, then aucun conseil ne propose un type interditFermetureBrochet', () => {
    const { conseils } = conseiller(c, CONTENU_REEL, POIDS, reglementation(c, DANS_LA_FERMETURE));
    expect(conseils.length).toBeGreaterThan(0);
    for (const x of conseils) expect(interdits.has(x.typeId), x.typeId).toBe(false);
  });

  it('critère 1 : given un type interdit qui score le mieux et un type autorisé, when le moteur calcule le conseil pendant la fermeture, then seul le type autorisé est proposé', () => {
    const contenu: ContenuMoteur = {
      especes: [espece('BRO')],
      typesLeurres: [type('interdit', true), type('autorise', false)],
      animations: [animation('lineaire')],
      couleurs: [],
    };
    const cb = conditions({ especeCible: 'BRO' });
    expect(recommander(cb, contenu, POIDS).map((x) => x.typeId)).toEqual(['interdit', 'autorise']);
    const { conseils } = conseiller(cb, contenu, POIDS, reglementation(cb, DANS_LA_FERMETURE));
    expect(conseils.map((x) => x.typeId)).toEqual(['autorise']);
  });

  it('critère 2 : given le même cas, when le moteur calcule le conseil, then le résultat contient l\'explication du brochet fermé jusqu\'au 24/04', () => {
    const { explications } = conseiller(c, CONTENU_REEL, POIDS, reglementation(c, DANS_LA_FERMETURE));
    expect(explications).toContain(EXPLICATION);
  });

  it('critère 3 : given la même date en 1re catégorie, when le moteur calcule le conseil, then les types interdits peuvent être proposés, sans explication de fermeture', () => {
    const c1 = conditions({ categorie: 1 });
    const resultat = conseiller(c1, CONTENU_REEL, POIDS, reglementation(c1, DANS_LA_FERMETURE));
    expect(resultat.conseils).toEqual(recommander(c1, CONTENU_REEL, POIDS));
    expect(resultat.conseils.some((x) => interdits.has(x.typeId))).toBe(true);
    expect(resultat.explications.some((e) => e.includes('Brochet fermé'))).toBe(false);
  });

  it('critère 3 : given une date hors fermeture en 2e catégorie, when le moteur calcule le conseil, then les types interdits peuvent être proposés, sans explication de fermeture', () => {
    const resultat = conseiller(c, CONTENU_REEL, POIDS, reglementation(c, HORS_FERMETURE));
    expect(resultat.conseils).toEqual(recommander(c, CONTENU_REEL, POIDS));
    expect(resultat.conseils.some((x) => interdits.has(x.typeId))).toBe(true);
    expect(resultat.explications.some((e) => e.includes('Brochet fermé'))).toBe(false);
  });
});
