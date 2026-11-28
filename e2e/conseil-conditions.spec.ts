import { test, expect, type Page } from '@playwright/test';
import { conseilAffiche, ouvrirConditions, riviere } from './conseil-helpers';
import { onboardingTermine } from './onboarding-helpers';

// US 89 : l'onboarding est terminé, l'app s'ouvre sur le Conseil (fixture, aucune assertion changée).
test.beforeEach(async ({ page }) => onboardingTermine(page));

// US 64, critère 7 : contraste des textes des conditions dans les deux thèmes (mesuré sur les styles calculés).
// US 295 : les conditions sont la ligne de l'eau de l'écran et la feuille « Conditions » ouverte par la ligne météo.
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
    const feuille = document.querySelector('[role="dialog"][aria-label="Conditions"]');
    const eau = document.querySelector('.eau');
    if (!feuille || !eau) return null;

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
    for (const el of [feuille, ...feuille.querySelectorAll('*'), eau, ...eau.querySelectorAll('*')]) {
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
    await ouvrirConditions(page);

    const mesures = await mesurerContrastes(page);
    expect(mesures, 'ni feuille « Conditions », ni ligne de l\'eau').not.toBeNull();
    expect(mesures!.length).toBeGreaterThan(5);
    for (const { texte, contraste } of mesures!) {
      expect(contraste, `« ${texte} » : contraste ${contraste.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

// US 65 : Open-Meteo est coupé et le cache est vide au premier chargement, donc les conditions sont « moins précis » :
// le badge « Moins précis » s'affiche et son contraste est mesuré avec celui des autres textes de la carte.
for (const theme of ['light', 'dark'] as const) {
  test(`US 65 critère 2 : given le thème ${theme === 'light' ? 'clair' : 'sombre'} et la météo en panne sans cache, when la carte « Conditions » s'affiche, then le badge « Moins précis » est visible avec un contraste d'au moins 4,5:1`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await simulerServices(page);
    await page.goto('/');
    await ouvrirConditions(page);
    await expect(page.getByText('Moins précis', { exact: true })).toBeVisible();

    const mesures = await mesurerContrastes(page);
    expect(mesures, 'ni feuille « Conditions », ni ligne de l\'eau').not.toBeNull();
    const badge = mesures!.find((m) => m.texte === 'Moins précis');
    expect(badge, 'le texte « Moins précis » est absent de la carte').toBeDefined();
    expect(badge!.contraste, `« Moins précis » : contraste ${badge!.contraste.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
}

// US 295 : l'avis « Ce conseil t'a aidé ? » et « Merci pour ton retour ! » sont posés sur le fond d'une zone de la rivière (Surface, Mi-eau
// ou Fond selon le leurre) : leur texte doit avoir au moins 4,5:1 sur chacun des trois fonds, dans les deux thèmes.
for (const theme of ['light', 'dark'] as const) {
  test(`US 295 : given le thème ${theme === 'light' ? 'clair' : 'sombre'}, when l'avis puis « Merci pour ton retour ! » s'affichent, then leur texte a un contraste d'au moins 4,5:1 sur chaque zone de la rivière`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
    await simulerServices(page);
    await page.goto('/');
    await conseilAffiche(page);

    const mesurer = () =>
      page.evaluate(() => {
        const lire = (css: string): number[] => (css.match(/[\d.]+/g) ?? []).map(Number);
        const luminance = ([r, g, b]: number[]) => {
          const [R, G, B] = [r, g, b].map((c) => {
            const v = c / 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * R + 0.7152 * G + 0.0722 * B;
        };
        const ratio = (a: number[], b: number[]) => {
          const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
          return (l1 + 0.05) / (l2 + 0.05);
        };
        // Les trois fonds : on lit la valeur de chaque token dans un élément témoin.
        const fond = (token: string) => {
          const t = document.createElement('div');
          t.style.backgroundColor = `var(${token})`;
          document.body.appendChild(t);
          const c = lire(getComputedStyle(t).backgroundColor);
          t.remove();
          return c;
        };
        const fonds = ['--lr-eau-surface', '--lr-eau-mi', '--lr-eau-fond'].map((t) => [t, fond(t)] as const);
        const avis = document.querySelector('app-riviere-en-coupe app-avis-coup');
        const resultats: { texte: string; fond: string; contraste: number }[] = [];
        for (const el of avis ? [avis, ...avis.querySelectorAll('*')] : []) {
          const texte = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent?.trim() ?? '').join(' ').trim();
          if (!texte) continue;
          for (const [token, couleur] of fonds) resultats.push({ texte, fond: token, contraste: ratio(lire(getComputedStyle(el).color), couleur) });
        }
        return resultats;
      });

    const avant = await mesurer();
    expect(avant.some((m) => m.texte.startsWith('Ce conseil')), 'la question de l\'avis est lue').toBe(true);
    await riviere(page).getByRole('button', { name: "Oui, ce conseil m'a aidé" }).click();
    await expect(riviere(page).getByText('Merci pour ton retour !')).toBeVisible();
    const apres = await mesurer();
    expect(apres.some((m) => m.texte === 'Merci pour ton retour !'), '« Merci » est lu').toBe(true);

    for (const { texte, fond, contraste } of [...avant, ...apres]) {
      expect(contraste, `« ${texte} » sur ${fond} : ${contraste.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

// US 295 (maquette, section 6) : sous les heures légales, la feuille « Conditions » porte la mention et le lien de la fédération (PLAN §6).
test('US 295 B4 : given la feuille « Conditions », when elle s\'ouvre, then « à vérifier dans l\'arrêté de ton département » et le lien de la fédération (48 px) sont sous les heures légales', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
  await simulerServices(page);
  await page.goto('/');
  await conseilAffiche(page);

  const feuille = await ouvrirConditions(page);

  await expect(feuille).toContainText(/Heures légales[\s\S]*à vérifier dans l'arrêté de ton département/i);
  const lien = feuille.getByRole('link', { name: /Fédération.*↗/ });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute('href', /^https:\/\//);
  expect((await lien.boundingBox())!.height).toBeGreaterThanOrEqual(48);
});
