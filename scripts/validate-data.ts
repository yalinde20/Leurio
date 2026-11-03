// Valide la structure des fichiers de contenu (PLAN §9) avec les schémas de `schemas/`, puis
// leurs références croisées (codes d'espèce, animations, types de leurre cités) et les doublons.
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

type Entrees = Record<string, unknown>[];

/** Doublons d'un champ : « species.json : doublon « SAN » (code présent 2 fois) ». */
function doublons(nomFichier: string, entrees: Entrees, champ: string): string[] {
  const compte = new Map<string, number>();
  for (const e of entrees) {
    const valeur = e[champ];
    if (typeof valeur === 'string') compte.set(valeur, (compte.get(valeur) ?? 0) + 1);
  }
  return [...compte]
    .filter(([, n]) => n > 1)
    .map(([valeur, n]) => `${nomFichier} : doublon « ${valeur} » (${champ} présent ${n} fois)`);
}

/** Références croisées et doublons ; les entrées doivent déjà être conformes aux schémas. */
function verifierReferences(contenu: Record<string, Entrees>): string[] {
  const codes = (nom: string, champ: string): Set<unknown> => new Set((contenu[nom] ?? []).map((e) => e[champ]));
  const especes = codes('species', 'code');
  const animations = codes('techniques', 'id');
  const types = codes('lure-types', 'id');
  const messages = [
    ...doublons('species.json', contenu['species'] ?? [], 'code'),
    ...doublons('lure-types.json', contenu['lure-types'] ?? [], 'id'),
    ...doublons('techniques.json', contenu['techniques'] ?? [], 'id'),
  ];
  for (const t of contenu['lure-types'] ?? []) {
    const lieu = `lure-types.json, type de leurre ${String(t['id'])}`;
    for (const code of new Set((t['especes'] as string[]) ?? []))
      if (!especes.has(code)) messages.push(`${lieu} : espèce inconnue « ${code} » (absente de species.json)`);
    for (const id of new Set((t['techniques'] as string[] | undefined) ?? []))
      if (!animations.has(id)) messages.push(`${lieu} : animation inconnue « ${id} » (absente de techniques.json)`);
  }
  for (const k of contenu['starter-kit'] ?? []) {
    const id = String(k['typeId']);
    if (!types.has(id))
      messages.push(`starter-kit.json, kit de départ ${id} : type de leurre inconnu « ${id} » (absent de lure-types.json)`);
  }
  return messages;
}

const erreurs = FICHIERS.flatMap(valider);
const structureValide = erreurs.length === 0;
if (structureValide) {
  const lire = (nom: string): Entrees => JSON.parse(readFileSync(join(dossier, `${nom}.json`), 'utf8')) as Entrees;
  erreurs.push(
    ...verifierReferences({
      species: lire('species'),
      'lure-types': lire('lure-types'),
      techniques: lire('techniques'),
      'starter-kit': lire('starter-kit'),
    }),
  );
}
if (erreurs.length > 0) {
  console.error(`Contenu invalide (${erreurs.length} erreur${erreurs.length > 1 ? 's' : ''}) :`);
  for (const message of erreurs) console.error(`- ${message}`);
  if (!structureValide) console.error('Références croisées et doublons non vérifiés : corrige d\'abord la structure.');
  process.exit(1);
}
console.log(`Contenu valide : ${FICHIERS.length} fichiers conformes à leur schéma, références croisées cohérentes (${dossier}).`);
