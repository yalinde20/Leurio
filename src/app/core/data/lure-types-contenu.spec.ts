// US 43 : le contenu réel de lure-types.json (~20 types) est exposé par CatalogService.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';
import lureTypes from '../../../assets/data/lure-types.json';

describe('Contenu des types de leurres (US 43)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('critère 1 : given lure-types.json, when on demande les types de leurres au CatalogService, then il en rend entre 18 et 22', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(CatalogService);
    const http = TestBed.inject(HttpTestingController);
    const resultat = service.typesDeLeurres();
    http.expectOne('assets/data/lure-types.json').flush(lureTypes);
    const types = await resultat;
    expect(types.length).toBeGreaterThanOrEqual(18);
    expect(types.length).toBeLessThanOrEqual(22);
  });
});
