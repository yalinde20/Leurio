import { test, expect, type Page } from '@playwright/test';
import { CLE_ONBOARDING } from './onboarding-helpers';

// US 89 : l'onboarding en 3 pages, dans un vrai navigateur sur un téléphone (iPhone, 390 px).
// Maquette : docs/maquettes/us-89-onboarding-3-pages.html. Aucun service réel : Hub'Eau répond par un faux relevé, Open-Meteo est coupé.
// Chaque test part d'un stockage vide (contexte neuf) : c'est le premier lancement.

test.use({ viewport: { width: 390, height: 844 } });

const MAINTENANT = new Date('2026-11-09T12:00:00Z');

declare global {
  interface Window {
    __geoAppels: number;
  }
}

/** Compte chaque appel à la géolocalisation du navigateur (ce qui déclenche la demande du téléphone). `refus` : répond « refusé ». */
async function espionnerGeolocalisation(page: Page, refus = false): Promise<void> {
  await page.addInitScript((refuser) => {
    window.__geoAppels = 0;
    const geo = navigator.geolocation;
    const original = geo.getCurrentPosition.bind(geo);
    geo.getCurrentPosition = (succes, erreur, options) => {
      window.__geoAppels++;
      if (refuser) {
        erreur?.({ code: 1, message: 'refusé', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
        return;
      }
      original(succes, erreur, options);
    };
    geo.watchPosition = (...args) => {
      window.__geoAppels++;
      return refuser ? 0 : Object.getPrototypeOf(geo).watchPosition.apply(geo, args);
    };
  }, refus);
}

const appelsGeolocalisation = (page: Page) => page.evaluate(() => window.__geoAppels);

async function ouvrirLApp(page: Page): Promise<void> {
  await page.clock.setFixedTime(MAINTENANT);
  await page.route('https://hubeau.eaufrance.fr/**', (route) => {
    if (!route.request().url().includes('/temperature/chronique')) return route.abort();
    return route.fulfill({
      json: {
        data: [
          {
            code_station: '04101000',
            libelle_station: 'La Maine à Angers',
            longitude: -0.5,
            latitude: 47.5,
            date_mesure_temp: MAINTENANT.toISOString().slice(0, 10),
            heure_mesure_temp: '06:00:00',
            resultat: 11.5,
          },
        ],
      },
    });
  });
  await page.route(/open-meteo\.com/, (route) => route.abort());
  await page.goto('/');
}

const titre = (page: Page, nom: string) => page.getByRole('heading', { name: nom, exact: true });
const suivant = (page: Page) => page.getByRole('button', { name: 'Suivant', exact: true });

async function versPage2(page: Page): Promise<void> {
  await expect(titre(page, 'Leurio, ton conseil de pêche au leurre')).toBeVisible();
  await suivant(page).click();
  await expect(titre(page, 'Tes espèces et ton niveau')).toBeVisible();
}

async function versPage3(page: Page, niveau: RegExp = /Débutant/): Promise<void> {
  await versPage2(page);
  await page.getByRole('radio', { name: niveau }).click();
  await suivant(page).click();
  await expect(titre(page, 'Pourquoi ta position ?')).toBeVisible();
}

test.describe('US 89 : onboarding', () => {
  test("critère 1 : given je lance l'app pour la première fois, when elle s'ouvre, then la page 1 explique ce que fait Leurio, propose « Suivant » et n'affiche pas la barre d'onglets", async ({ page }) => {
    await ouvrirLApp(page);

    await expect(titre(page, 'Leurio, ton conseil de pêche au leurre')).toBeVisible();
    await expect(page.getByText('quel leurre et quelle animation utiliser')).toBeVisible();
    await expect(suivant(page)).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /passer|retour/i })).toHaveCount(0);
  });

  test("critère 2 : given la page 1 est affichée, when je regarde le lien « cartedepeche.fr », then il ouvre https://www.cartedepeche.fr dans un nouvel onglet, sous la phrase « La carte de pêche est obligatoire. »", async ({ page, context }) => {
    await ouvrirLApp(page);
    const phrase = page.getByText('La carte de pêche est obligatoire.', { exact: true });
    const lien = page.getByRole('link', { name: 'cartedepeche.fr', exact: true });
    await expect(lien).toBeVisible();

    await expect(lien).toHaveAttribute('href', 'https://www.cartedepeche.fr');
    await expect(lien).toHaveAttribute('target', '_blank');
    const [boitePhrase, boiteLien] = [await phrase.boundingBox(), await lien.boundingBox()];
    expect(boiteLien!.y, 'le lien est sous la phrase').toBeGreaterThan(boitePhrase!.y);
    // Le site réel n'est jamais appelé : l'ouverture est interceptée.
    await context.route('https://www.cartedepeche.fr/**', (route) => route.fulfill({ body: '<title>cartedepeche</title>', contentType: 'text/html' }));
    const [nouvelOnglet] = await Promise.all([context.waitForEvent('page'), lien.click()]);
    expect(nouvelOnglet.url()).toContain('cartedepeche.fr');
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("critère 3 : given la page 2 est affichée, when je la regarde, then elle liste les 7 espèces du contenu à cocher et propose les niveaux « Débutant » et « Intermédiaire » sans en choisir un", async ({ page }) => {
    await ouvrirLApp(page);
    await versPage2(page);

    await expect(page.getByRole('checkbox')).toHaveCount(7);
    for (const nom of ['Brochet', 'Sandre', 'Perche', 'Black-bass', 'Chevesne', 'Aspe', 'Silure']) {
      await expect(page.getByRole('checkbox', { name: nom })).not.toBeChecked();
    }
    await expect(page.getByRole('radio')).toHaveCount(2);
    await expect(page.getByRole('radio', { name: /Débutant/ })).not.toBeChecked();
    await expect(page.getByRole('radio', { name: /Intermédiaire/ })).not.toBeChecked();
  });

  test("critère 4 : given la page 2 et aucun niveau choisi, when je touche « Suivant », then je reste sur la page 2 avec le message « Choisis ton niveau. »", async ({ page }) => {
    await ouvrirLApp(page);
    await versPage2(page);

    await suivant(page).click();

    await expect(titre(page, 'Tes espèces et ton niveau')).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Choisis ton niveau.' })).toBeVisible();
  });

  test("critère 7 : given les pages 1 et 2, when je les parcours, then aucune demande de localisation du téléphone n'apparaît avant la page 3, ni à l'arrivée sur la page 3", async ({ page }) => {
    await espionnerGeolocalisation(page);
    await ouvrirLApp(page);
    expect(await appelsGeolocalisation(page), 'page 1').toBe(0);

    await versPage2(page);
    expect(await appelsGeolocalisation(page), 'page 2').toBe(0);
    await page.getByRole('radio', { name: /Débutant/ }).click();
    await suivant(page).click();
    await expect(titre(page, 'Pourquoi ta position ?')).toBeVisible();

    expect(await appelsGeolocalisation(page), 'page 3, avant de toucher « Autoriser la localisation »').toBe(0);
  });

  test("critère 5 : given la page 3 et la demande du téléphone acceptée, when je touche « Autoriser la localisation », then j'arrive sur l'écran « Conseil » avec le conseil de ma position", async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 47.47, longitude: -0.55 });
    await espionnerGeolocalisation(page);
    await ouvrirLApp(page);
    await versPage3(page);

    await page.getByRole('button', { name: 'Autoriser la localisation', exact: true }).click();

    await expect(page).toHaveURL(/\/conseil$/);
    await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Conseil');
    await expect(page.getByRole('heading', { name: 'Conditions', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ton top 3' })).toBeVisible();
    expect(await appelsGeolocalisation(page)).toBeGreaterThan(0);
  });

  test("critère 6 : given la page 3, when je touche « Plus tard », then j'arrive sur l'écran « Conseil » qui propose de choisir un spot enregistré, sans demande de localisation", async ({ page }) => {
    await espionnerGeolocalisation(page);
    await ouvrirLApp(page);
    await versPage3(page);

    await page.getByRole('button', { name: 'Plus tard', exact: true }).click();

    await expect(page).toHaveURL(/\/conseil$/);
    await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Conseil');
    await expect(page.getByText('Localisation indisponible : active la localisation ou choisis un spot enregistré.')).toBeVisible();
    expect(await appelsGeolocalisation(page)).toBe(0);
  });

  test("critère 6 : given la page 3 et la demande du téléphone refusée, when je touche « Autoriser la localisation », then j'arrive quand même sur l'écran « Conseil » qui propose de choisir un spot enregistré", async ({ page }) => {
    await espionnerGeolocalisation(page, true);
    await ouvrirLApp(page);
    await versPage3(page);

    await page.getByRole('button', { name: 'Autoriser la localisation', exact: true }).click();

    await expect(page).toHaveURL(/\/conseil$/);
    await expect(page.getByText('Localisation indisponible : active la localisation ou choisis un spot enregistré.')).toBeVisible();
    expect(await appelsGeolocalisation(page)).toBeGreaterThan(0);
  });

  test("critère 8 : given j'ai terminé l'onboarding, when je relance l'app, then l'écran « Conseil » s'affiche directement, sans onboarding", async ({ page }) => {
    await espionnerGeolocalisation(page);
    await ouvrirLApp(page);
    await versPage3(page, /Intermédiaire/);
    await page.getByRole('button', { name: 'Plus tard', exact: true }).click();
    await expect(page).toHaveURL(/\/conseil$/);
    expect(await page.evaluate((cle) => localStorage.getItem(cle), CLE_ONBOARDING)).toContain('intermediaire');

    await page.goto('/');

    await expect(page.locator('ion-toolbar ion-title:visible')).toHaveText('Conseil');
    await expect(page).toHaveURL(/\/conseil$/);
    await expect(titre(page, 'Leurio, ton conseil de pêche au leurre')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Conseil', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  test("critère 1 : given l'onboarding quitté après la page 2, when je relance l'app, then il recommence à la page 1", async ({ page }) => {
    await ouvrirLApp(page);
    await versPage2(page);
    await page.getByRole('radio', { name: /Débutant/ }).click();

    await page.goto('/');

    await expect(titre(page, 'Leurio, ton conseil de pêche au leurre')).toBeVisible();
  });

  test("critère 10 : given une page d'onboarding affichée sur un téléphone, when on mesure ses boutons, then chaque bouton mesure au moins 48 × 48 px", async ({ page }) => {
    await ouvrirLApp(page);
    const cibles = page.locator('button:visible, a:visible, ion-button:visible, [role="button"]:visible, [role="checkbox"]:visible, [role="radio"]:visible');
    const verifier = async (nomPage: string, minimum: number) => {
      const nombre = await cibles.count();
      expect(nombre, `cibles de ${nomPage}`).toBeGreaterThanOrEqual(minimum);
      for (let i = 0; i < nombre; i++) {
        const cible = cibles.nth(i);
        await cible.scrollIntoViewIfNeeded();
        const boite = await cible.boundingBox();
        const nom = ((await cible.textContent()) ?? '').trim() || (await cible.getAttribute('aria-label')) || `cible ${i}`;
        expect(boite!.height, `hauteur de « ${nom} » (${nomPage})`).toBeGreaterThanOrEqual(48);
        expect(boite!.width, `largeur de « ${nom} » (${nomPage})`).toBeGreaterThanOrEqual(48);
      }
    };

    await expect(titre(page, 'Leurio, ton conseil de pêche au leurre')).toBeVisible();
    await verifier('page 1', 2); // « Suivant » et le lien cartedepeche.fr
    await suivant(page).click();
    await expect(titre(page, 'Tes espèces et ton niveau')).toBeVisible();
    await verifier('page 2', 10); // 7 espèces, 2 niveaux et « Suivant »
    await page.getByRole('radio', { name: /Débutant/ }).click();
    await suivant(page).click();
    await expect(titre(page, 'Pourquoi ta position ?')).toBeVisible();
    await verifier('page 3', 2); // « Autoriser la localisation » et « Plus tard »
  });
});
