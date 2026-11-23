/*
 * US 10 : un compte neuf n'a encore jamais répondu à la question vidéo : users/{uid}.consentements.video vaut null (et non faux,
 * qui voudrait dire « refusé »). Doubles de SOURCE_COMPTE, aucun Firebase. Voir compte.service.spec.ts pour le reste de la création.
 */
import { TestBed } from '@angular/core/testing';
import { CompteService, SOURCE_COMPTE, SourceCompte } from './compte.service';

afterEach(() => {
  TestBed.resetTestingModule();
  localStorage.clear();
});

describe('US 10 : CompteService, consentement vidéo à la création', () => {
  it("critère 1 : given je termine l'onboarding en ligne, when le compte anonyme est créé, then users/{uid}.consentements.video vaut null (jamais répondu) et analytics faux", async () => {
    localStorage.clear();
    const profils = new Map<string, { consentements: unknown }>();
    const source: SourceCompte = {
      uidCourant: async () => null,
      connecterAnonymement: async () => 'uid-neuf',
      profilExiste: async (uid) => profils.has(uid),
      ecrireProfil: async (uid, doc) => void profils.set(uid, doc),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SOURCE_COMPTE, useValue: source }] });

    await TestBed.inject(CompteService).assurerCompte({ niveau: 'debutant', especesFavorites: ['SAN'] });

    expect(profils.get('uid-neuf')?.consentements).toEqual({ analytics: false, video: null });
  });
});
