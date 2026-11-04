// US 41 : species.json contient les 7 espèces du lancement (PLAN §6, §7, §9).
// Décision du propriétaire : aucune taille minimale, tailleMinCm est nul partout.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService, type Espece } from './catalog.service';
import species from '../../../assets/data/species.json';

async function especesDuCatalogue(): Promise<Espece[]> {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const service = TestBed.inject(CatalogService);
  const http = TestBed.inject(HttpTestingController);
  const resultat = service.especes();
  http.expectOne('assets/data/species.json').flush(species);
  http.verify();
  return resultat;
}

const parCode = (liste: Espece[], code: string) => liste.find((e) => e.code === code);

describe('species.json : les 7 espèces du lancement', () => {
  it('critère 0 : given species.json, when on demande les espèces au CatalogService, then il rend 7 espèces BRO, SAN, PER, BBG, CHE, ASP et SIL nommées Brochet, Sandre, Perche, Black-bass, Chevesne, Aspe et Silure', async () => {
    const especes = await especesDuCatalogue();
    expect(especes.length).toBe(7);
    const attendu: Record<string, string> = {
      BRO: 'Brochet', SAN: 'Sandre', PER: 'Perche', BBG: 'Black-bass', CHE: 'Chevesne', ASP: 'Aspe', SIL: 'Silure',
    };
    expect(especes.map((e) => e.code).sort()).toEqual(Object.keys(attendu).sort());
    for (const [code, nom] of Object.entries(attendu)) expect(parCode(especes, code)?.nom).toBe(nom);
  });

  it('critère 1 : given la fiche du brochet, du sandre ou du black-bass, when on lit tailleMinCm, then il est nul', async () => {
    const especes = await especesDuCatalogue();
    for (const code of ['BRO', 'SAN', 'BBG']) {
      const fiche = parCode(especes, code);
      expect(fiche, `fiche ${code} absente`).toBeDefined();
      expect(fiche?.tailleMinCm, `tailleMinCm de ${code}`).toBeNull();
    }
  });

  it('critère 2 : given la fiche de la perche, du chevesne, de l\'aspe ou du silure, when on lit tailleMinCm, then il est nul', async () => {
    const especes = await especesDuCatalogue();
    for (const code of ['PER', 'CHE', 'ASP', 'SIL']) {
      const fiche = parCode(especes, code);
      expect(fiche, `fiche ${code} absente`).toBeDefined();
      expect(fiche?.tailleMinCm, `tailleMinCm de ${code}`).toBeNull();
    }
  });

  it('critère 3 : given la fiche du sandre, when on lit fermetureAvecBrochet, then il vaut vrai', async () => {
    const especes = await especesDuCatalogue();
    expect(parCode(especes, 'SAN')?.fermetureAvecBrochet).toBe(true);
  });

  it('critère 4 : given chaque fiche d\'espèce, when on la lit, then elle a des plages tempEauC, au moins un poste, une proie, des sources et une dateVerif', async () => {
    const especes = await especesDuCatalogue();
    expect(especes.length).toBe(7);
    for (const e of especes) {
      for (const plage of ['active', 'ralentie', 'quasiNulle'] as const) {
        const p = e.tempEauC?.[plage];
        expect(Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number'), `${e.code} tempEauC.${plage}`).toBe(true);
      }
      expect(e.postes.length, `${e.code} postes`).toBeGreaterThanOrEqual(1);
      expect(e.proies.length, `${e.code} proies`).toBeGreaterThanOrEqual(1);
      expect(e.sources.length, `${e.code} sources`).toBeGreaterThanOrEqual(1);
      expect(e.dateVerif, `${e.code} dateVerif`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
