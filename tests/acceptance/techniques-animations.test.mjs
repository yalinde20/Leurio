// US 42 : le contenu réel (8 animations avec leurs vidéos) respecte les critères.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run } from '../helpers/run.mjs';

const animations = () => JSON.parse(readFileSync(join(ROOT, 'src/assets/data/techniques.json'), 'utf8'));
const texte = (v) => typeof v === 'string' && v.trim().length > 0;
const EXTERNES = ['youtube', 'vimeo', 'dailymotion'];
const PROVIDERS = [...EXTERNES, 'self'];

function exigeHuitAnimations(liste) {
  assert.equal(liste.length, 8, `8 animations attendues, ${liste.length} trouvée(s)`);
}

function phrases(geste) {
  return geste.split(/(?<=[.!?…])(?:\s+|$)/).filter((p) => p.trim().length > 0);
}

test('critère 2 : given chaque animation, when on la lit, then elle a un geste en 2 ou 3 phrases, une vitesse, une erreur à éviter, une difficulté de 1 à 3, des sources et une dateVerif', () => {
  const liste = animations();
  exigeHuitAnimations(liste);
  for (const a of liste) {
    assert.ok(texte(a.geste), `${a.id} : geste manquant`);
    const n = phrases(a.geste).length;
    assert.ok(n >= 2 && n <= 3, `${a.id} : le geste a ${n} phrase(s), 2 ou 3 attendues`);
    assert.ok(texte(a.vitesse), `${a.id} : vitesse manquante`);
    assert.ok(texte(a.erreurAEviter), `${a.id} : erreurAEviter manquante`);
    assert.ok(Number.isInteger(a.difficulte) && a.difficulte >= 1 && a.difficulte <= 3, `${a.id} : difficulte hors 1..3`);
    assert.ok(Array.isArray(a.sources) && a.sources.length > 0 && a.sources.every(texte), `${a.id} : sources manquantes`);
    assert.match(String(a.dateVerif), /^\d{4}-\d{2}-\d{2}$/, `${a.id} : dateVerif invalide`);
  }
});

test('critère 3 : given chaque animation, when on compte ses vidéos youtube, vimeo ou dailymotion, then il y en a de 1 à 3, chacune avec un id, un start et un auteur', () => {
  const liste = animations();
  exigeHuitAnimations(liste);
  for (const a of liste) {
    const externes = a.videos.filter((v) => EXTERNES.includes(v.provider));
    assert.ok(externes.length >= 1 && externes.length <= 3, `${a.id} : ${externes.length} vidéo(s) externe(s), 1 à 3 attendue(s)`);
    for (const v of externes) {
      assert.ok(texte(v.id), `${a.id} : id manquant`);
      assert.ok(Number.isInteger(v.start) && v.start >= 0, `${a.id}/${v.id} : start doit être un entier >= 0`);
      assert.ok(texte(v.auteur), `${a.id}/${v.id} : auteur manquant`);
    }
  }
});

test('critère 4 : given chaque animation, when on lit ses vidéos, then elle a une entrée self qui donne le chemin de sa boucle courte, avec boucle et horsLigne à vrai', () => {
  const liste = animations();
  exigeHuitAnimations(liste);
  for (const a of liste) {
    const selfs = a.videos.filter((v) => v.provider === 'self');
    assert.equal(selfs.length, 1, `${a.id} : une entrée self attendue, ${selfs.length} trouvée(s)`);
    const [s] = selfs;
    assert.match(s.fichier, /^videos\/[a-z0-9-]+\.(mp4|webm)$/, `${a.id} : chemin de boucle invalide`);
    assert.match(s.fichier, new RegExp(`^videos/${a.id}\\.(mp4|webm)$`), `${a.id} : la boucle doit porter l'id de l'animation`);
    assert.equal(s.boucle, true, `${a.id} : boucle doit valoir true`);
    assert.equal(s.horsLigne, true, `${a.id} : horsLigne doit valoir true`);
  }
});

test('critère 5 : given toutes les vidéos, when on lit leur provider, then il vaut youtube, vimeo, dailymotion ou self, et aucune ne désigne un fichier tiers hébergé par Leurio', () => {
  const liste = animations();
  exigeHuitAnimations(liste);
  for (const a of liste) {
    for (const v of a.videos) {
      assert.ok(PROVIDERS.includes(v.provider), `${a.id} : provider inconnu "${v.provider}"`);
      if (v.provider === 'self') assert.equal(v.licence, 'propre', `${a.id} : une vidéo self doit avoir la licence "propre"`);
      else assert.equal(v.fichier, undefined, `${a.id}/${v.id} : une vidéo tierce ne doit pas avoir de fichier hébergé`);
    }
  }
});

test('critère 6 : given le contenu de 8 animations, when on lance npm run validate-data, then elle passe', () => {
  exigeHuitAnimations(animations());
  const r = run('npm', ['run', 'validate-data'], 120_000);
  assert.equal(r.status, 0, r.output);
});
