// US 3 : onglet « Spots », carte et liste de mes spots, sur les émulateurs (PLAN §2.4, §3, §4, §7).
// Contrat du DOM : voir src/app/features/spots/spots.page.carte.spec.ts (région « Carte des spots », `.leaflet-marker-icon`,
// `.leaflet-control-zoom a`, `ul li button`, attributs data-centre-lat / data-centre-lng / data-zoom).
// Aucun service réel : les tuiles OpenStreetMap et tout hôte non local sont coupés (la carte reste utilisable sans tuiles).
import { test, expect, type Page } from '@playwright/test';
import { lireThemes } from './tokens';
import { attendreFirebase, estLocal } from './firebase-helpers';
import { onboardingTermine } from './onboarding-helpers';

test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => onboardingTermine(page));

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

interface FenetreFirebase {
  leurioFirebase: {
    auth: { currentUser: { uid: string } | null };
    db: unknown;
    sdk: { firestore: { doc: (...a: unknown[]) => unknown; setDoc: (...a: unknown[]) => Promise<void>; waitForPendingWrites: (db: unknown) => Promise<void> } };
  };
}

const SPOTS = {
  etang: { nom: 'Étang du moulin', lat: 47.5, lng: -0.9, categorie: 2, milieu: 'lac', departement: '49', prive: true },
  sevre: { nom: 'La Sèvre à Clisson', lat: 47.09, lng: -1.28, categorie: 1, milieu: 'riviere', departement: '44', prive: true },
};

/** Écrit des spots dans `users/{uid}/spots` du compte anonyme de l'app, puis ouvre l'onglet « Spots ». */
async function ouvrirSpots(page: Page, spots: Record<string, unknown>): Promise<void> {
  const tuilesDemandees: string[] = [];
  await page.route(
    (url) => !estLocal(url.toString()),
    (route) => {
      tuilesDemandees.push(route.request().url());
      return route.abort();
    },
  );
  await page.goto('/');
  await attendreFirebase(page);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as FenetreFirebase).leurioFirebase.auth.currentUser?.uid ?? null), { timeout: 20_000 })
    .not.toBeNull();
  await page.evaluate(async (docs) => {
    const f = (window as unknown as FenetreFirebase).leurioFirebase;
    const { doc, setDoc, waitForPendingWrites } = f.sdk.firestore;
    const uid = f.auth.currentUser.uid;
    for (const [id, data] of Object.entries(docs)) await setDoc(doc(f.db, 'users', uid, 'spots', id), data);
    await waitForPendingWrites(f.db);
  }, spots);
  await page.getByRole('tab', { name: 'Spots', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Carte des spots' })).toBeVisible();
}

const marqueur = (page: Page) => page.locator('.leaflet-marker-icon').first();
const ligne = (page: Page) => page.locator('ul li button').first();

/** Toutes les couleurs que le navigateur applique à un élément et à ses descendants. */
const couleursDe = (page: Page, selecteur: string) =>
  page.locator(selecteur).first().evaluate((el) => {
    const out: string[] = [];
    for (const e of [el, ...el.querySelectorAll('*')]) {
      const s = getComputedStyle(e);
      out.push(s.backgroundColor, s.color, s.fill, s.stroke, s.borderTopColor);
    }
    return out;
  });
const fond = (page: Page, sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundColor);
const encre = (page: Page, sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).color);

for (const theme of ['clair', 'sombre'] as const) {
  test(`critère 6 : given le téléphone en thème ${theme}, when l'utilisateur ouvre l'onglet « Spots », then les marqueurs, les contrôles de la carte et la liste prennent les couleurs du thème actif`, async ({ page }) => {
    const t = lireThemes()[theme];
    await page.emulateMedia({ colorScheme: theme === 'clair' ? 'light' : 'dark' });
    await ouvrirSpots(page, SPOTS);
    await expect(marqueur(page)).toBeVisible();
    await expect(ligne(page)).toBeVisible();

    expect(await couleursDe(page, '.leaflet-marker-icon')).toContain(rgb(t['--lr-carte-marqueur']));
    expect(await fond(page, '.leaflet-control-zoom a')).toBe(rgb(t['--lr-surface']));
    expect(await encre(page, '.leaflet-control-zoom a')).toBe(rgb(t['--lr-texte']));
    expect(await encre(page, 'ul li button')).toBe(rgb(t['--lr-texte']));
    const surfaceListe = await page.locator('ul').first().evaluate((ul) => {
      for (let e: Element | null = ul; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
      }
      return '';
    });
    expect(surfaceListe).toBe(rgb(t['--lr-surface']));
  });
}

