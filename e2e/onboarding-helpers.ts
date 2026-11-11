import type { Page } from '@playwright/test';

/** Clé du localStorage où Leurio garde l'onboarding terminé (US 89, OnboardingStore). */
export const CLE_ONBOARDING = 'leurio.onboarding';

/**
 * Marque l'onboarding comme terminé avant le chargement de chaque page : l'app s'ouvre alors directement
 * sur l'écran « Conseil », comme avant l'US 89. À appeler avant `page.goto`.
 */
export async function onboardingTermine(page: Page, niveau: 'debutant' | 'intermediaire' = 'debutant'): Promise<void> {
  await page.addInitScript(
    ([cle, valeur]) => {
      // Une seule fois par onglet : un rechargement ne réécrit pas ce que l'app a gardé depuis.
      if (!localStorage.getItem(cle)) localStorage.setItem(cle, valeur);
    },
    [CLE_ONBOARDING, JSON.stringify({ niveau, especesFavorites: [] })],
  );
}
