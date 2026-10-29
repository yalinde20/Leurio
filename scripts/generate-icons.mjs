// Génère les icônes PNG de la PWA depuis public/icons/icon.svg avec Chromium (Playwright).
// Usage : node scripts/generate-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const source = new URL('../public/icons/icon.svg', import.meta.url);
const svg = await readFile(source, 'utf8');
const sorties = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];

const navigateur = await chromium.launch();
try {
  const page = await navigateur.newPage();
  for (const [nom, taille] of sorties) {
    await page.setViewportSize({ width: taille, height: taille });
    await page.setContent(
      `<style>html,body{margin:0;background:#0054e9}svg{display:block;width:${taille}px;height:${taille}px}</style>${svg}`,
    );
    const png = await page.screenshot({ type: 'png', omitBackground: false });
    await writeFile(new URL(`../public/icons/${nom}`, import.meta.url), png);
    console.log(`${nom} (${taille}x${taille})`);
  }
} finally {
  await navigateur.close();
}
