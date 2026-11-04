// US 44 : le contenu réel de starter-kit.json (les 5 leurres à acheter en premier) est exposé par CatalogService.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';
import starterKit from '../../../assets/data/starter-kit.json';

describe('Contenu du kit de départ (US 44)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('critère 1 : given starter-kit.json, when on demande le kit de départ au CatalogService, then il rend exactement 5 leurres', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(CatalogService);
    const http = TestBed.inject(HttpTestingController);
    const resultat = service.kitDeDepart();
    http.expectOne('assets/data/starter-kit.json').flush(starterKit);
    const kit = await resultat;
    expect(kit.length).toBe(5);
  });
});
