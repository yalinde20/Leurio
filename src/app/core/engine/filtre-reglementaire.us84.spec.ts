// US 84, critère 3 : pendant la fermeture du brochet (catégorie inconnue = règles de la 2e catégorie), le vrai moteur
// écarte les leurres interdits et explique pourquoi. Contenu réel, aucun double. (Livré par la US 78 : ce test peut passer dès maintenant.)
import { Conditions } from './conditions';
import { ContenuMoteur, PoidsMoteur, conseiller } from './scorer';
import { etatReglementaire } from '../regulation/calendar';
import { Animation, Couleur, Espece, TypeLeurre } from '../data/catalog.types';
import poidsReels from '../../../assets/data/engine-weights.json';
import especesReelles from '../../../assets/data/species.json';
import typesReels from '../../../assets/data/lure-types.json';
import animationsReelles from '../../../assets/data/techniques.json';
import couleursReelles from '../../../assets/data/couleurs.json';

const POIDS: PoidsMoteur = poidsReels;
const CONTENU: ContenuMoteur = {
  especes: especesReelles as unknown as Espece[],
  typesLeurres: typesReels as unknown as TypeLeurre[],
  animations: animationsReelles as unknown as Animation[],
  couleurs: couleursReelles as unknown as Couleur[],
};
const CONDITIONS: Conditions = {
  tempEau: 7,
  sourceTempEau: 'saisie',
  debitTendance: 'normal',
  pressionTendance48h: null,
  nuages: null,
  vent: null,
  moment: 'jour',
  saison: 'hiver',
  categorie: null,
  departement: '49',
  niveau: 'debutant',
};

describe('conseiller : fermeture du brochet, catégorie inconnue (US 84)', () => {
  it("critère 3 : given un moment dans la fermeture du brochet et la catégorie inconnue, when le moteur conseille, then aucun type interdit pendant la fermeture n'est dans le top 3 et l'explication le dit", () => {
    const moment = new Date(2027, 2, 10);
    const interdits = new Set(CONTENU.typesLeurres.filter((t) => t.interditFermetureBrochet).map((t) => t.id));
    expect(interdits.size).toBeGreaterThan(0);

    const { conseils, explications } = conseiller(CONDITIONS, CONTENU, POIDS, etatReglementaire(null, moment));

    expect(conseils.length).toBeGreaterThan(0);
    expect(conseils.filter((c) => interdits.has(c.typeId))).toEqual([]);
    expect(explications).toContain(
      "Brochet fermé : certains leurres sont interdits jusqu'au 23/04 (si tu es en 2e catégorie)",
    );
  });
});
