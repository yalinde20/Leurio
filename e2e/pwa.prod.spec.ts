import { test, expect, type APIResponse } from '@playwright/test';

function taillePng(octets: Buffer): { largeur: number; hauteur: number } {
  const signature = octets.subarray(0, 8).toString('hex');
  expect(signature).toBe('89504e470d0a1a0a');
  return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
}

async function pngDe(reponse: APIResponse) {
  expect(reponse.ok()).toBe(true);
  return taillePng(await reponse.body());
}

test('critère 0 : given le build de production servi en local, when on charge la page, then elle référence un manifeste web « Leurio », fr, standalone, avec des icônes 192 et 512 px', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1, { timeout: 5000 });
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const url = new URL(href as string, page.url()).toString();
  const reponse = await request.get(url);
  expect(reponse.ok()).toBe(true);
  const manifeste = await reponse.json();

  expect(manifeste.name).toBe('Leurio');
  expect(manifeste.lang).toBe('fr');
  expect(manifeste.display).toBe('standalone');

  for (const taille of [192, 512]) {
    const icone = (manifeste.icons ?? []).find(
      (i: { sizes?: string; type?: string }) => i.sizes === `${taille}x${taille}` && (i.type ?? 'image/png') === 'image/png',
    );
    expect(icone, `icône ${taille}x${taille} déclarée`).toBeTruthy();
    const png = await pngDe(await request.get(new URL(icone.src, url).toString()));
    expect(png).toEqual({ largeur: taille, hauteur: taille });
  }
});

test('critère 0 : given le build de production servi en local, when on charge la page, then elle porte les balises iOS (apple-touch-icon 180 px, mode app, titre, theme-color clair et sombre)', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1, { timeout: 5000 });
  const href = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute('href');
  expect(href).toBeTruthy();
  const png = await pngDe(await request.get(new URL(href as string, page.url()).toString()));
  expect(png).toEqual({ largeur: 180, hauteur: 180 });

  const capable = await page
    .locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('content')));
  expect(capable).toContain('yes');

  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Leurio');

  await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')).toHaveCount(1);
});

test('critère 1 : given le build de production servi en local, when on charge la page puis on attend la fin du chargement, then un service worker est enregistré et actif', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('ion-toolbar ion-title')).toHaveText('Leurio');

  const etat = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const prete = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((r) => setTimeout(() => r(null), 25_000)),
    ]);
    if (!prete) return null;
    const regs = await navigator.serviceWorker.getRegistrations();
    return { nombre: regs.length, actif: prete.active?.state ?? null };
  });
  expect(etat).not.toBeNull();
  expect(etat?.nombre).toBeGreaterThan(0);
  expect(etat?.actif).toBe('activated');
});

test('critère 2 : given le build de production chargé une première fois, when on recharge la page sans réseau, then l\'app s\'affiche quand même', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('ion-toolbar ion-title')).toHaveText('Leurio');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 25_000))]);
  });
  // Un rechargement en ligne pour que le service worker contrôle la page et remplisse son cache.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(3000);

  await context.setOffline(true);
  await page.reload();

  await expect(page.locator('ion-toolbar ion-title')).toHaveText('Leurio');
  await expect(page.locator('ion-content')).toBeVisible();
});

test('critère 3 : given le build de production, when on lance l\'audit d\'installabilité (celui de Lighthouse, via Chrome), then il indique une app installable avec un service worker actif', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('ion-toolbar ion-title')).toHaveText('Leurio');

  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const prete = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((r) => setTimeout(() => r(null), 25_000)),
    ]);
    return prete ? (prete.active?.state ?? null) : null;
  });
  expect(sw).toBe('activated');

  // Chrome applique ici les mêmes critères d'installabilité que l'audit Lighthouse.
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});
