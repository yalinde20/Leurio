import { test, expect, type Page } from '@playwright/test';

// US 64, critère 7 : contraste des textes de la carte « Conditions » dans les deux thèmes (mesuré sur les styles calculés).
// Aucun service réel : la position est simulée, Hub'Eau répond par un faux relevé, Open-Meteo est coupé.

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

async function simulerServices(page: Page): Promise<void> {
  const maintenant = new Date();
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
            date_mesure_temp: maintenant.toISOString().slice(0, 10),
            heure_mesure_temp: '06:00:00',
            resultat: 11.5,
          },
        ],
      },
    });
  });
  await page.route(/open-meteo\.com/, (route) => route.abort());
}

/** Contraste WCAG de chaque texte de la carte avec le fond réellement peint derrière lui. */
function mesurerContrastes(page: Page) {
  return page.evaluate(() => {
    const titre = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, ion-card-title')].find((t) => t.textContent?.trim() === 'Conditions');
    const carte = titre?.closest('section, article, ion-card');
    if (!carte) return null;

    const lire = (css: string): [number, number, number, number] => {
      const m = css.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return [m[0], m[1], m[2], m[3] ?? 1];
    };
    const luminance = ([r, g, b]: number[]) => {
      const [R, G, B] = [r, g, b].map((c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    };
    const fondDe = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const c = lire(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) return c;
      }
      return lire(getComputedStyle(document.body).backgroundColor);
    };

    const mesures: { texte: string; contraste: number }[] = [];
    for (const el of [carte, ...carte.querySelectorAll('*')]) {
      const texte = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent?.trim() ?? '').join(' ').trim();
      if (!texte) continue;
      const [l1, l2] = [luminance(lire(getComputedStyle(el).color)), luminance(fondDe(el))].sort((a, b) => b - a);
      mesures.push({ texte, contraste: (l1 + 0.05) / (l2 + 0.05) });
    }
    return mesures;
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`critère 7 : given le thème ${theme === 'light' ? 'clair' : 'sombre'}, when la carte « Conditions » s'affiche, then chaque texte a un contraste d'au moins 4,5:1 avec son fond`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await simulerServices(page);
    await page.goto('/');
    await expect(page.getByText('Station Hub\'Eau La Maine à Angers')).toBeVisible();

    const mesures = await mesurerContrastes(page);
    expect(mesures, 'aucune carte titrée « Conditions »').not.toBeNull();
    expect(mesures!.length).toBeGreaterThan(5);
    for (const { texte, contraste } of mesures!) {
      expect(contraste, `« ${texte} » : contraste ${contraste.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
}
