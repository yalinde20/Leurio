// US 90 : le compte anonyme est créé en silence à la fin de l'onboarding (PLAN §3, §4, §7), sur les émulateurs.
// Pas de fixture onboardingTermine : on passe par le vrai onboarding, en touchant « Plus tard » (pas de géolocalisation).
// Contrat observable : window.leurioFirebase.auth.currentUser (anonyme) et le document users/{uid} sur l'émulateur Firestore.
import { test, expect, type Page } from '@playwright/test';
import { EMULATEURS, PROJET, attendreFirebase, lireSurEmulateur, estLocal } from './firebase-helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */

test.use({ viewport: { width: 390, height: 844 } });

/** Aucun service réel : tout ce qui n'est pas local est coupé (Hub'Eau, Open-Meteo…). */
async function couperLeReel(page: Page): Promise<void> {
  await page.route((url) => !estLocal(url.toString()), (route) => route.abort());
}

/** Passe le vrai onboarding : « Intermédiaire » et deux espèces, puis « Plus tard ». */
async function terminerOnboarding(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Suivant', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Brochet' }).click();
  await page.getByRole('checkbox', { name: 'Sandre' }).click();
  await page.getByRole('radio', { name: /Intermédiaire/ }).click();
  await page.getByRole('button', { name: 'Suivant', exact: true }).click();
  await page.getByRole('button', { name: 'Plus tard', exact: true }).click();
  await expect(page).toHaveURL(/\/conseil$/);
}

async function aucunMessage(page: Page): Promise<void> {
  await expect(page.locator('ion-toast, ion-alert, ion-modal, [role="dialog"], [role="alertdialog"]')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
}

const uidAnonyme = (page: Page) =>
  page.evaluate(() => {
    const u = (window as any).leurioFirebase?.auth?.currentUser;
    return u && u.isAnonymous ? (u.uid as string) : null;
  });

async function attendreUid(page: Page): Promise<string> {
  await attendreFirebase(page);
  await expect.poll(() => uidAnonyme(page), { timeout: 20_000 }).not.toBeNull();
  return (await uidAnonyme(page))!;
}

/** Lit users/{uid} sur l'émulateur jusqu'à ce qu'il existe. */
async function attendreProfil(uid: string): Promise<Record<string, any>> {
  await expect.poll(async () => (await lireSurEmulateur(uid)).status, { timeout: 20_000 }).toBe(200);
  return (await lireSurEmulateur(uid)).body.fields as Record<string, any>;
}

const motif = (ports: number[]) => (url: URL) => ['127.0.0.1', 'localhost'].includes(url.hostname) && ports.includes(Number(url.port));

test.describe('US 90 : compte anonyme en silence', () => {
  test("critère 1 : given j'ai du réseau, when je termine l'onboarding, then j'arrive sur « Conseil » sans écran ni message, un compte anonyme est créé et users/{uid} contient niveau, especesFavorites, consentements et createdAt", async ({ page }) => {
    await couperLeReel(page);
    await terminerOnboarding(page);
    await aucunMessage(page);

    const uid = await attendreUid(page);
    const champs = await attendreProfil(uid);
    for (const nom of ['niveau', 'especesFavorites', 'consentements', 'createdAt']) {
      expect(Object.keys(champs), `champ ${nom}`).toContain(nom);
    }
    await expect(page).toHaveURL(/\/conseil$/);
    await aucunMessage(page);
  });

  test("critère 2 : given le compte anonyme est créé, when on lit users/{uid}, then niveau et especesFavorites sont ceux de la page 2 et les consentements analytics est faux et video null (jamais répondu)", async ({ page }) => {
    await couperLeReel(page);
    await terminerOnboarding(page);

    const champs = await attendreProfil(await attendreUid(page));

    expect(champs['niveau']).toEqual({ stringValue: 'intermediaire' });
    const especes = (champs['especesFavorites'].arrayValue.values as { stringValue: string }[]).map((v) => v.stringValue);
    expect([...especes].sort()).toEqual(['BRO', 'SAN']);
    expect(champs['consentements'].mapValue.fields).toEqual({ analytics: { booleanValue: false }, video: { nullValue: null } });
    expect(Number(champs['createdAt'].integerValue ?? champs['createdAt'].doubleValue)).toBeGreaterThan(1_700_000_000_000);
    expect(champs['plan']).toEqual({ stringValue: 'free' });
  });

  test("critère 3 : given je n'ai pas de réseau, when je termine l'onboarding, then j'arrive sur « Conseil » et, au retour du réseau, le compte et users/{uid} sont créés", async ({ page }) => {
    test.setTimeout(90_000);
    // Les émulateurs sont sur localhost : on coupe le réseau en abandonnant les requêtes vers leurs ports (Auth, Firestore),
    // ce qui ne dépend pas du comportement de context.setOffline envers localhost. Au retour : on retire la coupure
    // et on émet l'événement `online`, comme le fait le navigateur.
    const coupure = motif([EMULATEURS.auth, EMULATEURS.firestore]);
    await couperLeReel(page);
    await page.route(coupure, (route) => route.abort('internetdisconnected'));

    await terminerOnboarding(page);
    await aucunMessage(page);
    expect(await uidAnonyme(page), 'aucun compte hors ligne').toBeNull();

    await page.unroute(coupure);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    const uid = await attendreUid(page);
    const champs = await attendreProfil(uid);
    expect(champs['niveau']).toEqual({ stringValue: 'intermediaire' });
    await expect(page).toHaveURL(/\/conseil$/);
  });

  test("critère 4 : given la création du compte échoue, when je termine l'onboarding, then j'arrive sur « Conseil » sans message bloquant", async ({ page }) => {
    await couperLeReel(page);
    const tentatives: string[] = [];
    await page.route('**/accounts:signUp**', (route) => {
      tentatives.push(route.request().url());
      return route.abort();
    });

    await terminerOnboarding(page);
    // La création a bien été tentée (puis a échoué), sans rien montrer.
    await expect.poll(() => tentatives.length, { timeout: 20_000 }).toBeGreaterThan(0);

    await expect(page.getByRole('heading', { name: /conseil/i }).first().or(page.getByRole('tab', { name: /conseil/i }))).toBeVisible();
    await aucunMessage(page);
    expect(await uidAnonyme(page)).toBeNull();
  });

  test("critère 5 : given un compte anonyme existe déjà, when je relance l'app, then le même uid est utilisé et aucun nouveau compte n'est créé", async ({ page }) => {
    await couperLeReel(page);
    const inscriptions: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('accounts:signUp')) inscriptions.push(r.url());
    });
    await terminerOnboarding(page);
    const uid = await attendreUid(page);
    await attendreProfil(uid);

    await page.reload();
    await attendreFirebase(page);
    await page.waitForTimeout(1500); // laisse le lancement tenter, à tort, de créer un compte
    await expect(page).toHaveURL(/\/conseil$/);

    expect(await uidAnonyme(page)).toBe(uid);
    expect(inscriptions, 'une seule inscription sur les deux lancements').toHaveLength(1);
    // Liste des comptes de l'émulateur Auth (API d'administration, jeton « owner » propre à l'émulateur).
    const comptes = await (
      await fetch(`http://127.0.0.1:${EMULATEURS.auth}/identitytoolkit.googleapis.com/v1/projects/${PROJET}/accounts:query`, {
        method: 'POST',
        headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).json();
    const memeUid = (comptes.userInfo as { localId: string }[]).filter((u) => u.localId === uid);
    expect(memeUid).toHaveLength(1);
  });
});
