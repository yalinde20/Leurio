import { test, expect } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';
import { ecranConseil } from './conseil-helpers';

test('critère 4 : given le serveur de développement, when on ouvre l\'app, then aucun service worker n\'est enregistré', async ({ page }) => {
  await onboardingTermine(page);
  // US 90 : au lancement, l'app crée le compte anonyme ; les flux longs de Firestore empêcheraient « networkidle ».
  // Firestore est hors sujet ici (service worker) : ses requêtes vers l'émulateur sont coupées (fixture, assertions inchangées).
  await page.route('http://127.0.0.1:8080/**', (route) => route.abort());
  await page.route('http://localhost:8080/**', (route) => route.abort());
  // Compte les tentatives d'enregistrement : un 404 sur ngsw-worker.js ne doit pas masquer un register() appelé.
  await page.addInitScript(() => {
    const w = window as unknown as { __registerAppels: number };
    w.__registerAppels = 0;
    if (!('serviceWorker' in navigator)) return;
    const original = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (...args: Parameters<ServiceWorkerContainer['register']>) => {
      w.__registerAppels++;
      return original(...args);
    };
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await ecranConseil(page);

  const { appels, enregistrements } = await page.evaluate(async () => {
    const appels = (window as unknown as { __registerAppels: number }).__registerAppels;
    if (!('serviceWorker' in navigator)) return { appels, enregistrements: 0 };
    return { appels, enregistrements: (await navigator.serviceWorker.getRegistrations()).length };
  });
  expect(appels).toBe(0);
  expect(enregistrements).toBe(0);
});
