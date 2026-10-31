// Lance les tests des règles Firestore et Storage (tests/rules). Appelé par npm run test:rules,
// dans l'émulateur démarré par firebase emulators:exec.
// NODE_TEST_CONTEXT est retiré : lancé depuis un autre node --test (test d'acceptation
// du CI), le lanceur de tests imbriqué renverrait toujours le code 0, même en cas d'échec.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dossier = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'rules');
const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.test.mjs')).map((f) => join(dossier, f));
if (fichiers.length === 0) {
  console.error(`Aucun fichier *.test.mjs dans ${dossier}`);
  process.exit(1);
}
const { NODE_TEST_CONTEXT: _ignore, ...env } = process.env;
const r = spawnSync(process.execPath, ['--test', ...fichiers], { stdio: 'inherit', env });
process.exit(r.status ?? 1);
