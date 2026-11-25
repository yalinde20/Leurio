import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/run.mjs';
import { decodePng, distance, contientCouleur } from '../helpers/png.mjs';

// US 22 : icône d'app et écran de démarrage (logo validé : dégradé #5cc8b0 -> #0e6b5c -> #0e1714, hameçon crème #f7f3ea).
const TEAL = '#5cc8b0';
const SOMBRE = '#0e1714';
const CREME = '#f7f3ea';
const abs = (rel) => join(ROOT, rel);
const lire = (rel) => readFileSync(abs(rel), 'utf8');
const RES = 'android/app/src/main/res';

/** Vérifie qu'une image est le logo plein carré : coin haut-gauche turquoise, coin bas-droit sombre, hameçon crème. */
function assertLogoPleinCarre(rel, tailleAttendue) {
  assert.ok(existsSync(abs(rel)), `${rel} est absent`);
  const img = decodePng(abs(rel));
  if (tailleAttendue) assert.deepEqual([img.width, img.height], [tailleAttendue, tailleAttendue], `${rel} : taille`);
  const haut = img.pixel(2, 2), bas = img.pixel(img.width - 3, img.height - 3);
  assert.ok(distance(haut, TEAL) < 30, `${rel} : coin haut-gauche ${JSON.stringify(haut)}, attendu ${TEAL}`);
  assert.ok(distance(bas, SOMBRE) < 30, `${rel} : coin bas-droit ${JSON.stringify(bas)}, attendu ${SOMBRE}`);
  assert.ok(contientCouleur(img, CREME, 12), `${rel} : aucun pixel de l'hameçon crème ${CREME}`);
  return img;
}

// ---------- Critère 1 : Android ----------

test('critère 1 : given le projet Android, when on lit le nom de l\'app, then l\'icône et le libellé de l\'app sont « Leurio »', () => {
  assert.match(lire(`${RES}/values/strings.xml`), /<string name="app_name">Leurio<\/string>/);
  assert.match(lire('android/app/src/main/AndroidManifest.xml'), /android:label="@string\/app_name"/);
  assert.match(lire('android/app/src/main/AndroidManifest.xml'), /android:icon="@mipmap\/ic_launcher"/);
  // Le libellé de l'activité principale l'emporte dans le lanceur.
  assert.match(lire(`${RES}/values/strings.xml`), /<string name="title_activity_main">Leurio<\/string>/);
  assert.match(lire('android/app/src/main/AndroidManifest.xml'), /<activity[^>]*android:label="@string\/title_activity_main"/);
});

test('critère 1 : given l\'icône adaptative Android, when on lit ses couches, then le premier plan est l\'hameçon crème dans la zone sûre de 66 % sur fond transparent', () => {
  const xml = lire(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`);
  assert.match(xml, /<background /);
  const fg = xml.match(/<foreground android:drawable="@mipmap\/(\w+)"/);
  assert.ok(fg, 'le premier plan doit être un mipmap');
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const rel = `${RES}/mipmap-${d}/${fg[1]}.png`;
    assert.ok(existsSync(abs(rel)), `${rel} est absent`);
    const img = decodePng(abs(rel));
    assert.ok(img.hasAlpha, `${rel} doit avoir un canal alpha`);
    assert.equal(img.pixel(1, 1).a, 0, `${rel} : le coin doit être transparent`);
    assert.ok(contientCouleur(img, CREME, 12), `${rel} : aucun pixel crème de l'hameçon`);
    // Les lanceurs n'affichent que le cercle de 66 dp centré : tout pixel opaque doit y tenir.
    const cx = (img.width - 1) / 2, cy = (img.height - 1) / 2;
    let maxDist = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      if (img.pixel(x, y).a > 20) maxDist = Math.max(maxDist, Math.hypot(x - cx, y - cy));
    }
    assert.ok(maxDist <= 0.306 * img.width,
      `${rel} : le dessin sort de la zone sûre (distance au centre ${maxDist.toFixed(1)} px, maximum ${(0.306 * img.width).toFixed(1)} px sur ${img.width})`);
  }
});

