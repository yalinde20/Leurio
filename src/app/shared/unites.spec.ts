/*
 * US 93 : les unités de l'app (PLAN §3, §7 inchangé : les unités restent sur l'appareil, décision U1).
 * Critère 4 au niveau fonctions pures et service ; l'affichage dans les écrans est dans unites.ecrans.spec.ts.
 *
 * Fichiers et symboles attendus (à créer) :
 *  - src/app/shared/unites.ts (TypeScript pur, sans Angular) :
 *      type Unites = 'metriques' | 'imperiales'
 *      formaterTemperature(celsius: number, unites: Unites): string   « 11,5 °C » | « 52,7 °F »  (°F = °C × 9/5 + 32, 1 décimale)
 *      formaterLongueur(cm: number, unites: Unites): string           « 8 cm »   | « 3,1 po »     (po = cm / 2,54, 1 décimale)
 *      formaterPoids(g: number, unites: Unites): string               « 10 g »   | « 0,35 oz »    (oz = g / 28,3495, 2 décimales)
 *      formaterPlage(min: number, max: number, grandeur: 'longueur' | 'poids', unites: Unites, separateur = ' à '): string
 *                                                                      « 5 à 10 g » | « 0,18 à 0,35 oz »  (les deux bornes sont converties)
 *    Format français (virgule, zéros inutiles retirés), espace (insécable ou non) entre le nombre et l'unité.
 *  - src/app/shared/unites.service.ts : `UnitesService` (providedIn root), clé du localStorage `leurio.unites`
 *      choix: Signal<Unites>, choisir(unites: Unites): void ; défaut « metriques » ; une valeur illisible vaut « metriques ».
 */
import { TestBed } from '@angular/core/testing';
import { formaterLongueur, formaterPlage, formaterPoids, formaterTemperature } from './unites';
import { UnitesService } from './unites.service';

const compact = (t: string): string => t.replace(/[\s\u00a0\u202f]/g, '');

describe('Unités : conversions (US 93)', () => {
  it('critère 4 : given une température en °C, when le système est impérial, then elle est donnée en °F avec 1 décimale et la virgule française', () => {
    expect(compact(formaterTemperature(11.5, 'imperiales'))).toBe('52,7°F');
    expect(compact(formaterTemperature(0, 'imperiales'))).toBe('32°F');
    expect(compact(formaterTemperature(-2, 'imperiales'))).toBe('28,4°F');
    expect(compact(formaterTemperature(12.4, 'imperiales'))).toBe('54,3°F');
    expect(compact(formaterTemperature(17, 'imperiales'))).toBe('62,6°F');
  });

  it('critère 4 : given une température en °C, when le système est métrique, then elle reste en °C comme avant', () => {
    expect(compact(formaterTemperature(11.5, 'metriques'))).toBe('11,5°C');
    expect(compact(formaterTemperature(9, 'metriques'))).toBe('9°C');
  });

  it('critère 4 : given une longueur en cm, when le système est impérial, then elle est donnée en po avec 1 décimale', () => {
    expect(compact(formaterLongueur(8, 'imperiales'))).toBe('3,1po');
    expect(compact(formaterLongueur(10, 'imperiales'))).toBe('3,9po');
    expect(compact(formaterLongueur(50, 'imperiales'))).toBe('19,7po');
    expect(compact(formaterLongueur(2.54, 'imperiales'))).toBe('1po');
  });

  it('critère 4 : given une longueur en cm, when le système est métrique, then elle reste en cm', () => {
    expect(compact(formaterLongueur(7.5, 'metriques'))).toBe('7,5cm');
    expect(compact(formaterLongueur(8, 'metriques'))).toBe('8cm');
  });

  it('critère 4 : given un poids en g, when le système est impérial, then il est donné en oz avec 2 décimales', () => {
    expect(compact(formaterPoids(10, 'imperiales'))).toBe('0,35oz');
    expect(compact(formaterPoids(14, 'imperiales'))).toBe('0,49oz');
    expect(compact(formaterPoids(100, 'imperiales'))).toBe('3,53oz');
    expect(compact(formaterPoids(28.3495, 'imperiales'))).toBe('1oz');
  });

  it('critère 4 : given un poids en g, when le système est métrique, then il reste en g', () => {
    expect(compact(formaterPoids(10, 'metriques'))).toBe('10g');
  });

  it('critère 4 : given une plage, when le système est impérial, then les deux bornes sont converties', () => {
    expect(compact(formaterPlage(5, 10, 'poids', 'imperiales'))).toBe('0,18à0,35oz');
    expect(compact(formaterPlage(7, 12, 'longueur', 'imperiales'))).toBe('2,8à4,7po');
    expect(compact(formaterPlage(7, 12, 'longueur', 'imperiales', '–'))).toBe('2,8–4,7po');
  });

  it('critère 4 : given une plage, when le système est métrique, then elle reste telle quelle', () => {
    expect(compact(formaterPlage(5, 10, 'poids', 'metriques'))).toBe('5à10g');
    expect(compact(formaterPlage(7, 12, 'longueur', 'metriques', '–'))).toBe('7–12cm');
  });
});

describe('UnitesService (US 93, décision U1 : sur l\'appareil seulement)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('critère 4 : given je n\'ai jamais choisi, when l\'app démarre, then le système est « metriques » et rien n\'est écrit', () => {
    expect(TestBed.inject(UnitesService).choix()).toBe('metriques');
    expect(localStorage.getItem('leurio.unites')).toBeNull();
  });

  it('critère 4 : given je choisis « imperiales », when je relance l\'app, then le choix est gardé dans leurio.unites', () => {
    TestBed.inject(UnitesService).choisir('imperiales');
    expect(TestBed.inject(UnitesService).choix()).toBe('imperiales');
    expect(localStorage.getItem('leurio.unites')).toBe('imperiales');

    TestBed.resetTestingModule();
    expect(TestBed.inject(UnitesService).choix()).toBe('imperiales');
  });

  it('critère 4 : given une valeur illisible dans le stockage, when l\'app démarre, then le système est « metriques »', () => {
    localStorage.setItem('leurio.unites', 'nimporte-quoi');
    expect(TestBed.inject(UnitesService).choix()).toBe('metriques');
  });
});
