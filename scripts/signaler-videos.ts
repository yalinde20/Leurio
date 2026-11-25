// Signale les vidéos disparues (PLAN §9) : lance la vérification de check-videos.ts puis ouvre une issue
// « Vidéos disparues » sur GitHub, ou met à jour celle qui est déjà ouverte (corps remplacé, pas de doublon).
// Usage : node scripts/signaler-videos.ts (variables YOUTUBE_API_KEY, GITHUB_REPOSITORY, GITHUB_TOKEN)
// Code de sortie : 0 si l'issue est ouverte, mise à jour ou inutile ; 1 si une variable manque
// ou si la vérification ou l'appel à GitHub a échoué, pour que le workflow échoue visiblement.
// Syntaxe TypeScript effaçable seulement.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkVideos, type Disparue, type NonVerifiee } from './check-videos.ts';

export const TITRE_ISSUE = 'Vidéos disparues';

export interface OptionsSignalement {
  disparues: Disparue[];
  /** Dépôt au format « propriétaire/nom ». */
  repo: string;
  token: string;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  nonVerifiees?: NonVerifiee[];
  /** Date de la passe (par défaut : maintenant). */
  date?: Date;
}

export type ResultatSignalement = { action: 'aucune' } | { action: 'ouverte' | 'mise-a-jour'; numero: number };

interface IssueGithub {
  number: number;
  title: string;
  pull_request?: unknown;
}

const API = 'https://api.github.com';
const DELAI_REQUETE_MS = 15_000;
const VARIABLES = ['YOUTUBE_API_KEY', 'GITHUB_REPOSITORY', 'GITHUB_TOKEN'] as const;

const reference = (v: Disparue): string => v.id ?? v.fichier ?? '(référence absente)';

function corpsIssue(disparues: Disparue[], nonVerifiees: NonVerifiee[], date: Date): string {
  const lignes = [
    'La vérification hebdomadaire des vidéos (`scripts/check-videos.ts`) ne retrouve plus ces vidéos :',
    '',
    ...disparues.map((v) => `- ${v.animation} : ${v.provider} \`${reference(v)}\``),
  ];
  if (nonVerifiees.length > 0) {
    lignes.push(
      '',
      `${nonVerifiees.length} autre(s) vidéo(s) n'ont pas pu être vérifiées cette fois-ci (panne réseau ou réponse du fournisseur) :`,
      '',
      ...nonVerifiees.map((v) => `- ${v.animation} : ${v.provider} \`${v.id}\` (${v.raison})`),
    );
  }
  lignes.push('', `Dernière vérification : ${date.toISOString().slice(0, 10)}.`);
  return lignes.join('\n');
}

async function appelGithub(
  fetch: OptionsSignalement['fetch'],
  token: string,
  url: string,
  methode: 'GET' | 'POST' | 'PATCH',
  corps?: unknown,
): Promise<unknown> {
  const reponse = await fetch(url, {
    method: methode,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
  });
  if (!reponse.ok) throw new Error(`GitHub a répondu HTTP ${reponse.status} à ${methode} ${url}`);
  return reponse.json();
}

export async function signalerVideosDisparues({
  disparues,
  repo,
  token,
  fetch,
  nonVerifiees = [],
  date = new Date(),
}: OptionsSignalement): Promise<ResultatSignalement> {
  if (disparues.length === 0) return { action: 'aucune' };
  const issues = `${API}/repos/${repo}/issues`;
  const body = corpsIssue(disparues, nonVerifiees, date);

  const ouvertes: IssueGithub[] = [];
  for (let page = 1; ; page++) {
    const lot = (await appelGithub(fetch, token, `${issues}?state=open&per_page=100&page=${page}`, 'GET')) as IssueGithub[];
    ouvertes.push(...lot);
    if (lot.length < 100) break;
  }
  const existante = ouvertes.find((i) => !i.pull_request && i.title === TITRE_ISSUE);

  if (existante) {
    await appelGithub(fetch, token, `${issues}/${existante.number}`, 'PATCH', { body });
    return { action: 'mise-a-jour', numero: existante.number };
  }
  const creee = (await appelGithub(fetch, token, issues, 'POST', { title: TITRE_ISSUE, body })) as { number: number };
  return { action: 'ouverte', numero: creee.number };
}

async function main(): Promise<number> {
  const manquantes = VARIABLES.filter((nom) => !process.env[nom]);
  if (manquantes.length > 0) {
    console.error(`Erreur : variable(s) d'environnement absente(s) : ${manquantes.join(', ')}.`);
    return 1;
  }
  const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
  const fetchAvecDelai = (url: string, init?: RequestInit): Promise<Response> =>
    fetch(url, { ...init, signal: AbortSignal.timeout(DELAI_REQUETE_MS) });
  try {
    const techniques = JSON.parse(readFileSync(join(racine, 'src/assets/data/techniques.json'), 'utf8')) as unknown;
    if (!Array.isArray(techniques)) throw new Error("techniques.json ne contient pas une liste d'animations");
    const { disparues, nonVerifiees } = await checkVideos({
      techniques,
      fetch: fetchAvecDelai,
      apiKey: process.env['YOUTUBE_API_KEY'],
      baseDir: resolve(racine, 'src/assets'),
    });
    console.log(`${disparues.length} vidéo(s) disparue(s), ${nonVerifiees.length} non vérifiée(s).`);
    const resultat = await signalerVideosDisparues({
      disparues,
      nonVerifiees,
      repo: process.env['GITHUB_REPOSITORY'] as string,
      token: process.env['GITHUB_TOKEN'] as string,
      fetch: fetchAvecDelai,
    });
    if (resultat.action === 'aucune') console.log('Aucune vidéo disparue : aucune issue à ouvrir.');
    else console.log(`Issue « ${TITRE_ISSUE} » ${resultat.action === 'ouverte' ? 'ouverte' : 'mise à jour'} : #${resultat.numero}.`);
    return 0;
  } catch (e) {
    console.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
