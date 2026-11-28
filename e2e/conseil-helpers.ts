// Aides des tests e2e de l'écran Conseil « rivière en coupe » (US 295) : le coup « 01 » est dans la rivière,
// les coups « 02 » et « 03 » dans la feuille « 2 autres coups ».
import { expect, type Locator, type Page } from '@playwright/test';

export const riviere = (page: Page): Locator => page.getByRole('region', { name: 'Rivière en coupe' });
/** Le coup « 01 » : un lien de la rivière dont le nom commence par « 01 ». */
export const coupUn = (page: Page): Locator => riviere(page).getByRole('link', { name: /^01\b/ });
/** L'écran Conseil est affiché avec son meilleur coup. */
export const conseilAffiche = (page: Page): Promise<void> => expect(coupUn(page)).toBeVisible();
export const ligneEtat = (page: Page, nom: RegExp): Locator => page.getByRole('button', { name: nom });

/** Touche « 2 autres coups » et rend sa feuille. */
export async function ouvrirAutresCoups(page: Page): Promise<Locator> {
  await riviere(page).getByRole('button', { name: /autres? coups?/ }).click();
  const feuille = page.getByRole('dialog', { name: /autres? coups?/ });
  await expect(feuille).toBeVisible();
  return feuille;
}

/** Les trois coups : le lien « 01 » de la rivière, puis les liens « 02 » et « 03 » de la feuille (ouverte au passage). */
export async function tousLesCoups(page: Page): Promise<Locator[]> {
  const feuille = await ouvrirAutresCoups(page);
  return [coupUn(page), feuille.getByRole('link', { name: /^02\b/ }), feuille.getByRole('link', { name: /^03\b/ })];
}

/** Ouvre le détail du coup de ce rang (1, 2 ou 3). */
export async function ouvrirDetailDuCoup(page: Page, rang = 1): Promise<void> {
  if (rang === 1) await coupUn(page).click();
  else await (await ouvrirAutresCoups(page)).getByRole('link', { name: new RegExp(`^0${rang}\\b`) }).click();
  await expect(page.getByText('Détail du conseil')).toBeVisible();
}

/** Ouvre la feuille « Conditions » par la ligne météo. */
export async function ouvrirConditions(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /vent/i }).click();
  const feuille = page.getByRole('dialog', { name: 'Conditions' });
  await expect(feuille).toBeVisible();
  return feuille;
}

/** Les conditions de l'écran Conseil sont prêtes : la ligne de l'eau porte son bouton thermomètre. */
export const conditionsAffichees = (page: Page): Promise<void> =>
  expect(page.getByRole('button', { name: "Saisir la température de l'eau" })).toBeVisible();

/** Le top 3 est là : le coup 01 dans la rivière, 02 et 03 dans la feuille « 2 autres coups » (refermée ensuite). */
export async function top3Affiche(page: Page): Promise<void> {
  await conseilAffiche(page);
  const feuille = await ouvrirAutresCoups(page);
  await expect(feuille.getByRole('link', { name: /^02\b/ })).toBeVisible();
  await expect(feuille.getByRole('link', { name: /^03\b/ })).toBeVisible();
  await feuille.getByRole('button', { name: 'Fermer' }).click();
  await expect(feuille).toHaveCount(0);
}

/** L'écran Conseil est affiché : il n'a plus de barre de titre, son titre est le lieu et sa rivière est toujours là (US 295). */
export const ecranConseil = (page: Page): Promise<void> => expect(riviere(page)).toBeVisible();

/** Ce qui est tout en haut de l'écran, sous l'indicateur « Hors ligne » : la barre de titre, ou le lieu du Conseil. */
export const hautDeLEcran = (page: Page, nom: string): Locator => (nom === 'Conseil' ? page.getByRole('heading', { level: 1 }) : page.locator('ion-toolbar:visible').first());

/** L'écran de ce nom est affiché : le Conseil par sa rivière, les autres par le titre de leur barre. */
export async function ecranAffiche(page: Page, nom: string): Promise<void> {
  if (nom === 'Conseil') await ecranConseil(page);
  else await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText(nom);
}
