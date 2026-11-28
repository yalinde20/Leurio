/**
 * Aides des specs de l'écran Conseil « rivière en coupe » (US 295) : ouvrir les feuilles, lire les coups.
 * Les specs gardent leurs propres doubles ; ces aides ne lisent que le DOM de la page.
 */
import type { ComponentFixture } from '@angular/core/testing';

export const compact = (texte: string | null | undefined): string => (texte ?? '').replace(/[\s\u00a0\u202f]/g, '');

/** Laisse la page finir ses lectures asynchrones et son rendu. */
export async function stabiliser(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

/** Ce que les aides ont besoin d'une spec : la page et de quoi attendre son rendu. */
export interface Ecran {
  page: HTMLElement;
  stabiliser(): Promise<void>;
}

export const ecranDe = (fixture: ComponentFixture<unknown>): Ecran => ({
  page: fixture.nativeElement as HTMLElement,
  stabiliser: () => stabiliser(fixture),
});

/** La feuille ouverte (dialogue de `app-feuille-conseil`) de ce nom, ou `null`. */
export function feuille(page: HTMLElement, nom: string): HTMLElement | null {
  return [...page.querySelectorAll<HTMLElement>('app-feuille-conseil [role="dialog"]')].find((d) => d.getAttribute('aria-label') === nom) ?? null;
}

async function toucher(ecran: Ecran, cible: HTMLElement | null | undefined, nom: string): Promise<void> {
  if (!cible) throw new Error(`Aucun bouton « ${nom} »`);
  cible.click();
  await ecran.stabiliser();
}

/** Touche « 2 autres coups » et rend sa feuille. */
export async function ouvrirAutresCoups(ecran: Ecran): Promise<HTMLElement> {
  const { page } = ecran;
  await toucher(ecran, page.querySelector<HTMLElement>('#autres-coups'), '2 autres coups');
  const f = [...page.querySelectorAll<HTMLElement>('app-feuille-conseil [role="dialog"]')][0];
  if (!f) throw new Error('La feuille « 2 autres coups » ne s\'est pas ouverte');
  return f;
}

/** Touche la ligne météo et rend la feuille « Conditions ». */
export async function ouvrirConditions(ecran: Ecran): Promise<HTMLElement> {
  const { page } = ecran;
  await toucher(ecran, page.querySelector<HTMLElement>('.meteo'), 'ligne météo');
  const f = feuille(page, 'Conditions');
  if (!f) throw new Error('La feuille « Conditions » ne s\'est pas ouverte');
  return f;
}

/** Touche la ligne d'état réglementaire et rend la feuille « Réglementation ». */
export async function ouvrirReglementation(ecran: Ecran): Promise<HTMLElement> {
  const { page } = ecran;
  await toucher(ecran, page.querySelector<HTMLElement>('button.etat'), "ligne d'état");
  const f = feuille(page, 'Réglementation');
  if (!f) throw new Error('La feuille « Réglementation » ne s\'est pas ouverte');
  return f;
}

/** Les coups de la rivière : le « 01 » est le lien de la rivière, les autres sont ceux de la feuille « 2 autres coups » si elle est ouverte. */
export function liensDesCoups(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>('app-riviere-en-coupe a.coup')];
}

/** Le texte compact des trois coups (01, puis 02 et 03 par la feuille) ; la feuille reste ouverte. */
export async function textesDesCoups(ecran: Ecran): Promise<string[]> {
  const { page } = ecran;
  const un = liensDesCoups(page).map((l) => compact(l.textContent));
  if (un.length === 0 || !page.querySelector('#autres-coups')) return un;
  await ouvrirAutresCoups(ecran);
  return liensDesCoups(page).map((l) => compact(l.textContent));
}
