import { expect, type Page } from '@playwright/test';

// US 294 : naviguer avec le dock (Boîte · Ma sortie · Spots), l'avatar « Compte » et le bouton de retour « Conseil » (PLAN §3).

export type Ecran = 'Conseil' | 'Boîte' | 'Spots' | 'Compte';

export const dock = (page: Page) => page.getByRole('navigation', { name: 'Navigation' });
export const retourConseil = (page: Page) => page.getByRole('button', { name: 'Conseil', exact: true });

/** Revient au Conseil : par le bouton de retour « Conseil » (et par « Compte » d'abord depuis une sous-page de Compte). Sans effet sur le Conseil. */
async function versLeConseil(page: Page): Promise<void> {
  if (!(await dock(page).isVisible())) {
    if (!(await retourConseil(page).isVisible())) await page.getByRole('button', { name: /^Compte$/ }).first().click();
    await retourConseil(page).click();
  }
  await expect(dock(page)).toBeVisible();
}

/** Ouvre un écran par le dock ou l'avatar, ou revient au Conseil ; passe par le Conseil si on est ailleurs. */
export async function ouvrirEcran(page: Page, nom: Ecran): Promise<void> {
  await versLeConseil(page);
  if (nom === 'Compte') await page.getByRole('button', { name: 'Compte', exact: true }).click();
  else if (nom !== 'Conseil') await dock(page).getByRole('link', { name: nom, exact: true }).click();
  if (nom !== 'Conseil') {
    // Le Conseil reste affiché pendant que l'écran s'ouvre : on attend le nouvel écran (sans dock, avec son retour « Conseil »).
    await expect(dock(page)).toBeHidden();
    await expect(retourConseil(page)).toBeVisible();
  }
}
