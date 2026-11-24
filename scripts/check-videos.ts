// Vérifie que chaque vidéo de techniques.json existe encore (PLAN §9, §9 bis) :
// YouTube (API videos.list, clé YOUTUBE_API_KEY), Vimeo et Dailymotion (oEmbed), fichiers « self ».
// Usage : node scripts/check-videos.ts [--json] [--data <techniques.json>] [--assets <dossier>]
// Code de sortie : 0 si aucune vidéo n'a disparu, 1 sinon, 2 si YOUTUBE_API_KEY manque,
// 3 si le script n'a pas pu tourner (fichier de données illisible…).
// Une vidéo « non vérifiée » (panne réseau, réponse 5xx) ne bloque pas. Syntaxe TypeScript effaçable seulement.
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Video {
  provider: string;
  id?: string;
  fichier?: string;
}

interface Technique {
  id: string;
  videos?: Video[];
}

export interface Disparue {
  animation: string;
  provider: string;
  id?: string;
  fichier?: string;
}

export interface NonVerifiee {
  animation: string;
  provider: string;
  id: string;
  raison: string;
}

export interface Resultat {
  disparues: Disparue[];
  nonVerifiees: NonVerifiee[];
}

export interface Options {
  techniques: Technique[];
  fetch: (url: string) => Promise<Response>;
  apiKey: string | undefined;
  /** Dossier des fichiers « self » (par défaut src/assets). */
  baseDir?: string;
}

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOT_YOUTUBE = 50;
const VARIABLE_CLE = 'YOUTUBE_API_KEY';
const DELAI_REQUETE_MS = 15_000;

const estUnFichier = (chemin: string): boolean => statSync(chemin, { throwIfNoEntry: false })?.isFile() ?? false;

const OEMBED: Record<string, (id: string) => string> = {
  vimeo: (id) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}`,
  dailymotion: (id) =>
    `https://www.dailymotion.com/services/oembed?url=${encodeURIComponent(`https://www.dailymotion.com/video/${id}`)}`,
};

const raisonErreur = (e: unknown): string => `erreur réseau : ${e instanceof Error ? e.message : String(e)}`;

async function verifierYoutube(
  entrees: { animation: string; id: string }[],
  { fetch, apiKey }: { fetch: Options['fetch']; apiKey: string },
  resultat: Resultat,
): Promise<void> {
  for (let i = 0; i < entrees.length; i += LOT_YOUTUBE) {
    const lot = entrees.slice(i, i + LOT_YOUTUBE);
    const ids = [...new Set(lot.map((e) => e.id))];
    const url = `https://www.googleapis.com/youtube/v3/videos?part=id&id=${ids.join(',')}&key=${encodeURIComponent(apiKey)}`;
    let trouvees: Set<string>;
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error(`réponse HTTP ${reponse.status}`);
      const corps = (await reponse.json()) as { items?: { id: string }[] };
      trouvees = new Set((corps.items ?? []).map((item) => item.id));
    } catch (e) {
      const raison = e instanceof Error && e.message.startsWith('réponse HTTP') ? e.message : raisonErreur(e);
      for (const { animation, id } of lot) resultat.nonVerifiees.push({ animation, provider: 'youtube', id, raison });
      continue;
    }
    for (const { animation, id } of lot) {
      if (!trouvees.has(id)) resultat.disparues.push({ animation, provider: 'youtube', id });
    }
  }
}

async function verifierOembed(
  animation: string,
  provider: string,
  id: string,
  fetch: Options['fetch'],
  resultat: Resultat,
): Promise<void> {
  try {
    const { status } = await fetch(OEMBED[provider](id));
    if (status === 200) return;
    if (status === 404 || status === 401 || status === 403) resultat.disparues.push({ animation, provider, id });
    else resultat.nonVerifiees.push({ animation, provider, id, raison: `réponse HTTP ${status}` });
  } catch (e) {
    resultat.nonVerifiees.push({ animation, provider, id, raison: raisonErreur(e) });
  }
}

export async function checkVideos({ techniques, fetch, apiKey, baseDir = join(racine, 'src/assets') }: Options): Promise<Resultat> {
  if (!apiKey) throw new Error(`Variable d'environnement ${VARIABLE_CLE} manquante : la clé de l'API YouTube Data est nécessaire.`);
  const resultat: Resultat = { disparues: [], nonVerifiees: [] };
  const youtube: { animation: string; id: string }[] = [];

  for (const technique of techniques) {
    for (const video of technique.videos ?? []) {
      const animation = technique.id;
      if (video.provider === 'youtube' && video.id) youtube.push({ animation, id: video.id });
      else if (video.provider in OEMBED && video.id) await verifierOembed(animation, video.provider, video.id, fetch, resultat);
      else if (video.provider === 'self' && video.fichier) {
        if (!estUnFichier(join(baseDir, video.fichier))) {
          resultat.disparues.push({ animation, provider: 'self', fichier: video.fichier });
        }
      }
    }
  }
  await verifierYoutube(youtube, { fetch, apiKey }, resultat);
  return resultat;
}

function valeurOption(args: string[], nom: string): string | undefined {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(args: string[]): Promise<number> {
  const apiKey = process.env['YOUTUBE_API_KEY'];
  if (!apiKey) {
    console.error(`Erreur : la variable d'environnement ${VARIABLE_CLE} est absente (clé de l'API YouTube Data).`);
    return 2;
  }
  const data = resolve(valeurOption(args, '--data') ?? join(racine, 'src/assets/data/techniques.json'));
  const baseDir = resolve(valeurOption(args, '--assets') ?? join(racine, 'src/assets'));
  let resultat: Resultat;
  try {
    const techniques = JSON.parse(readFileSync(data, 'utf8')) as unknown;
    if (!Array.isArray(techniques)) throw new Error(`${data} ne contient pas une liste d'animations`);
    resultat = await checkVideos({
      techniques: techniques as Technique[],
      fetch: (url) => fetch(url, { signal: AbortSignal.timeout(DELAI_REQUETE_MS) }),
      apiKey,
      baseDir,
    });
  } catch (e) {
    console.error(`Erreur : vérification impossible (${e instanceof Error ? e.message : String(e)}).`);
    return 3;
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify(resultat, null, 2));
  } else {
    for (const d of resultat.disparues) console.log(`DISPARUE  ${d.animation}  ${d.provider}  ${d.id ?? d.fichier}`);
    for (const n of resultat.nonVerifiees) console.log(`NON VÉRIFIÉE  ${n.animation}  ${n.provider}  ${n.id}  (${n.raison})`);
    const { disparues, nonVerifiees } = resultat;
    console.log(
      disparues.length === 0
        ? `Aucune vidéo disparue${nonVerifiees.length ? `, ${nonVerifiees.length} non vérifiée(s)` : ''}.`
        : `${disparues.length} vidéo(s) disparue(s), ${nonVerifiees.length} non vérifiée(s).`,
    );
  }
  return resultat.disparues.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