test('critère 1 : given l\'icône adaptative Android, when on lit son arrière-plan, then c\'est le dégradé Leurio et plus le blanc par défaut', () => {
  const xml = lire(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`);
  const ref = xml.match(/<background android:drawable="@(\w+)\/(\w+)"/);
  assert.ok(ref, 'arrière-plan introuvable');
  const [, kind, name] = ref;
  if (kind === 'color') {
    const v = lire(`${RES}/values/ic_launcher_background.xml`).match(new RegExp(`name="${name}">(#[0-9a-fA-F]{6,8})<`));
    assert.ok(v, 'couleur introuvable');
    assert.notEqual(v[1].toUpperCase(), '#FFFFFF', 'l\'arrière-plan est encore le blanc par défaut de Capacitor');
    assert.ok(distance({ r: parseInt(v[1].slice(1, 3), 16), g: parseInt(v[1].slice(3, 5), 16), b: parseInt(v[1].slice(5, 7), 16) }, '#0e6b5c') < 60,
      `couleur d'arrière-plan ${v[1]} loin du dégradé Leurio`);
  } else if (kind === 'drawable') {
    const f = [`${RES}/drawable/${name}.xml`, `${RES}/drawable-v24/${name}.xml`].find((p) => existsSync(abs(p)));
    assert.ok(f, `drawable ${name} introuvable`);
    const t = lire(f).toLowerCase();
    for (const c of ['5cc8b0', '0e6b5c', '0e1714']) assert.ok(t.includes(c), `${f} : couleur ${c} absente du dégradé`);
  } else {
    assert.equal(kind, 'mipmap');
    assertLogoPleinCarre(`${RES}/mipmap-xxxhdpi/${name}.png`);
  }
});

test('critère 1 : given les icônes Android classiques (avant Android 8, rondes), when on les lit, then elles montrent le logo Leurio et plus l\'icône par défaut de Capacitor', () => {
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    for (const f of ['ic_launcher', 'ic_launcher_round']) {
      const rel = `${RES}/mipmap-${d}/${f}.png`;
      const img = decodePng(abs(rel));
      assert.ok(contientCouleur(img, CREME, 12), `${rel} : pas d'hameçon crème`);
      assert.ok(contientCouleur(img, '#0e6b5c', 24), `${rel} : pas de vert du dégradé`);
    }
  }
});

// ---------- Critère 2 : iOS ----------

test('critère 2 : given le projet iOS, when on lit son nom, then l\'app s\'appelle « Leurio »', () => {
  assert.match(lire('ios/App/App/Info.plist'), /<key>CFBundleDisplayName<\/key>\s*<string>Leurio<\/string>/);
});

test('critère 2 : given l\'icône iOS, when on lit AppIcon, then c\'est le logo Leurio en 1024 x 1024 sans canal alpha', () => {
  const dir = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';
  const contents = JSON.parse(lire(`${dir}/Contents.json`));
  const entree = contents.images.find((i) => i.size === '1024x1024' && !i.appearances);
  assert.ok(entree?.filename, 'aucune icône 1024x1024 déclarée');
  const img = assertLogoPleinCarre(`${dir}/${entree.filename}`, 1024);
  assert.equal(img.hasAlpha, false, 'l\'icône App Store ne doit pas avoir de canal alpha');
});

// ---------- Critère 3 : PWA ----------

test('critère 3 : given le manifeste de la PWA, when on lit ses icônes, then il déclare 192, 512 et 512 maskable, et ces fichiers montrent le logo Leurio', () => {
  const m = JSON.parse(lire('public/manifest.webmanifest'));
  assert.equal(m.name, 'Leurio');
  const trouve = (taille, purpose) => m.icons.find((i) => i.sizes === `${taille}x${taille}` && i.type === 'image/png' && (i.purpose ?? 'any').split(' ').includes(purpose));
  for (const [t, p] of [[192, 'any'], [512, 'any'], [512, 'maskable']]) {
    const icone = trouve(t, p);
    assert.ok(icone, `icône ${t}x${t} « ${p} » absente du manifeste`);
    assertLogoPleinCarre(join('public', icone.src), t);
  }
});

