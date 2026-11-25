// US 132 : documenter la création de la clé App Check (reCAPTCHA Enterprise) et les domaines à autoriser.
// La documentation App Check est dans docs/app-check.md (US 20). Tests sur le fichier : aucun service réel n'est appelé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';

const DOC = 'docs/app-check.md';

const lireDoc = () => {
  const f = join(ROOT, DOC);
  assert.ok(existsSync(f), `${DOC} est absent`);
  return readFileSync(f, 'utf8');
};

/** Texte de la section de niveau 2 ou 3 dont le titre correspond à `titre`, jusqu'au titre suivant de même niveau ou plus haut. */
function section(md, titre) {
  const lignes = md.split('\n');
  const debut = lignes.findIndex((l) => /^#{2,3}\s/.test(l) && titre.test(l));
  assert.ok(debut >= 0, `aucune section dont le titre correspond à ${titre}`);
  const niveau = lignes[debut].match(/^#+/)[0].length;
  const fin = lignes.findIndex((l, i) => i > debut && /^#+\s/.test(l) && l.match(/^#+/)[0].length <= niveau);
  return lignes.slice(debut, fin < 0 ? undefined : fin).join('\n');
}

const sectionCle = () => section(lireDoc(), /clé.*recaptcha|recaptcha.*clé/i);

test('critère 1 : given la documentation du projet, when je cherche comment obtenir la clé de site App Check, then elle indique de créer, dans la console Google Cloud, une clé reCAPTCHA Enterprise de type Site Web', () => {
  const s = sectionCle();
  assert.match(s, /console Google Cloud/i);
  assert.match(s, /crée[^\n]*clé[^\n]*reCAPTCHA Enterprise|clé[^\n]*reCAPTCHA Enterprise[^\n]*crée/i);
  assert.match(s, /type[^\n]*«\s*Site Web\s*»|type Site Web/i);
  assert.match(s, /console\.cloud\.google\.com\/security\/recaptcha/);
});

test('critère 2 : given la documentation du projet, when je cherche les domaines à autoriser pour la clé, then elle liste `<id-du-projet>.web.app`, puis `leurio.app` une fois le domaine acheté', () => {
  const s = sectionCle();
  const webApp = s.indexOf('`<id-du-projet>.web.app`');
  const leurio = s.indexOf('`leurio.app`');
  assert.ok(webApp >= 0, '`<id-du-projet>.web.app` absent de la section de la clé');
  assert.ok(leurio >= 0, '`leurio.app` absent de la section de la clé');
  assert.ok(webApp < leurio, '`<id-du-projet>.web.app` doit venir avant `leurio.app`');
  const ligneLeurio = s.split('\n').find((l) => l.includes('`leurio.app`'));
  assert.match(ligneLeurio, /domaine[^\n]*achet|achat/i);
  assert.match(s, /domaines?/i);
});

test('critère 3 : given la documentation du projet, when je cherche où renseigner la clé obtenue, then elle indique de la mettre dans le secret GitHub `FIREBASE_APPCHECK_SITE_KEY`', () => {
  const s = sectionCle();
  assert.match(s, /secret GitHub `FIREBASE_APPCHECK_SITE_KEY`/);
});

test('critère 4 : given la documentation du projet, when je cherche les étapes suivant la mise en place de la vraie clé, then elle indique d\'activer l\'application forcée App Check pour Firestore, Storage et Authentication dans la console Firebase', () => {
  const s = section(lireDoc(), /^##\s.*application forcée/i);
  assert.match(s, /application forcée/i);
  assert.match(s, /console Firebase/i);
  assert.match(s, /Firestore/);
  assert.match(s, /Storage/);
  assert.match(s, /Authentication/);
  // Cette section suit la mise en place de la clé dans la page.
  const md = lireDoc();
  assert.ok(md.indexOf(sectionCle()) < md.indexOf(s), 'l\'application forcée doit venir après la mise en place de la clé');
});
