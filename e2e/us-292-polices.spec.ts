// US 292 : tokens clair et sombre « jeu sérieux » et polices Barlow embarquées (PLAN §3).
// Maquette validée : docs/maquettes/us-292-tokens-et-polices.html. Aucun service réel : tout hôte non local est coupé.
import { test, expect, type Page } from '@playwright/test';
import { onboardingTermine } from './onboarding-helpers';
import { estLocal } from './firebase-helpers';

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 47.47, longitude: -0.55 },
  permissions: ['geolocation'],
});

const CLAIR: Record<string, string> = {
  '--lr-fond': '#eef3f1', '--lr-texte': '#0f1e22', '--lr-texte-secondaire': '#45585b', '--lr-trait': '#0f1e22',
  '--lr-primaire': '#a85309', '--lr-ok': '#1f7a55', '--lr-attention': '#8a4300',
};
const SOMBRE: Record<string, string> = {
  '--lr-fond': '#071318', '--lr-texte': '#e3efec', '--lr-texte-secondaire': '#93aaa7', '--lr-trait': '#cfe3e0',
  '--lr-primaire': '#f0a24b', '--lr-ok': '#5fd3a0', '--lr-attention': '#f0a24b',
};

const lireTokens = (page: Page, noms: string[]) =>
  page.evaluate((ns) => Object.fromEntries(ns.map((n) => [n, getComputedStyle(document.documentElement).getPropertyValue(n).trim().toLowerCase()])), noms);

for (const [nom, scheme, attendu] of [['clair', 'light', CLAIR], ['sombre', 'dark', SOMBRE]] as const) {
  test(`US 292 critère ${scheme === 'light' ? 0 : 1} : given l'app en thème ${nom}, when on lit les tokens de couleur sur la racine, then fond, texte, texte secondaire, trait, action, ouvert et attention valent les valeurs du thème ${nom}`, async ({ page }) => {
    await onboardingTermine(page);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.locator('ion-content')).toBeVisible();
    expect(await lireTokens(page, Object.keys(attendu))).toEqual(attendu);
  });

  test(`US 292 critère ${scheme === 'light' ? 0 : 1} : given le thème ${nom} forcé par le choix de l'utilisateur sur un téléphone de l'autre mode, when on lit les tokens, then ils valent les valeurs du thème ${nom}`, async ({ page }) => {
    await onboardingTermine(page);
    await page.emulateMedia({ colorScheme: scheme === 'light' ? 'dark' : 'light' });
    await page.addInitScript((v) => localStorage.setItem('leurio.theme', v), nom);
    await page.goto('/');
    await expect(page.locator('ion-content')).toBeVisible();
    expect(await lireTokens(page, Object.keys(attendu))).toEqual(attendu);
  });
}

test('US 292 critère 3 : given l\'app ouverte sans réseau, when on affiche l\'écran Conseil, then titres et chiffres sont en Barlow Condensed, le texte en Barlow, chargées depuis l\'app, sans requête vers un service de polices', async ({ page }) => {
  const externes: string[] = [];
  const polices: { url: string; status: number }[] = [];
  page.on('request', (r) => { if (!estLocal(r.url())) externes.push(r.url()); });
  page.on('response', (r) => { if (/\.woff2?(\?|$)/.test(r.url())) polices.push({ url: r.url(), status: r.status() }); });
  await onboardingTermine(page);
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Conseil', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('ion-title:visible')).toHaveText('Conseil');

  // Les tokens de police nomment les deux familles.
  const tokens = await lireTokens(page, ['--lr-police-texte', '--lr-police-titre']);
  expect(tokens['--lr-police-titre']).toContain('barlow condensed');
  expect(tokens['--lr-police-texte']).toMatch(/barlow/);
  expect(tokens['--lr-police-texte']).not.toContain('condensed');

  // Titres : barre de titre et titres de l'écran. Texte : le corps de l'écran.
  const famille = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontFamily.toLowerCase());
  expect(await famille('ion-title:visible')).toContain('barlow condensed');
  const titres = page.locator('ion-content:visible h1, ion-content:visible h2, ion-content:visible h3');
  await expect(titres.first()).toBeVisible();
  for (const f of await titres.evaluateAll((els) => els.map((el) => getComputedStyle(el).fontFamily.toLowerCase()))) expect(f).toContain('barlow condensed');
  const corps = await page.evaluate(() => getComputedStyle(document.body).fontFamily.toLowerCase());
  expect(corps).toMatch(/^"?barlow"?(,|$)/);
  expect(corps).not.toMatch(/^"?barlow condensed/);

  // Les polices sont réellement chargées, pas seulement déclarées.
  await page.evaluate(() => document.fonts.ready);
  const etat = await page.evaluate(() => {
    const faces = [...document.fonts].map((f) => ({ famille: f.family.replace(/["']/g, ''), statut: f.status }));
    return {
      faces,
      condensed: document.fonts.check('700 20px "Barlow Condensed"'),
      texte: document.fonts.check('500 16px "Barlow"'),
    };
  });
  const chargee = (nom: string) => etat.faces.some((f) => f.famille === nom && f.statut === 'loaded');
  expect(chargee('Barlow Condensed'), `faces : ${JSON.stringify(etat.faces)}`).toBe(true);
  expect(chargee('Barlow'), `faces : ${JSON.stringify(etat.faces)}`).toBe(true);
  expect(etat.condensed && etat.texte).toBe(true);
  expect(polices.length).toBeGreaterThan(0);
  expect(polices.every((p) => p.status === 200)).toBe(true);

  expect(externes.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
});

test('US 292 critère 3 : given l\'écran Conseil, when on lit la police des chiffres, then la température de l\'eau et les pastilles de rang sont en Barlow Condensed', async ({ page }) => {
  // Midi : dans les heures légales, sinon l'écran avertit au lieu de conseiller et n'a pas de pastille de rang.
  await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
  await onboardingTermine(page);
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('ion-title:visible')).toHaveText('Conseil');
  const famille = (loc: ReturnType<Page['locator']>) => loc.evaluateAll((els) => els.map((el) => getComputedStyle(el).fontFamily.toLowerCase()));
  const rangs = page.locator('ion-content:visible .rang');
  await expect(rangs.first()).toBeVisible();
  for (const f of await famille(rangs)) expect(f).toContain('barlow condensed');
  const eau = page.locator('ion-content:visible .eau dd');
  await expect(eau.first()).toBeVisible();
  for (const f of await famille(eau)) expect(f).toContain('barlow condensed');
});
