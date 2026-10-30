import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from 'sass';
import { ROOT } from './run.mjs';

export const TOKENS_FILE = 'src/theme/tokens.scss';

/** Lit les tokens --lr-* dans le CSS compilé : thème clair = avant le @media, thème sombre = à partir du @media prefers-color-scheme: dark. */
export function lireThemes() {
  const p = join(ROOT, TOKENS_FILE);
  if (!existsSync(p)) throw new Error(`${TOKENS_FILE} est absent : les tokens de thème n'existent pas encore`);
  const css = compile(p).css.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/.exec(css);
  if (!m) throw new Error(`${TOKENS_FILE} n'a pas de bloc @media (prefers-color-scheme: dark)`);
  const lire = (txt) => Object.fromEntries([...txt.matchAll(/(--lr-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)].map((x) => [x[1], x[2].toLowerCase()]));
  return { clair: lire(css.slice(0, m.index)), sombre: lire(css.slice(m.index)) };
}

export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
