// US 24 : page d'accueil leurio.app (PLAN §10 phase 7, §1, §3).
// La page est un fichier HTML statique (public/accueil.html) servi à leurio.app/accueil ; l'app Angular reste à la racine.
// Les liens des stores vivent dans public/stores.json ; la page les lit au chargement.
// Maquette : docs/maquettes/us-24-page-d-accueil.html. Aucun réseau.
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
const PAGE = 'public/accueil.html';
const sansBalises = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#39;|&apos;|&rsquo;/g, "'").replace(/\s+/g, ' ');
const norm = (s) => s.replace(/’/g, "'");
const style = (html) => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
const script = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');

test('critère 1 : given un visiteur, when il ouvre la page d\'accueil, then la page présente Leurio en une phrase dans un document autonome en français', () => {
  const html = lire(PAGE);
  assert.match(html, /<html[^>]*lang="fr"/i);
  assert.match(html, /<title>[^<]*Leurio[^<]*<\/title>/i);
  assert.match(html, /<meta[^>]+name="viewport"/i);
  assert.ok(norm(sansBalises(html)).includes('Quel leurre, quelle animation, maintenant, ici ?'), 'accroche absente');
  assert.match(html, /<h1[^>]*>[\s\S]*Quel leurre, quelle animation, maintenant, ici ?[\s\S]*<\/h1>/i);
});

test('critère 1 : given un visiteur, when il lit la page, then elle liste les points clés : conseil du moment, fiche animation, boîte à leurres, spots, fonctionne hors ligne', () => {
  const texte = norm(sansBalises(lire(PAGE)));
  for (const attendu of ['Le conseil du moment', 'La fiche animation', 'Ta boîte à leurres', 'Tes spots', 'Fonctionne hors ligne']) {
    assert.ok(texte.includes(attendu), `point clé « ${attendu} » absent`);
  }
});

test('critère 1 : given leurio.app/accueil, when Firebase Hosting la sert, then cleanUrls est activé et ngsw-config exclut /accueil et /accueil/ des navigationUrls (valeurs par défaut conservées)', () => {
  assert.equal(JSON.parse(lire('firebase.json')).hosting.cleanUrls, true);
  const ngsw = JSON.parse(lire('ngsw-config.json'));
  assert.ok(ngsw.navigationUrls.includes('!/accueil'), '« !/accueil » absent');
  assert.ok(ngsw.navigationUrls.includes('!/accueil/'), '« !/accueil/ » absent');
  for (const d of ['/**', '!/**/*.*', '!/**/*__*', '!/**/*__*/**', '!/confidentialite', '!/confidentialite/']) {
    assert.ok(ngsw.navigationUrls.includes(d), `« ${d} » absent`);
  }
});

test('critère 2 : given la page d\'accueil, when le visiteur touche « Ouvrir l\'app », then le lien mène à l\'app à la racine (/), avec une cible tactile de 48 px minimum', () => {
  const html = lire(PAGE);
  const liens = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].filter((m) => norm(sansBalises(m[2])).trim() === "Ouvrir l'app");
  assert.ok(liens.length >= 1, 'lien « Ouvrir l\'app » absent');
  for (const l of liens) assert.match(l[1], /href="\/"/, '« Ouvrir l\'app » doit pointer vers /');
  const hauteurs = [...style(html).matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(hauteurs.some((h) => h >= 48), 'aucune cible tactile de 48 px minimum');
});

test('critère 3 : given la page d\'accueil, when le visiteur cherche les mentions légales, then le lien « Politique de confidentialité » ouvre /confidentialite', () => {
  const html = lire(PAGE);
  const lien = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].find((m) => sansBalises(m[2]).trim() === 'Politique de confidentialité');
  assert.ok(lien, 'lien « Politique de confidentialité » absent');
  assert.match(lien[1], /href="\/confidentialite"/);
});

test('critère 4 : given des liens vers les stores non encore renseignés, when le visiteur ouvre la page, then stores.json est committé avec appStore et googlePlay vides', () => {
  const stores = JSON.parse(lire('public/stores.json'));
  assert.deepEqual(stores, { appStore: '', googlePlay: '' });
});

test('critère 4 : given le HTML de la page, when aucun lien de store n\'est lu, then aucun bouton de store n\'est affiché d\'emblée (aucun lien de store en dur, boutons cachés par défaut)', () => {
  const html = lire(PAGE);
  assert.doesNotMatch(html, /play\.google\.com|apps\.apple\.com/i, 'lien de store en dur');
  for (const libelle of ['Disponible sur Google Play', "Télécharger dans l'App Store"]) {
    const m = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].find((x) => norm(sansBalises(x[2])).includes(libelle));
    if (m) assert.match(m[1], /\bhidden\b|display:\s*none/i, `bouton « ${libelle} » visible par défaut`);
  }
});

test('critère 5 : given des liens Play Store et App Store renseignés, when la page s\'ouvre, then un script inline lit stores.json (relatif) et affiche « Disponible sur Google Play » et « Télécharger dans l\'App Store »', () => {
  const html = lire(PAGE);
  const js = script(html);
  assert.match(js, /fetch\(\s*['"`]stores\.json['"`]/, 'fetch de stores.json (chemin relatif) absent');
  assert.match(js, /appStore/);
  assert.match(js, /googlePlay/);
  assert.match(js, /catch/, 'un stores.json illisible doit être géré');
  const texte = norm(html);
  assert.ok(texte.includes('Disponible sur Google Play'), 'libellé Google Play absent');
  assert.ok(texte.includes("Télécharger dans l'App Store"), 'libellé App Store absent');
});

test('critère 6 : given le téléphone en thème sombre puis clair, when le visiteur ouvre la page, then le thème suit prefers-color-scheme avec les tokens de src/theme/tokens.scss, sans ressource externe', () => {
  const html = lire(PAGE);
  const css = style(html).toLowerCase();
  assert.match(css, /prefers-color-scheme:\s*dark/);
  for (const couleur of ['#f7f3ea', '#0e1714']) assert.ok(css.includes(couleur), `token ${couleur} absent`);
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<(img|iframe|source|video|audio)[^>]+src="https?:/i);
  assert.doesNotMatch(css, /@import|url\(\s*['"]?https?:/);
});
