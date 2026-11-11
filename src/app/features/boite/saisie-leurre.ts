/** Lit un nombre saisi (virgule ou point décimal) : `null` s'il n'est pas un nombre strictement supérieur à 0. */
export function nombrePositif(texte: string): number | null {
  const propre = texte.trim().replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(propre)) return null;
  const n = Number(propre);
  return n > 0 ? n : null;
}

export const CHAMP_OBLIGATOIRE = 'Champ obligatoire';
export const NOMBRE_INVALIDE = 'Entre un nombre supérieur à 0.';

/** Erreur d'un champ numérique : vide, ou pas un nombre supérieur à 0. `null` si valide. */
export function erreurNombre(texte: string): string | null {
  if (texte.trim() === '') return CHAMP_OBLIGATOIRE;
  return nombrePositif(texte) === null ? NOMBRE_INVALIDE : null;
}

/** Erreur d'un champ texte obligatoire. `null` si renseigné. */
export function erreurTexte(texte: string): string | null {
  return texte.trim() === '' ? CHAMP_OBLIGATOIRE : null;
}
