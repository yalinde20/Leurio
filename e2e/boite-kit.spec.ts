// US 103 : voir le kit de départ conseillé, sur les émulateurs (PLAN §2.3, §3, §5 : starter-kit.json).
// Contrat du DOM : voir src/app/features/boite/boite.page.kit.spec.ts (feuille = [role="dialog"], un `li` par leurre du kit).
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

test.use({ viewport: { width: 390, height: 844 } });

interface ElementKit {
  typeId: string;
  raison: string;
}
interface TypeLeurre {
  id: string;
  nom: string;
}
const lire = <T>(f: string) => JSON.parse(readFileSync(join(process.cwd(), 'src/assets/data', `${f}.json`), 'utf8')) as T;
const KIT = lire<ElementKit[]>('starter-kit');
const NOMS = new Map(lire<TypeLeurre[]>('lure-types').map((t) => [t.id, t.nom]));

test.beforeEach(async ({ page }) => {
  await onboardingTermine(page);
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
});

async function ouvrirBoite(page: Page): Promise<void> {
  await page.goto('/');
  await attendreFirebase(page);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lireUid = () => page.evaluate(() => (((window as any).leurioFirebase.auth.currentUser?.uid ?? null) as string | null));
  await expect.poll(lireUid, { timeout: 20_000 }).not.toBeNull();
  await page.getByRole('tab', { name: 'Boîte', exact: true }).click();
  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Boîte');
}

const feuille = (page: Page) => page.locator('[role="dialog"]');
const ouvrirKit = async (page: Page) => {
  await page.getByRole('button', { name: 'Kit de départ conseillé', exact: true }).click();
  await expect(feuille(page)).toBeVisible();
};

async function ajouterLeurre(page: Page, type: string): Promise<void> {
  await page.getByRole('button', { name: 'Ajouter un leurre', exact: true }).click();
  const f = feuille(page);
  await f.getByLabel('Type').selectOption({ label: type });
  await f.getByLabel('Taille (cm)').fill('10');
  await f.getByLabel('Poids (g)').fill('12');
  await f.getByLabel('Couleur').fill('gardon');
  await f.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(feuille(page)).toHaveCount(0);
}

test('critère 1 : given l\'onglet « Boîte » affiché, when je touche « Kit de départ conseillé », then les 5 leurres de starter-kit.json s\'affichent dans l\'ordre, avec nom et raison', async ({ page }) => {
  expect(KIT).toHaveLength(5);
  await ouvrirBoite(page);
  await ouvrirKit(page);
  const lignes = feuille(page).locator('li');
  await expect(lignes).toHaveCount(5);
  for (const [i, element] of KIT.entries()) {
    await expect(lignes.nth(i)).toContainText(`${i + 1}.`);
    await expect(lignes.nth(i)).toContainText(NOMS.get(element.typeId)!);
    await expect(lignes.nth(i)).toContainText(element.raison);
  }
});

test('critère 2 : given j\'ajoute un Shad à ma boîte, when j\'ouvre « Kit de départ conseillé », then le Shad du kit porte « Déjà dans ta boîte » et les autres non', async ({ page }) => {
  await ouvrirBoite(page);
  await ajouterLeurre(page, 'Shad');
  await ouvrirKit(page);
  const lignes = feuille(page).locator('li');
  await expect(lignes).toHaveCount(5);
  const iShad = KIT.findIndex((e) => e.typeId === 'shad');
  expect(iShad).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < KIT.length; i++) {
    if (i === iShad) await expect(lignes.nth(i)).toContainText('Déjà dans ta boîte');
    else await expect(lignes.nth(i)).not.toContainText('Déjà dans ta boîte');
  }
  await expect(feuille(page)).toContainText('1 sur 5 dans ta boîte');
});

test('critère 3 : given ma boîte est vide, when j\'ouvre « Kit de départ conseillé », then aucun leurre du kit ne porte « Déjà dans ta boîte »', async ({ page }) => {
  await ouvrirBoite(page);
  await expect(page.getByText('Ta boîte est vide.')).toBeVisible();
  await ouvrirKit(page);
  await expect(feuille(page).locator('li')).toHaveCount(5);
  await expect(feuille(page).getByText('Déjà dans ta boîte')).toHaveCount(0);
  await expect(feuille(page)).toContainText('0 sur 5 dans ta boîte');
  await feuille(page).getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(feuille(page)).toHaveCount(0);
});

test('critère 4 : given un starter-kit.json modifié (3 leurres dans un autre ordre), when j\'ouvre « Kit de départ conseillé », then la liste suit le contenu sans modification du code', async ({ page }) => {
  const modifie = [
    { ...KIT[4], raison: 'Raison modifiée du stickbait.' },
    { ...KIT[0], raison: 'Raison modifiée du shad.' },
    { ...KIT[2], raison: 'Raison modifiée du ver.' },
  ];
  await page.route('**/assets/data/starter-kit.json', (route) => route.fulfill({ json: modifie }));
  await ouvrirBoite(page);
  await ouvrirKit(page);
  const lignes = feuille(page).locator('li');
  await expect(lignes).toHaveCount(3);
  for (const [i, element] of modifie.entries()) {
    await expect(lignes.nth(i)).toContainText(NOMS.get(element.typeId)!);
    await expect(lignes.nth(i)).toContainText(element.raison);
  }
  await expect(feuille(page)).toContainText('0 sur 3 dans ta boîte');
});
