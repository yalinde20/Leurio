// US 292 : aucune couleur littérale dans les `styles:` des composants TypeScript (src/app/**/*.ts).
// Les couleurs passent par les tokens --lr-* ; seuls tokens.scss et ionic.scss ont des couleurs en dur (stylelint couvre les .scss).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOMS = 'black|white|red|green|blue|yellow|orange|purple|pink|brown|gray|grey|cyan|magenta|lime|navy|teal|olive|maroon|aqua|silver|fuchsia|gold|indigo|violet|beige|ivory|khaki|salmon|tomato|crimson|coral|orchid|plum|tan|turquoise|lavender|azure|bisque|chocolate|darkgr[ae]y|lightgr[ae]y|dimgr[ae]y|slategr[ae]y|darkblue|darkred|darkgreen|lightblue|lightgreen|skyblue|steelblue|royalblue|firebrick';
const COULEUR = new RegExp(
  `#[0-9a-fA-F]{3,8}\\b|\\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\\(|(?<![-\\w$.#])(?:${NOMS})(?![-\\w(])`,
  'i',
);
// Un nom de couleur n'est cherché que dans la valeur d'une déclaration (après « : », avant « ; »), jamais dans un sélecteur.
const DECLARATION = /:\s*([^;{}]+)/g;
const STYLES = /\bstyles\s*:\s*(`[\s\S]*?`|\[[\s\S]*?\]|'[^']*'|"[^"]*")/g;

/** Retourne les couleurs littérales trouvées dans les `styles:` du code TypeScript donné. */
export function couleursEnDur(source) {
  const trouvees = [];
  for (const [, styles] of source.matchAll(STYLES)) {
    if (/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/.test(styles)) {
      trouvees.push(styles.match(COULEUR)[0]);
    }
    for (const [, valeur] of styles.matchAll(DECLARATION)) {
      const m = valeur.replace(/var\([^)]*\)/g, '').match(COULEUR);
      if (m && !/^#/.test(m[0]) && !/\($/.test(m[0])) trouvees.push(m[0]);
    }
  }
  return [...new Set(trouvees)];
}

function fichiersTs(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = join(dossier, e.name);
    if (e.isDirectory()) return fichiersTs(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const racine = join(fileURLToPath(import.meta.url), '../..');
  const fautifs = fichiersTs(join(racine, 'src/app'))
    .map((f) => [relative(racine, f), couleursEnDur(readFileSync(f, 'utf8'))])
    .filter(([, c]) => c.length > 0);
  for (const [f, c] of fautifs) console.error(`${f} : couleur écrite en dur dans styles: (${c.join(', ')}). Utilise un token --lr-*.`);
  process.exit(fautifs.length > 0 ? 1 : 0);
}
