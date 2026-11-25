// Génère toutes les icônes et images de démarrage depuis public/icons/icon.svg (logo validé, carré plein) avec Chromium (Playwright) :
// PWA (public/icons, favicon), icônes et écran de démarrage Android (res/mipmap-*, res/drawable-nodpi), icône et écran de démarrage iOS (Assets.xcassets).
// L'hameçon seul (premier plan de l'icône adaptative Android) est dérivé du même SVG : une seule source.
// Usage : node scripts/generate-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { crc32, deflateSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const racine = (rel) => new URL(`../${rel}`, import.meta.url);
const ANDROID = 'android/app/src/main/res';
const IOS = 'ios/App/App/Assets.xcassets';

const logo = await readFile(racine('public/icons/icon.svg'), 'utf8');

/** Le même dessin, avec l'hameçon réduit autour du centre (zone sûre) ; `sansFond` retire le dégradé (hameçon seul sur fond transparent). */
function logoReduit(echelle, { sansFond = false } = {}) {
  const [entete, corps] = logo.split('</defs>');
  const fond = corps.match(/<rect [^>]*\/>/)[0];
  const hamecon = corps.replace(fond, '').replace('</svg>', '');
  const transformation = `translate(512 512) scale(${echelle}) translate(-512 -512)`;
  return `${entete}</defs>${sansFond ? '' : fond}<g transform="${transformation}">${hamecon}</g></svg>`;
}

const sorties = []; // [chemin relatif, taille, options]
const ajouter = (chemin, taille, options = {}) => sorties.push({ chemin, taille, ...options });

// PWA (§3 du plan : installable avec 192, 512 et 512 maskable)
ajouter('public/icons/icon-192.png', 192);
ajouter('public/icons/icon-512.png', 512);
ajouter('public/icons/icon-maskable-512.png', 512, { svg: logoReduit(0.85) }); // fond plein, hameçon dans les 80 % centraux
ajouter('public/icons/apple-touch-icon.png', 180);

// iOS : icône App Store 1024 sans canal alpha ; image de l'écran de démarrage (logo arrondi, 128 pt, @1x/@2x/@3x)
ajouter(`${IOS}/AppIcon.appiconset/AppIcon-512@2x.png`, 1024, { opaque: true });
for (const echelle of [1, 2, 3]) ajouter(`${IOS}/Splash.imageset/splash-${echelle}x.png`, 128 * echelle, { forme: 'arrondi' });

// Android : icônes classiques (carrée arrondie, ronde) et premier plan de l'icône adaptative (108 dp, hameçon dans la zone sûre de 66 %)
const DENSITES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [densite, f] of Object.entries(DENSITES)) {
  ajouter(`${ANDROID}/mipmap-${densite}/ic_launcher.png`, 48 * f, { forme: 'arrondi' });
  ajouter(`${ANDROID}/mipmap-${densite}/ic_launcher_round.png`, 48 * f, { forme: 'rond' });
  ajouter(`${ANDROID}/mipmap-${densite}/ic_launcher_foreground.png`, 108 * f, { svg: logoReduit(0.78, { sansFond: true }) });
}
// Android : icône de l'écran de démarrage (Android 12+ : 288 dp, dont un disque de 192 dp visible), le logo dans le disque
ajouter(`${ANDROID}/drawable-nodpi/splash_icon.png`, 1152, { forme: 'rond', marge: 192 });

const navigateur = await chromium.launch();
try {
  const page = await navigateur.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  for (const sortie of sorties) {
    const rgba = await rastériser(page, sortie);
    await ecrire(sortie.chemin, png(sortie.taille, rgba, !sortie.opaque));
    console.log(`${sortie.chemin} (${sortie.taille}x${sortie.taille})`);
  }
  // favicon.ico : PNG 16, 32 et 48 intégrés.
  const tailles = [16, 32, 48];
  const images = [];
  for (const taille of tailles) images.push(png(taille, await rastériser(page, { taille, forme: 'arrondi' }), true));
  await ecrire('public/favicon.ico', ico(tailles, images));
  console.log('public/favicon.ico (16, 32, 48)');
} finally {
  await navigateur.close();
}

async function ecrire(chemin, donnees) {
  await writeFile(racine(chemin), donnees);
}

/** Dessine le SVG dans un canvas (découpé selon la forme, avec une marge transparente éventuelle) et rend les pixels RGBA. */
async function rastériser(page, { svg = logo, taille, forme, marge = 0 }) {
  const base64 = await page.evaluate(
    async ({ svg, taille, forme, marge }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await image.decode();
      const canvas = document.getElementById('c');
      canvas.width = canvas.height = taille;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, taille, taille);
      const cote = taille - 2 * marge;
      ctx.beginPath();
      if (forme === 'rond') ctx.arc(taille / 2, taille / 2, cote / 2, 0, 2 * Math.PI);
      else if (forme === 'arrondi') ctx.roundRect(marge, marge, cote, cote, cote * (225 / 1024)); // même rayon que la maquette
      else ctx.rect(marge, marge, cote, cote);
      ctx.clip();
      ctx.drawImage(image, marge, marge, cote, cote);
      const donnees = ctx.getImageData(0, 0, taille, taille).data;
      let binaire = '';
      for (let i = 0; i < donnees.length; i += 0x8000) binaire += String.fromCharCode(...donnees.subarray(i, i + 0x8000));
      return btoa(binaire);
    },
    { svg, taille, forme, marge },
  );
  return Buffer.from(base64, 'base64');
}

/** Encode un PNG 8 bits non entrelacé, RGBA ou RGB (sans canal alpha, exigé pour l'icône App Store). */
function png(taille, rgba, avecAlpha) {
  const octets = avecAlpha ? 4 : 3;
  const lignes = Buffer.alloc(taille * (taille * octets + 1));
  for (let y = 0; y < taille; y++) {
    const debut = y * (taille * octets + 1);
    for (let x = 0; x < taille; x++) {
      const source = (y * taille + x) * 4;
      for (let k = 0; k < octets; k++) lignes[debut + 1 + x * octets + k] = rgba[source + k];
    }
  }
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(taille, 0);
  entete.writeUInt32BE(taille, 4);
  entete[8] = 8;
  entete[9] = avecAlpha ? 6 : 2;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    morceau('IHDR', entete),
    morceau('IDAT', deflateSync(lignes, { level: 9 })),
    morceau('IEND', Buffer.alloc(0)),
  ]);
}

function morceau(type, donnees) {
  const tete = Buffer.from(type, 'latin1');
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const somme = Buffer.alloc(4);
  somme.writeUInt32BE(crc32(Buffer.concat([tete, donnees])));
  return Buffer.concat([longueur, tete, donnees, somme]);
}

/** Conteneur ICO dont les images sont des PNG. */
function ico(tailles, images) {
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(1, 2);
  entete.writeUInt16LE(images.length, 4);
  let decalage = 6 + 16 * images.length;
  const entrees = images.map((image, i) => {
    const e = Buffer.alloc(16);
    e[0] = e[1] = tailles[i];
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(image.length, 8);
    e.writeUInt32LE(decalage, 12);
    decalage += image.length;
    return e;
  });
  return Buffer.concat([entete, ...entrees, ...images]);
}
