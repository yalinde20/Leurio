// Passerelle du déploiement (PLAN §10) : décide si le commit de main peut être déployé.
// Il faut un push sur main, un commit qui est encore la tête de main (pas de redéploiement
// d'un vieux commit) et, pour chaque workflow de REQUIS, un dernier run (id le plus
// élevé) terminé avec succès. Lancé par deploy.yml, il lit l'API GitHub et écrit
// `deployer=true|false` dans $GITHUB_OUTPUT. Variables : GITHUB_REPOSITORY, GITHUB_TOKEN,
// HEAD_SHA, EVENT, BRANCH.
// Seuls les runs d'événement push comptent : un run de pull_request ne valide rien.
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Noms des workflows qui tournent sur pull_request.
export const REQUIS = ['CI', 'Android', 'Règles Firestore'];

export function decider({ evenement, branche, sha, teteMain, runs, requis }) {
  if (evenement !== 'push') return { deployer: false, raison: `Pas de déploiement : l'événement est « ${evenement} », pas un push.` };
  if (branche !== 'main') return { deployer: false, raison: `Pas de déploiement : la branche est « ${branche} », pas main.` };
  if (sha !== teteMain) {
    return { deployer: false, raison: `Pas de déploiement : le commit ${sha} n'est plus la tête de main (${teteMain}).` };
  }
  for (const nom of requis) {
    const dernier = runs.filter((r) => r.name === nom && r.event === 'push').reduce((a, r) => (!a || r.id > a.id ? r : a), null);
    if (!dernier) return { deployer: false, raison: `Pas de déploiement : aucun run du workflow « ${nom} » pour l'instant.` };
    if (dernier.status !== 'completed') return { deployer: false, raison: `Pas de déploiement : le workflow « ${nom} » n'est pas terminé.` };
    if (dernier.conclusion !== 'success') {
      return { deployer: false, raison: `Pas de déploiement : le workflow « ${nom} » a fini en « ${dernier.conclusion} ».` };
    }
  }
  return { deployer: true, raison: `Déploiement autorisé : ${requis.join(', ')} ont réussi.` };
}

async function main() {
  const { GITHUB_REPOSITORY, GITHUB_TOKEN, HEAD_SHA, EVENT, BRANCH, GITHUB_OUTPUT } = process.env;
  const api = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;
  const lire = async (chemin) => {
    const reponse = await fetch(`${api}/${chemin}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    });
    if (!reponse.ok) throw new Error(`API GitHub : ${reponse.status} ${reponse.statusText}`);
    return reponse.json();
  };
  const { workflow_runs: runs } = await lire(`actions/runs?head_sha=${HEAD_SHA}&event=push&branch=main&per_page=100`);
  const teteMain = (await lire('branches/main')).commit.sha;
  const { deployer, raison } = decider({ evenement: EVENT, branche: BRANCH, sha: HEAD_SHA, teteMain, runs, requis: REQUIS });
  console.log(raison);
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `deployer=${deployer}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