test('critère 3 : given la page d\'index, when on lit apple-touch-icon, then elle pointe une icône 180 x 180 qui montre le logo Leurio', () => {
  const html = lire('src/index.html');
  const href = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/)?.[1];
  assert.ok(href, 'apple-touch-icon absent de index.html');
  assertLogoPleinCarre(join('public', href), 180);
});

test('critère 3 : given les sources d\'icônes, when on les cherche, then le logo validé remplace l\'ancien poisson blanc sur fond bleu #0054e9', () => {
  const svg = lire('public/icons/icon.svg').toLowerCase();
  assert.ok(!svg.includes('0054e9'), 'icon.svg est encore l\'icône provisoire bleue');
  for (const c of ['5cc8b0', '0e6b5c', '0e1714', 'f7f3ea']) assert.ok(svg.includes(c), `icon.svg : couleur ${c} absente`);
});

// ---------- Critère 4 : écran de démarrage ----------

function couleursAndroid(dossier) {
  const out = {};
  for (const d of ['values', dossier]) {
    const p = `${RES}/${d}`;
    if (!existsSync(abs(p))) continue;
    for (const f of readdirSync(abs(p)).filter((n) => n.endsWith('.xml'))) {
      for (const m of lire(`${p}/${f}`).matchAll(/<color name="(\w+)">(#[0-9a-fA-F]+)<\/color>/g)) out[m[1]] = m[2];
    }
  }
  return out;
}

function itemSplash(dossier, item) {
  // Le style peut être redéfini dans values-night ; sinon celui de values s'applique.
  for (const d of [dossier, 'values']) {
    const p = `${RES}/${d}/styles.xml`;
    if (!existsSync(abs(p))) continue;
    const bloc = lire(p).match(/<style name="AppTheme\.NoActionBarLaunch"[^>]*>([\s\S]*?)<\/style>/)?.[1];
    const v = bloc?.match(new RegExp(`<item name="${item}">([^<]+)</item>`))?.[1];
    if (v) return v.trim();
  }
  return null;
}

function resoudre(dossier, valeur) {
  if (valeur?.startsWith('#')) return valeur;
  const nom = valeur?.match(/^@color\/(\w+)$/)?.[1];
  return nom ? couleursAndroid(dossier)[nom] : undefined;
}

test('critère 4 : given l\'app Android en thème clair, when elle démarre, then le fond de l\'écran de démarrage est #f7f3ea', () => {
  const v = itemSplash('values', 'windowSplashScreenBackground');
  assert.ok(v, 'windowSplashScreenBackground absent du thème AppTheme.NoActionBarLaunch');
  assert.equal(resoudre('values', v)?.toLowerCase(), CREME);
});

test('critère 4 : given l\'app Android en thème sombre, when elle démarre, then le fond de l\'écran de démarrage est #0e1714', () => {
  const v = itemSplash('values-night', 'windowSplashScreenBackground');
  assert.ok(v, 'windowSplashScreenBackground absent pour values-night');
  assert.equal(resoudre('values-night', v)?.toLowerCase(), SOMBRE);
});

test('critère 4 : given l\'app Android 12+, when elle démarre, then l\'icône Leurio est celle de l\'écran de démarrage', () => {
  const v = itemSplash('values', 'windowSplashScreenAnimatedIcon');
  assert.ok(v, 'windowSplashScreenAnimatedIcon absent du thème AppTheme.NoActionBarLaunch');
  const [, kind, name] = v.match(/^@(\w+)\/(\w+)$/) ?? [];
  const candidats = readdirSync(abs(RES)).filter((d) => d.startsWith(kind)).flatMap((d) => readdirSync(abs(`${RES}/${d}`)).map((f) => `${RES}/${d}/${f}`)).filter((f) => f.split('/').pop().replace(/\.\w+$/, '') === name);
  assert.ok(candidats.length > 0, `ressource ${v} introuvable`);
  const png = candidats.find((f) => f.endsWith('.png'));
  if (png) assert.ok(contientCouleur(decodePng(abs(png)), CREME, 12), `${png} : pas d'hameçon crème`);
  else assert.ok(candidats.some((f) => /f7f3ea/i.test(lire(f))), `${candidats[0]} : l'hameçon crème est absent`);
});

// iOS : le fond effectif du LaunchScreen, clair ou sombre, via un colorset nommé ou via les images du Splash.imageset.
const XC = 'ios/App/App/Assets.xcassets';

function composante(v) {
  const s = String(v);
  if (s.startsWith('0x') || s.startsWith('0X')) return parseInt(s, 16);
  return s.includes('.') ? Math.round(parseFloat(s) * 255) : parseInt(s, 10);
}

function fondIos(sombre) {
  const sb = lire('ios/App/App/Base.lproj/LaunchScreen.storyboard');
  const nom = sb.match(/<color key="backgroundColor" name="(\w+)"/)?.[1];
  if (nom) {
    const cs = JSON.parse(lire(`${XC}/${nom}.colorset/Contents.json`));
    const e = cs.colors.find((c) => !!c.appearances?.some((a) => a.appearance === 'luminosity' && a.value === 'dark') === sombre);
    const c = e?.color?.components;
    return c ? { r: composante(c.red), g: composante(c.green), b: composante(c.blue) } : undefined;
  }
  const contents = JSON.parse(lire(`${XC}/Splash.imageset/Contents.json`));
  const e = contents.images.find((i) => !!i.appearances?.some((a) => a.appearance === 'luminosity' && a.value === 'dark') === sombre);
  return e ? decodePng(abs(`${XC}/Splash.imageset/${e.filename}`)).pixel(3, 3) : undefined;
}

test('critère 4 : given l\'app iOS en thème clair, when elle démarre, then le LaunchScreen a le fond #f7f3ea', () => {
  const p = fondIos(false);
  assert.ok(p, 'aucun fond clair défini pour le LaunchScreen');
  assert.ok(distance(p, CREME) < 4, `fond clair ${JSON.stringify(p)}, attendu ${CREME}`);
});

test('critère 4 : given l\'app iOS en thème sombre, when elle démarre, then le LaunchScreen a une variante sombre au fond #0e1714', () => {
  const p = fondIos(true);
  assert.ok(p, 'aucune variante sombre (luminosity dark) pour le LaunchScreen');
  assert.ok(distance(p, SOMBRE) < 4, `fond sombre ${JSON.stringify(p)}, attendu ${SOMBRE}`);
});

test('critère 4 : given le LaunchScreen iOS, when on lit le Splash, then il montre le logo Leurio au centre', () => {
  const contents = JSON.parse(lire(`${XC}/Splash.imageset/Contents.json`));
  assert.ok(contents.images.length > 0);
  for (const i of contents.images) {
    const img = decodePng(abs(`${XC}/Splash.imageset/${i.filename}`));
    assert.ok(contientCouleur(img, CREME, 12) && contientCouleur(img, '#0e6b5c', 24), `${i.filename} : le logo Leurio (hameçon crème sur dégradé) est absent`);
  }
});

test('critère 4 : given le lancement de l\'app, when l\'écran de démarrage laisse place à l\'app, then la racine et toute URL inconnue ouvrent l\'onglet « Conseil »', () => {
  const routes = lire('src/app/app.routes.ts');
  assert.match(routes, /path: '',\s*pathMatch: 'full',\s*redirectTo: 'conseil'/);
  assert.match(routes, /path: '\*\*',\s*redirectTo: 'conseil'/);
});
