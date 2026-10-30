import { compile } from 'sass';

const FICHIER = 'src/theme/tokens.scss';

/** Lit les tokens --lr-* dans le CSS compilé : thème clair = avant le @media, thème sombre = à partir du @media prefers-color-scheme: dark. */
export function lireThemes(): { clair: Record<string, string>; sombre: Record<string, string> } {
  const css = compile(FICHIER).css.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = css.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/);
  if (i < 0) throw new Error(`${FICHIER} n'a pas de bloc @media (prefers-color-scheme: dark)`);
  const lire = (txt: string) =>
    Object.fromEntries([...txt.matchAll(/(--lr-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)].map((x) => [x[1], x[2].toLowerCase()]));
  return { clair: lire(css.slice(0, i)), sombre: lire(css.slice(i)) };
}
