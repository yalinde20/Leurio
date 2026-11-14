/** Les fichiers de contenu (assets/data) dont « À propos et sources » liste les sources, dans l'ordre d'affichage. */
export const FICHIERS_CONTENU: readonly { fichier: string; libelle: string }[] = [
  { fichier: 'species', libelle: 'Espèces' },
  { fichier: 'lure-types', libelle: 'Types de leurres' },
  { fichier: 'lure-families', libelle: 'Familles de leurres' },
  { fichier: 'techniques', libelle: 'Animations' },
  { fichier: 'couleurs', libelle: 'Couleurs' },
  { fichier: 'starter-kit', libelle: 'Kit de départ' },
  { fichier: 'federations', libelle: 'Fédérations de pêche' },
  { fichier: 'departements', libelle: 'Départements' },
];

/** Les champs `sources` (listes de textes) trouvés partout dans le contenu, dédoublonnés, dans l'ordre du fichier. */
export function collecterSources(contenu: unknown): string[] {
  const trouvees = new Set<string>();
  const parcourir = (x: unknown): void => {
    if (Array.isArray(x)) {
      x.forEach(parcourir);
    } else if (x && typeof x === 'object') {
      for (const [cle, valeur] of Object.entries(x)) {
        if (cle === 'sources' && Array.isArray(valeur)) {
          for (const s of valeur) if (typeof s === 'string' && s.trim() !== '') trouvees.add(s);
        } else {
          parcourir(valeur);
        }
      }
    }
  };
  parcourir(contenu);
  return [...trouvees];
}

export interface MorceauSource {
  texte: string;
  /** Renseigné quand le morceau est une adresse web (http ou https). */
  url?: string;
}

/** Coupe une source en morceaux de texte et en adresses web, sans rien changer au texte : les morceaux, mis bout à bout, redonnent la source. */
export function morceauxDeSource(source: string): MorceauSource[] {
  const morceaux: MorceauSource[] = [];
  let debut = 0;
  for (const m of source.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    // La ponctuation qui termine une phrase ou ferme une parenthèse ne fait pas partie de l'adresse.
    const url = m[0].replace(/[.,;:!?)\]]+$/, '');
    if (m.index > debut) morceaux.push({ texte: source.slice(debut, m.index) });
    morceaux.push({ texte: url, url });
    debut = m.index + url.length;
  }
  if (debut < source.length) morceaux.push({ texte: source.slice(debut) });
  return morceaux;
}
