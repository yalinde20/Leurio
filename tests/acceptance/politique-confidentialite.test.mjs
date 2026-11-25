// US 23 : publier la politique de confidentialité en ligne (PLAN §2.5, §4, §7, §10 phase 7).
// Critères 1 à 3 : la page publique est un fichier HTML statique (public/confidentialite.html) servi à leurio.app/confidentialite.
// Maquette : docs/maquettes/us-23-politique-confidentialite.html. Aucun réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';

const lire = (rel) => {
  const f = join(ROOT, rel);
  if (!existsSync(f)) throw new Error(`${rel} est absent`);
  return readFileSync(f, 'utf8');
};
const PAGE = 'public/confidentialite.html';
const sansBalises = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const RUBRIQUES = ['Données collectées', 'Services utilisés (Firebase)', 'Consentements', 'Suppression du compte', 'Export de tes données'];

/** Le texte de la rubrique <h2>nom</h2> jusqu'au prochain <h2>. */
function rubrique(html, nom) {
  const m = new RegExp(`<h2[^>]*>\\s*${nom.replace(/[()]/g, '\\$&')}\\s*</h2>([\\s\\S]*?)(?=<h2|$)`, 'i').exec(html);
  assert.ok(m, `rubrique « ${nom} » absente`);
  return sansBalises(m[1]);
}

test('critère 1 : given un visiteur sans l\'app, when il ouvre la page de la politique, then il lit un document autonome en français titré « Politique de confidentialité » avec les 5 rubriques et un sommaire', () => {
  const html = lire(PAGE);
  assert.match(html, /<html[^>]*lang="fr"/i);
  assert.match(html, /<title>[^<]*Politique de confidentialité[^<]*<\/title>/i);
  assert.match(html, /<h1[^>]*>\s*Politique de confidentialité\s*<\/h1>/i);
  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => sansBalises(m[1]).trim());
  for (const nom of RUBRIQUES) assert.ok(h2.includes(nom), `h2 « ${nom} » absent (trouvés : ${h2.join(' | ')})`);
  // Sommaire : un lien d'ancre par rubrique, vers un id existant.
  for (const nom of RUBRIQUES) {
    const lien = [...html.matchAll(/<a[^>]*href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].find((m) => sansBalises(m[2]).trim() === nom);
    assert.ok(lien, `sommaire : lien vers « ${nom} » absent`);
    assert.match(html, new RegExp(`id="${lien[1]}"`), `ancre #${lien[1]} sans cible`);
  }
  // Page statique, sans script ni ressource externe ; thème clair et sombre par variables CSS.
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/i);
  assert.doesNotMatch(html, /<(img|iframe|source|video|audio)[^>]+src="https?:/i);
  assert.match(html, /prefers-color-scheme:\s*dark/i);
  assert.match(html, /--[a-z-]+\s*:/i);
});

test('critère 2 : given la rubrique « Données collectées », when le visiteur la lit, then elle cite les préférences, la boîte à leurres et ses photos, les spots, les retours 👍 / 👎 sans coordonnées exactes et les rapports de plantage', () => {
  const texte = rubrique(lire(PAGE), 'Données collectées').toLowerCase();
  for (const attendu of ['préférences', 'boîte à leurres', 'photos', 'spots', '👍 / 👎', 'sans coordonnées exactes', 'rapports de plantage']) {
    assert.ok(texte.includes(attendu), `« ${attendu} » absent de la rubrique « Données collectées »`);
  }
});

test('critère 3 : given la rubrique « Consentements », when le visiteur la lit, then elle explique qu\'Analytics et les lecteurs vidéo tiers ne se chargent qu\'après accord et comment changer ce choix dans « Compte »', () => {
  const texte = rubrique(lire(PAGE), 'Consentements');
  assert.match(texte, /Analytics/);
  assert.match(texte, /lecteurs vidéo tiers/i);
  assert.match(texte, /qu['’]après ton accord|qu['’]après accord/i);
  assert.match(texte, /Compte\s*[›>]\s*Consentements/);
});

test('critère 1 : given leurio.app/confidentialite, when Firebase Hosting la sert, then cleanUrls est activé et l\'URL propre n\'est pas réécrite vers l\'app', () => {
  const firebase = JSON.parse(lire('firebase.json'));
  assert.equal(firebase.hosting.cleanUrls, true);
});

test('critère 1 : given l\'app installée (service worker), when le visiteur ouvre /confidentialite, then ngsw-config exclut /confidentialite des navigationUrls (valeurs par défaut d\'Angular conservées)', () => {
  const ngsw = JSON.parse(lire('ngsw-config.json'));
  assert.ok(Array.isArray(ngsw.navigationUrls), 'navigationUrls absent');
  assert.ok(ngsw.navigationUrls.some((u) => /^!\/confidentialite/.test(u)), 'exclusion de /confidentialite absente');
  assert.ok(ngsw.navigationUrls.includes('/**'), '« /** » (défaut Angular) absent');
  assert.ok(ngsw.navigationUrls.includes('!/**/*.*'), '« !/**/*.* » (défaut Angular) absent');
  assert.ok(ngsw.navigationUrls.includes('!/**/*__*'), '« !/**/*__* » (défaut Angular) absent');
});
