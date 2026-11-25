import { test, expect } from '@playwright/test';

// US 23, critères 1 à 3 : un visiteur sans l'app ouvre leurio.app/confidentialite (ici le build servi par serve-dist, qui imite Firebase Hosting avec cleanUrls).
// Aucune fixture d'onboarding : le visiteur n'a jamais ouvert l'app.
test('critère 1 : given un visiteur sans l\'app, when il ouvre /confidentialite, then il voit la page statique et ses 5 rubriques, pas l\'app Angular', async ({ page }) => {
  const reponse = await page.goto('/confidentialite');

  expect(reponse?.status()).toBe(200);
  expect(reponse?.headers()['content-type']).toContain('text/html');
  await expect(page.locator('app-root')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
  for (const nom of ['Données collectées', 'Services utilisés (Firebase)', 'Consentements', 'Suppression du compte', 'Export de tes données']) {
    await expect(page.getByRole('heading', { level: 2, name: nom })).toBeVisible();
  }
});

test('critère 2 : given la page publique, when le visiteur lit « Données collectées », then elle cite les retours 👍 / 👎 sans coordonnées exactes et les rapports de plantage', async ({ page }) => {
  await page.goto('/confidentialite');
  const texte = await page.locator('body').innerText();
  expect(texte).toContain('sans coordonnées exactes');
  expect(texte).toContain('rapports de plantage');
});

test('critère 3 : given la page publique, when le visiteur lit « Consentements », then elle renvoie à « Compte › Consentements »', async ({ page }) => {
  await page.goto('/confidentialite');
  await expect(page.locator('body')).toContainText(/Compte\s*[›>]\s*Consentements/);
});
