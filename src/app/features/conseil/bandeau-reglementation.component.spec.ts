/*
 * US 80, PLAN §2.1, §3, §6 : bandeau « Réglementation » de l'écran Conseil (maquette docs/maquettes/us-80-bandeau-reglementation.html).
 * Le composant reçoit en entrées ce que les US 83 (espèce) et 87 (spot) fourniront : categorie, espece, date, federation.
 * Contenu réel (species.json, federations.json) ; aucun réseau.
 */
import { TestBed } from '@angular/core/testing';
import especesReelles from '../../../assets/data/species.json';
import federationsReelles from '../../../assets/data/federations.json';
import type { Espece, Federation } from '../../core/data/catalog.types';
import { BandeauReglementationComponent } from './bandeau-reglementation.component';

const especes = especesReelles as unknown as Espece[];
const federations = federationsReelles as unknown as Federation[];
const espece = (code: string): Espece => {
  const e = especes.find((x) => x.code === code);
  if (!e) throw new Error(`fiche ${code} absente de species.json`);
  return e;
};
const SANDRE = espece('SAN');
const BLACK_BASS = espece('BBG');
const FEDERATION_49 = federations.find((f) => f.departement === '49') as Federation;

interface Entrees {
  categorie: 1 | 2 | null;
  espece: Espece | null;
  date: Date;
  federation: Federation | undefined;
}

async function afficher(entrees: Partial<Entrees> = {}) {
  await TestBed.configureTestingModule({ imports: [BandeauReglementationComponent] }).compileComponents();
  const fixture = TestBed.createComponent(BandeauReglementationComponent);
  const valeurs: Entrees = {
    categorie: 2,
    espece: null,
    date: new Date(2026, 5, 15),
    federation: FEDERATION_49,
    ...entrees,
  };
  for (const [nom, valeur] of Object.entries(valeurs)) fixture.componentRef.setInput(nom, valeur);
  fixture.detectChanges();
  await fixture.whenStable();
  const racine = fixture.nativeElement as HTMLElement;
  const texte = (racine.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { racine, texte };
}

describe('BandeauReglementationComponent (US 80)', () => {
  it("given un spot de 1re catégorie le 01/03/2026, when j'ouvre la feuille « Réglementation » de l'écran Conseil, then le bandeau affiche « Fermé jusqu'au 14/03 »", async () => {
    const { texte } = await afficher({ categorie: 1, date: new Date(2026, 2, 1) });

    // US 295 : le titre « Réglementation » est celui de la feuille qui contient le bandeau, plus celui du bandeau.
    expect(texte).toContain("Fermé jusqu'au 14/03");
  });

  it("given un spot de 1re catégorie le 08/11/2026, when le bandeau s'affiche, then il affiche « Fermé jusqu'au 13/03 » (ouverture de l'année suivante)", async () => {
    const { texte } = await afficher({ categorie: 1, date: new Date(2026, 10, 8) });

    expect(texte).toContain("Fermé jusqu'au 13/03");
  });

  it("given un spot de 2e catégorie le 10/02/2026, when j'ouvre l'onglet Conseil, then le bandeau affiche « Brochet fermé jusqu'au 24/04 »", async () => {
    const { texte } = await afficher({ categorie: 2, date: new Date(2026, 1, 10) });

    expect(texte).toContain("Brochet fermé jusqu'au 24/04");
  });

  it("given l'espèce visée « sandre » pendant la fermeture du brochet, when le bandeau s'affiche, then il affiche « Sandre probablement fermé, vérifie »", async () => {
    const { texte } = await afficher({ categorie: 2, espece: SANDRE, date: new Date(2026, 1, 10) });

    // US 84 (maquette validée) : plus de deux-points après « Sandre ».
    expect(texte).toContain('Sandre probablement fermé, vérifie');
  });

  it("given l'espèce visée « black-bass » au printemps, when le bandeau s'affiche, then il affiche « Black-bass : vérifie ton département »", async () => {
    const { texte } = await afficher({ categorie: 2, espece: BLACK_BASS, date: new Date(2026, 3, 15) });

    expect(texte).toContain('Black-bass : vérifie ton département');
  });

  it("given l'espèce visée « sandre » en 2e catégorie avec une taille minimale de 50 cm, when le bandeau s'affiche, then il affiche « Taille minimale : 50 cm » et « Quota : 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum »", async () => {
    const { texte } = await afficher({
      categorie: 2,
      espece: { ...SANDRE, tailleMinCm: 50 },
      date: new Date(2026, 5, 15),
    });

    expect(texte).toContain('Taille minimale : 50 cm');
    // US 84 (maquette validée) : quota « par pêcheur », « au maximum ».
    expect(texte).toContain('Quota : 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum');
  });

  it("given la vraie fiche du sandre (sans taille minimale nationale) en 2e catégorie, when le bandeau s'affiche, then il affiche « Taille minimale : pas de taille minimale nationale »", async () => {
    const { texte } = await afficher({ categorie: 2, espece: SANDRE, date: new Date(2026, 5, 15) });

    expect(texte).toContain('Taille minimale : pas de taille minimale nationale');
  });

  it("given le choix « toutes » les espèces, when le bandeau s'affiche, then aucune ligne « Taille minimale » n'est affichée", async () => {
    const { texte } = await afficher({ categorie: 2, espece: null, date: new Date(2026, 5, 15) });

    expect(texte).not.toContain('Taille minimale');
  });

  it("given une catégorie inconnue le 10/02/2026, when le bandeau s'affiche, then il applique la 2e catégorie (« Brochet fermé en 2e catégorie », aucune ligne « 1re catégorie ») et « Quota : 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum »", async () => {
    const { texte } = await afficher({ categorie: null, date: new Date(2026, 1, 10) });

    // US 84 (maquette validée) : plus de ligne « 1re catégorie » ; la fermeture du brochet devient une alerte ; le quota perd « en 2e catégorie ».
    expect(texte).not.toContain('1re catégorie');
    expect(texte).toContain('Brochet fermé en 2e catégorie');
    expect(texte).toContain('Quota : 3 carnassiers par jour et par pêcheur, dont 2 brochets au maximum');
  });

  it("given un lieu en Maine-et-Loire, when le bandeau s'affiche, then il affiche « À vérifier dans l'arrêté de ton département » et un lien « <nom de la fédération> ↗ » vers l'adresse du 49 lue dans federations.json", async () => {
    const { racine, texte } = await afficher({ federation: FEDERATION_49 });

    expect(FEDERATION_49?.url).toBeTruthy();
    expect(texte).toContain("À vérifier dans l'arrêté de ton département");
    const lien = racine.querySelector('a');
    // US 295 (maquette validée) : le lien porte le nom de la fédération.
    expect(lien?.textContent?.trim()).toBe(`${FEDERATION_49.nom} ↗`);
    expect(lien?.getAttribute('href')).toBe(FEDERATION_49.url);
    expect(lien?.getAttribute('target')).toBe('_blank');
    expect(lien?.getAttribute('rel')).toContain('noopener');
  });

  it("given un département inconnu (aucune fédération), when le bandeau s'affiche, then la mention reste et il n'y a aucun lien (pas de repli sur la fédération nationale)", async () => {
    const { racine, texte } = await afficher({ federation: undefined });

    expect(texte).toContain("À vérifier dans l'arrêté de ton département");
    // US 84 (maquette validée) : plus de repli sur la fédération nationale.
    expect(racine.querySelector('a')).toBeNull();
  });
});