test('critère 6 : given l\'onglet « Spots » ouvert en thème clair, when le téléphone passe en mode sombre, then les couleurs de la carte et de la liste suivent sans recharger', async ({ page }) => {
  const { clair, sombre } = lireThemes();
  await page.emulateMedia({ colorScheme: 'light' });
  await ouvrirSpots(page, SPOTS);
  await expect.poll(() => fond(page, '.leaflet-control-zoom a')).toBe(rgb(clair['--lr-surface']));

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => fond(page, '.leaflet-control-zoom a')).toBe(rgb(sombre['--lr-surface']));
  expect(await couleursDe(page, '.leaflet-marker-icon')).toContain(rgb(sombre['--lr-carte-marqueur']));
});

test('critère 6 : given les contrôles de la carte, when on les mesure, then les boutons de zoom et les lignes de la liste font au moins 48 px', async ({ page }) => {
  await ouvrirSpots(page, SPOTS);
  await expect(page.locator('ul li button').first()).toBeVisible();
  for (const sel of ['.leaflet-control-zoom a', 'ul li button']) {
    const boites = await page.locator(sel).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
    expect(boites.length).toBeGreaterThan(0);
    for (const b of boites) {
      expect(b.height).toBeGreaterThanOrEqual(48);
      expect(b.width).toBeGreaterThanOrEqual(48);
    }
  }
});

test('critère 1 : given deux spots enregistrés, when il ouvre l\'onglet « Spots », then la carte demande des tuiles OpenStreetMap, montre un marqueur par spot et la liste les nomme', async ({ page }) => {
  const tuiles: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('openstreetmap.org')) tuiles.push(r.url());
  });
  await ouvrirSpots(page, SPOTS);

  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
  await expect(page.locator('ul li button')).toHaveText([/Étang du moulin\s*2e catégorie · Lac · Maine-et-Loire \(49\)/, /La Sèvre à Clisson\s*1re catégorie · Rivière · Loire-Atlantique \(44\)/]);
  await expect(page.locator('.leaflet-control-attribution')).toContainText('© contributeurs OpenStreetMap');
  await expect.poll(() => tuiles.length).toBeGreaterThan(0);
  expect(tuiles.every((u) => /^https:\/\/([abc]\.)?tile\.openstreetmap\.org\//.test(u))).toBe(true);
});

test('critère 3 : given l\'onglet « Spots » ouvert, when on touche « La Sèvre à Clisson », then la carte se centre sur son marqueur', async ({ page }) => {
  await ouvrirSpots(page, SPOTS);
  await page.locator('ul li button', { hasText: 'La Sèvre à Clisson' }).click();

  const region = page.getByRole('region', { name: 'Carte des spots' });
  await expect.poll(async () => Number(await region.getAttribute('data-centre-lat'))).toBeCloseTo(47.09, 3);
  await expect.poll(async () => Number(await region.getAttribute('data-centre-lng'))).toBeCloseTo(-1.28, 3);
  // Le marqueur est bien au centre de la carte affichée.
  await expect
    .poll(async () => {
      const c = await region.boundingBox();
      const m = await page.locator('.leaflet-marker-icon[title="La Sèvre à Clisson"]').boundingBox();
      if (!c || !m) return Infinity;
      return Math.abs(m.x + m.width / 2 - (c.x + c.width / 2));
    })
    .toBeLessThan(30);
});
