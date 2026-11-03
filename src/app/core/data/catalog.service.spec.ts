// US 40 : CatalogService expose le contenu embarqué (assets/data/*.json) à l'app.
// Contrat : src/app/core/data/catalog.service.ts exporte `CatalogService` (providedIn: 'root').
// Les fichiers sont lus avec HttpClient (URL relative `assets/data/<fichier>.json`), une seule fois par fichier.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';
import species from '../../../assets/data/species.json';
import lureTypes from '../../../assets/data/lure-types.json';
import techniques from '../../../assets/data/techniques.json';
import starterKit from '../../../assets/data/starter-kit.json';

const SOURCES = ['Donnée de test'];
const federation = (departement: string) => ({
  departement, nom: 'Fédération de test', url: `https://exemple.test/${departement}`, sources: SOURCES, dateVerif: '2026-11-03',
});

function mise_en_place() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { service: TestBed.inject(CatalogService), http: TestBed.inject(HttpTestingController) };
}

describe('CatalogService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('critère 0 : given les fichiers de contenu, when on demande les espèces, then il rend toutes les fiches de species.json avec leurs champs', async () => {
    const { service, http } = mise_en_place();
    const resultat = service.especes();
    http.expectOne('assets/data/species.json').flush(species);
    expect(await resultat).toEqual(species);
  });

  it('critère 1 : given les fichiers de contenu, when on demande les types de leurres, then il rend toutes les entrées de lure-types.json', async () => {
    const { service, http } = mise_en_place();
    const resultat = service.typesDeLeurres();
    http.expectOne('assets/data/lure-types.json').flush(lureTypes);
    expect(await resultat).toEqual(lureTypes);
  });

  it('critère 1 : given les fichiers de contenu, when on demande les animations, then il rend toutes les entrées de techniques.json', async () => {
    const { service, http } = mise_en_place();
    const resultat = service.animations();
    http.expectOne('assets/data/techniques.json').flush(techniques);
    expect(await resultat).toEqual(techniques);
  });

  it('critère 1 : given les fichiers de contenu, when on demande le kit de départ, then il rend toutes les entrées de starter-kit.json', async () => {
    const { service, http } = mise_en_place();
    const resultat = service.kitDeDepart();
    http.expectOne('assets/data/starter-kit.json').flush(starterKit);
    expect(await resultat).toEqual(starterKit);
  });

  it('critère 2 : given une 8e espèce de test citée par un type de leurre, when on demande espèces et types de leurres, then la 8e espèce est rendue et le type de leurre la cite', async () => {
    const { service, http } = mise_en_place();
    const huitieme = { ...species[0], code: 'TST', nom: 'Espèce de test' };
    const especesTest = [...species, huitieme];
    const typesTest = lureTypes.map((t, i) => (i === 0 ? { ...t, especes: [...t.especes, 'TST'] } : t));

    const especes = service.especes();
    const types = service.typesDeLeurres();
    http.expectOne('assets/data/species.json').flush(especesTest);
    http.expectOne('assets/data/lure-types.json').flush(typesTest);

    const rendues = await especes;
    expect(rendues.find((e) => e.code === 'TST')?.nom).toBe('Espèce de test');
    expect((await types)[0].especes).toContain('TST');
  });

  it('critère 3 : given un département présent dans federations.json, when on demande son URL, then il rend l\'URL de la fédération', async () => {
    const { service, http } = mise_en_place();
    const resultat = service.urlFederation('49');
    http.expectOne('assets/data/federations.json').flush([federation('44'), federation('49')]);
    expect(await resultat).toBe('https://exemple.test/49');
  });

  it('critère 4 : given un département absent de federations.json, when on demande son URL, then il rend undefined sans erreur', async () => {
    const { service, http } = mise_en_place();
    const resultat = service.urlFederation('99');
    http.expectOne('assets/data/federations.json').flush([federation('49')]);
    await expect(resultat).resolves.toBeUndefined();
  });

  it('critère 4 : given une liste de fédérations vide, when on demande l\'URL d\'un département, then il rend undefined sans erreur', async () => {
    const { service, http } = mise_en_place();
    const resultat = service.urlFederation('49');
    http.expectOne('assets/data/federations.json').flush([]);
    await expect(resultat).resolves.toBeUndefined();
  });

  it('given un fichier déjà chargé, when on le redemande, then il n\'est pas requêté une seconde fois', async () => {
    const { service, http } = mise_en_place();
    const premier = service.especes();
    http.expectOne('assets/data/species.json').flush(species);
    await premier;
    expect(await service.especes()).toEqual(species);
    http.expectNone('assets/data/species.json');
  });
});
