import { test, expect } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';

// US 89 : l'onboarding est terminé, l'app s'ouvre sur le Conseil (fixture, aucune assertion changée).
test.beforeEach(async ({ page }) => onboardingTermine(page));

test('critère 0 : given l\'app démarrée, when on ouvre la page, then l\'écran Conseil titré « Conseil » s\'affiche sans erreur dans la console', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(e.message));

  await page.goto('/');

  await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Conseil');
  await expect(page.locator('ion-content')).toBeVisible();
  expect(erreurs).toEqual([]);
});
