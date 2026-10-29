// Petit serveur statique du build de production, pour les tests e2e (aucune dépendance).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const racine = resolve(process.argv[2] ?? 'dist/leurio/browser');
const port = Number(process.argv[3] ?? 4300);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function fichier(chemin) {
  try {
    return (await stat(chemin)).isFile() ? chemin : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const demande = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
    let chemin = await fichier(join(racine, demande));
    // Repli SPA : toute route sans extension renvoie index.html ; un fichier absent reste un 404.
    if (!chemin && !extname(demande)) chemin = await fichier(join(racine, 'index.html'));
    if (!chemin) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    res
      .writeHead(200, { 'content-type': types[extname(chemin)] ?? 'application/octet-stream', 'cache-control': 'no-cache' })
      .end(await readFile(chemin));
  } catch (e) {
    const mauvaiseUri = e instanceof URIError;
    res.writeHead(mauvaiseUri ? 400 : 500, { 'content-type': 'text/plain' }).end(mauvaiseUri ? 'Bad request' : 'Server error');
  }
}).listen(port, () => console.log(`dist servi sur http://localhost:${port}`));
