// US 36, critère 7 : le type du document utilisateur (PLAN §7, users/{uid}).
// Le type est exporté par src/app/core/firebase/user-doc.ts : `UserDoc`.
import { UserDoc } from './user-doc';

const exemple: UserDoc = {
  niveau: 'debutant',
  especesFavorites: ['SAN', 'BRO'],
  consentements: { analytics: false, video: false },
  createdAt: 1700000000000,
  plan: 'free',
};

describe('critère 7 : document utilisateur', () => {
  it('given le type du document utilisateur, when on le lit, then il contient niveau, especesFavorites, consentements (analytics, video), createdAt et plan', () => {
    expect(Object.keys(exemple).sort()).toEqual(['consentements', 'createdAt', 'especesFavorites', 'niveau', 'plan']);
    expect(Object.keys(exemple.consentements).sort()).toEqual(['analytics', 'video']);

    expectTypeOf<UserDoc>().toHaveProperty('niveau');
    expectTypeOf<UserDoc>().toHaveProperty('especesFavorites');
    expectTypeOf<UserDoc>().toHaveProperty('consentements');
    expectTypeOf<UserDoc>().toHaveProperty('createdAt');
    expectTypeOf<UserDoc>().toHaveProperty('plan');
    expectTypeOf<UserDoc['especesFavorites']>().toEqualTypeOf<string[]>();
    expectTypeOf<UserDoc['consentements']>().toEqualTypeOf<{ analytics: boolean; video: boolean | null }>();
    expectTypeOf<UserDoc['createdAt']>().toEqualTypeOf<number>();
  });

  it('given le type du document utilisateur, when un champ manque, then le compilateur refuse l\'objet (tous les champs sont obligatoires)', () => {
    // Chaque ligne doit être une erreur de type : si le champ n'existe pas ou est optionnel, @ts-expect-error échoue.
    // @ts-expect-error niveau est obligatoire
    const sansNiveau: UserDoc = { ...exemple, niveau: undefined };
    // @ts-expect-error especesFavorites est obligatoire
    const sansEspeces: UserDoc = { ...exemple, especesFavorites: undefined };
    // @ts-expect-error consentements est obligatoire
    const sansConsentements: UserDoc = { ...exemple, consentements: undefined };
    // @ts-expect-error consentements.video est obligatoire
    const sansVideo: UserDoc = { ...exemple, consentements: { analytics: true } };
    // @ts-expect-error consentements.analytics est obligatoire
    const sansAnalytics: UserDoc = { ...exemple, consentements: { video: true } };
    // @ts-expect-error createdAt est obligatoire
    const sansDate: UserDoc = { ...exemple, createdAt: undefined };
    // @ts-expect-error plan est obligatoire
    const sansPlan: UserDoc = { ...exemple, plan: undefined };
    expect([sansNiveau, sansEspeces, sansConsentements, sansVideo, sansAnalytics, sansDate, sansPlan]).toHaveLength(7);
  });
});
