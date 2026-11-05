// US 45 : le contenu réel de federations.json (une fédération par département de métropole) est exposé par CatalogService.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';
import federations from '../../../assets/data/federations.json';

const CODES = [
  ...Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, '0')),
  '2A',
  '2B',
  ...Array.from({ length: 75 }, (_, i) => String(i + 21)),
];

describe('Contenu des fédérations (US 45)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('critère 1 : given federations.json, when on demande l\'URL de chaque département de métropole au CatalogService, then il rend une URL https pour chacun', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(CatalogService);
    const http = TestBed.inject(HttpTestingController);
    expect(CODES.length).toBe(96);
    const premiere = service.urlFederation(CODES[0]);
    http.expectOne('assets/data/federations.json').flush(federations);
    const urls = [await premiere, ...(await Promise.all(CODES.slice(1).map((c) => service.urlFederation(c))))];
    const sansUrl = CODES.filter((_, i) => !urls[i]?.startsWith('https://'));
    expect(sansUrl).toEqual([]);
  });
});
