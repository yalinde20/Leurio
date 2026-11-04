// US 42 : le contenu réel de techniques.json (8 animations) est exposé par CatalogService.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';
import techniques from '../../../assets/data/techniques.json';

describe('Contenu des animations (US 42)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('critère 1 : given techniques.json, when on demande les animations au CatalogService, then il en rend 8, dont la verticale et la tirée-relâchée', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(CatalogService);
    const http = TestBed.inject(HttpTestingController);
    const resultat = service.animations();
    http.expectOne('assets/data/techniques.json').flush(techniques);
    const animations = await resultat;
    expect(animations).toHaveLength(8);
    const ids = animations.map((a) => a.id);
    expect(ids).toContain('verticale');
    expect(ids).toContain('tiree-relachee');
  });
});
