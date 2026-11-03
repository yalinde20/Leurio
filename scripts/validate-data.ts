// Valide la structure des fichiers de contenu (PLAN §9) avec les schémas de `schemas/`.
// Usage : node scripts/validate-data.ts [dossier]   (par défaut : src/assets/data)
// Code de sortie : 0 si tout est conforme, 1 sinon. Syntaxe TypeScript effaçable seulement
// (Node la exécute directement, sans compilation).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import type { ErrorObject } from 'ajv';

interface Fichier {
  nom: string;
  /** Nom de l'élément d'une liste dans les messages (« espèce », « animation »…). */
  element?: string;
  /** Champs qui identifient un élément, par ordre de préférence. */
  identifiants?: string[];
}

const FICHIERS: Fichier[] = [
  { nom: 'species', element: 'espèce', identifiants: ['code', 'nom'] },
  { nom: 'lure-types', element: 'type de leurre', identifiants: ['id', 'nom'] },
  { nom: 'techniques', element: 'animation', identifiants: ['id', 'nom'] },
  { nom: 'starter-kit', element: 'kit de départ', identifiants: ['typeId'] },
  { nom: 'federations', element: 'fédération', identifiants: ['departement', 'nom'] },
  { nom: 'engine-weights' },
];

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const dossier = resolve(process.argv[2] ?? join(racine, 'src/assets/data'));

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

/** « /0/videos/1/provider » -> ['0', 'videos', '1', 'provider'] */
const segments = (chemin: string): string[] => chemin.split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));

/** « videos[1].provider » */
const nommer = (parts: string[]): string =>
  parts.reduce((acc, p) => (/^\d+$/.test(p) ? `${acc}[${p}]` : acc ? `${acc}.${p}` : p), '');

function decrire(e: ErrorObject): string {
  const parts = segments(e.instancePath);
  if (e.keyword === 'required') return `champ manquant « ${nommer([...parts, String(e.params['missingProperty'])])} »`;
  if (e.keyword === 'additionalProperties') return `champ inconnu « ${nommer([...parts, String(e.params['additionalProperty'])])} »`;
  const champ = nommer(parts);
  const attendu = e.keyword === 'enum' ? ` (valeurs permises : ${(e.params['allowedValues'] as unknown[]).join(', ')})` : '';
  return `champ « ${champ || 'contenu'} » invalide : ${e.message ?? 'non conforme'}${attendu}`;
}

function valider(fichier: Fichier): string[] {
  const nomFichier = `${fichier.nom}.json`;
  const chemin = join(dossier, nomFichier);
  if (!existsSync(chemin)) return [`${nomFichier} : fichier absent (${chemin})`];
  let donnees: unknown;
  try {
    donnees = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (erreur) {
    return [`${nomFichier} : JSON invalide (${(erreur as Error).message})`];
  }
  const schema = JSON.parse(readFileSync(join(racine, 'schemas', `${fichier.nom}.schema.json`), 'utf8'));
  const verifier = ajv.compile(schema);
  if (verifier(donnees)) return [];
  const messages = (verifier.errors ?? [])
    // « if » n'ajoute que du bruit : l'erreur utile est celle de la branche « then ».
    .filter((e) => e.keyword !== 'if')
    .map((e) => {
      const [indice] = segments(e.instancePath);
      let lieu = nomFichier;
      if (fichier.element && indice !== undefined && Array.isArray(donnees)) {
        const entree = donnees[Number(indice)] as Record<string, unknown> | undefined;
        const cle = fichier.identifiants?.map((c) => entree?.[c]).find((v) => typeof v === 'string' && v !== '');
        lieu += `, ${fichier.element} ${cle ?? `n° ${Number(indice) + 1}`}`;
      }
      return `${lieu} : ${decrire(e)}`;
    });
  return [...new Set(messages)];
}

const erreurs = FICHIERS.flatMap(valider);
if (erreurs.length > 0) {
  console.error(`Contenu invalide (${erreurs.length} erreur${erreurs.length > 1 ? 's' : ''}) :`);
  for (const message of erreurs) console.error(`- ${message}`);
  process.exit(1);
}
console.log(`Contenu valide : ${FICHIERS.length} fichiers conformes à leur schéma (${dossier}).`);
