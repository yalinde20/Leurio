// Aides communes aux tests e2e Firebase (US 36). Le contrat observable côté page est
// `window.leurioFirebase`, défini seulement quand l'app tourne sur les émulateurs.
import { expect, type Page } from '@playwright/test';

export const PROJET = 'demo-leurio';
export const EMULATEURS = { auth: 9099, firestore: 8080, storage: 9199 } as const;

export const profil = {
  niveau: 'debutant',
  especesFavorites: ['SAN', 'BRO'],
  consentements: { analytics: false, video: false },
  createdAt: 1700000000000,
  plan: 'free',
};

/** Hôtes locaux : tout le reste est un service réel (Google, Firebase, reCAPTCHA, gstatic…). */
export function estLocal(url: string): boolean {
  const u = new URL(url);
  if (!/^(https?|wss?):$/.test(u.protocol)) return true; // data:, blob:, about:
  return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
}

/** Enregistre toutes les requêtes de la page (y compris celles qui échouent). */
export function enregistrerRequetes(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  return urls;
}

export async function attendreFirebase(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as { leurioFirebase?: unknown }).leurioFirebase, undefined, { timeout: 20_000 });
}

export function requetesVers(urls: string[], port: number): string[] {
  return urls.filter((u) => {
    const x = new URL(u);
    return ['127.0.0.1', 'localhost'].includes(x.hostname) && x.port === String(port);
  });
}

export function externes(urls: string[]): string[] {
  return urls.filter((u) => !estLocal(u));
}

/** Lit un document sur l'émulateur Firestore (REST, jeton « owner » = hors règles). */
export async function lireSurEmulateur(uid: string): Promise<{ status: number; body: { fields?: Record<string, unknown> } }> {
  const r = await fetch(`http://127.0.0.1:${EMULATEURS.firestore}/v1/projects/${PROJET}/databases/(default)/documents/users/${uid}`, {
    headers: { Authorization: 'Bearer owner' },
  });
  return { status: r.status, body: await r.json() };
}

export async function exigerAucuneRequeteExterne(urls: string[]): Promise<void> {
  expect(externes(urls), 'requêtes vers un service réel').toEqual([]);
}
