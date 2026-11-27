// US 292 : aucune couleur littérale dans les `styles:` des composants TypeScript (src/app/**/*.ts).
// Les couleurs passent par les tokens --lr-* ; seuls tokens.scss et ionic.scss ont des couleurs en dur.
// Les styles sont extraits avec l'analyseur TypeScript, puis vérifiés par stylelint avec la configuration du dépôt
// (stylelint.config.mjs) : ce sont exactement les règles appliquées aux fichiers .scss.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import stylelint from 'stylelint';
import ts from 'typescript';

const RACINE = join(fileURLToPath(import.meta.url), '../..');

/** Contenu CSS de chaque `styles:` (chaîne, gabarit sans interpolation ou tableau de ces valeurs) du code TypeScript donné. */
export function extraireStyles(source) {
  const fichier = ts.createSourceFile('composant.ts', source, ts.ScriptTarget.Latest, true);
  const styles = [];
  const texte = (n) => (ts.isStringLiteralLike(n) ? styles.push(n.text) : undefined);
  const visiter = (n) => {
    if (ts.isPropertyAssignment(n) && n.name.getText(fichier) === 'styles') {
      if (ts.isArrayLiteralExpression(n.initializer)) n.initializer.elements.forEach(texte);
      else texte(n.initializer);
    }
    ts.forEachChild(n, visiter);
  };
  visiter(fichier);
  return styles;
}

/** Messages stylelint (couleurs littérales) pour les `styles:` du code TypeScript donné. */
export async function couleursEnDur(source) {
  const { default: config } = await import(pathToFileURL(join(RACINE, 'stylelint.config.mjs')).href);
  const messages = [];
  for (const code of extraireStyles(source)) {
    const { results } = await stylelint.lint({ code, config: { ...config, ignoreFiles: [] } });
    messages.push(...results.flatMap((r) => r.warnings.map((w) => w.text)));
  }
  return messages;
}

function fichiersTs(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = join(dossier, e.name);
    if (e.isDirectory()) return fichiersTs(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let echec = false;
  for (const f of fichiersTs(join(RACINE, 'src/app'))) {
    const messages = await couleursEnDur(readFileSync(f, 'utf8'));
    for (const m of messages) console.error(`${relative(RACINE, f)} : couleur écrite en dur dans styles: ${m} Utilise un token --lr-*.`);
    if (messages.length > 0) echec = true;
  }
  process.exit(echec ? 1 : 0);
}
