import { Conditions } from '../engine/conditions';
import { construireFeedback } from './feedback.service';

const CONDITIONS: Conditions = {
  tempEau: null,
  sourceTempEau: null,
  debitTendance: 'inconnu',
  pressionTendance48h: null,
  nuages: null,
  vent: null,
  moment: 'jour',
  saison: 'automne',
  categorie: null,
  departement: '49',
  niveau: 'debutant',
};

describe('construireFeedback', () => {
  it('given une eau et un vent inconnus, when on construit l\'avis, then ils restent null et rien n\'est inventé', () => {
    const doc = construireFeedback({ typeId: 'shad', techniqueId: 'tiree' }, true, CONDITIONS, new Date('2026-11-09T12:34:56Z'));

    expect(doc['conditions']).toEqual({ tempEau: null, vent: null, debitTendance: 'inconnu', pressionTendance48h: null, departement: '49' });
    expect(doc['date']).toBe('2026-11-09T12:00:00.000Z');
    expect(doc['conseilId']).toBe('shad:tiree');
  });

  it('given une eau à 11,5 et un vent à 14,4, when on construit l\'avis, then ils sont arrondis à l\'entier', () => {
    const doc = construireFeedback({ typeId: 'a', techniqueId: 'b' }, false, { ...CONDITIONS, tempEau: 11.5, vent: 14.4 }, new Date());

    expect(doc['conditions']).toMatchObject({ tempEau: 12, vent: 14 });
  });
});
